/**
 * Optional Bull worker for follow-up reminder jobs.
 * Run: REDIS_URL=redis://localhost:6379 node scripts/worker-followups.js
 */
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const url = process.env.REDIS_URL
if (!url) {
  console.error('REDIS_URL is required for the worker.')
  process.exit(1)
}

const Queue = require('bull')

const q = new Queue('follow-up-reminders', url)

q.process('remind', async (job) => {
  console.log('[follow-up-reminders]', job.id, job.data)
  return { ok: true }
})

q.on('failed', (job, err) => {
  console.error('Job failed', job?.id, err?.message)
})

console.log('Follow-up reminder worker listening…')
