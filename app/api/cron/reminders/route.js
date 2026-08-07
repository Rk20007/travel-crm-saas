import connectDB from '@/lib/mongodb'
import FollowUp from '@/models/FollowUp'
import Notification from '@/models/Notification'
import { logger } from '@/lib/logger'

/**
 * Call from external cron (or AWS EventBridge) with header: x-cron-secret
 */
export async function POST(request) {
  try {
    const secret = process.env.CRON_SECRET
    if (!secret || request.headers.get('x-cron-secret') !== secret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const now = new Date()
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const due = await FollowUp.find({
      status: 'pending',
      scheduledDate: { $gte: now, $lte: windowEnd },
      reminderSent: { $ne: true },
    })
      .populate('assignedTo', 'name email')
      .populate('leadId', 'teamId')
      .limit(200)
      .lean()

    const notifications = due
      .filter((fu) => fu.assignedTo?._id)
      .map((fu) => ({
        userId: fu.assignedTo._id,
        teamId: fu.teamId || fu.leadId?.teamId || undefined,
        type: 'follow_up_reminder',
        title: 'Follow-up reminder',
        message: `Follow-up scheduled at ${fu.scheduledDate?.toISOString?.() || ''}`,
        relatedId: fu._id,
        relatedModel: 'FollowUp',
        isRead: false,
      }))

    // Batch both the notification inserts and the reminderSent flag update —
    // one round trip each instead of up to 2 per follow-up (create + save).
    await Promise.all([
      notifications.length ? Notification.insertMany(notifications) : null,
      due.length
        ? FollowUp.updateMany({ _id: { $in: due.map((fu) => fu._id) } }, { $set: { reminderSent: true } })
        : null,
    ])

    const notified = due.length
    logger.info('cron reminders processed', { notified })
    return Response.json({ ok: true, notified })
  } catch (error) {
    logger.error('cron reminders error', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
