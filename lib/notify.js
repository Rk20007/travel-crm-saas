import Notification from '@/models/Notification'
import PushSubscription from '@/models/PushSubscription'
import webpush, { pushConfigured } from '@/lib/webpush'

/**
 * Writes the in-app Notification (so the bell UI keeps working exactly as
 * before) and best-effort delivers the same message as a browser push, so it
 * reaches the user's phone/laptop even if the CRM tab isn't open.
 */
export async function notifyUser({
  userId,
  teamId,
  type,
  title,
  message,
  relatedId,
  relatedModel,
  priority = 'normal',
  action,
}) {
  const notification = await Notification.create({
    userId,
    teamId,
    type,
    title,
    message,
    relatedId,
    relatedModel,
    priority,
    action,
  }).catch(() => null)

  await sendPushToUser(userId, {
    title,
    body: message,
    url: action?.link,
    tag: String(notification?._id || type),
  })

  return notification
}

/** Fan out a push payload to every device a user has subscribed on. */
export async function sendPushToUser(userId, { title, body, url, tag }) {
  if (!pushConfigured) return
  const subs = await PushSubscription.find({ userId }).lean().catch(() => [])
  if (!subs.length) return

  const payload = JSON.stringify({
    title,
    body,
    url: url || '/dashboard',
    tag,
  })

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        )
      } catch (err) {
        // Subscription is stale (browser cleared it, uninstalled, etc.) — drop it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {})
        }
      }
    })
  )
}
