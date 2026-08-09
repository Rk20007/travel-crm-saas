import { logger } from '@/lib/logger'

let followUpQueue

export async function getFollowUpQueue() {
  const url = process.env.REDIS_URL
  if (!url) return null
  try {
    if (!followUpQueue) {
      const { default: Queue } = await import('bull')
      followUpQueue = new Queue('follow-up-reminders', url, {
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      })
      followUpQueue.on('error', (err) => logger.error('Bull queue error', err?.message))
    }
    return followUpQueue
  } catch (e) {
    logger.warn('Bull queue unavailable', e?.message)
    return null
  }
}

export async function enqueueFollowUpReminder(payload) {
  const q = await getFollowUpQueue()
  if (!q) return false
  await q.add('remind', payload, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })
  return true
}
