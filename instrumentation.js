/**
 * Next.js runs this once when the server boots.
 *
 * Used to start the Meta lead auto-sync timer on always-on hosts. On Vercel the
 * cron in vercel.json does that job instead, and the Edge runtime has no timers
 * or DB access at all — both are skipped here.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.VERCEL) return
  if (process.env.META_SYNC_AUTO === 'off') return

  const { startMetaSyncScheduler } = await import('@/lib/metaSyncScheduler')
  startMetaSyncScheduler()
}
