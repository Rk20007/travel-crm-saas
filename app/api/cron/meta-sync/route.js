import connectDB from '@/lib/mongodb'
import { findSyncEnabledTeams, syncTeamMetaLeads } from '@/lib/metaSync'

/**
 * Scheduled Meta lead pull for every workspace that has the toggle on.
 *
 * Runs on Vercel Cron (see vercel.json), which sends
 * `Authorization: Bearer $CRON_SECRET`. Also accepts `x-cron-secret` so it can
 * be triggered by any other scheduler — same convention as the other cron
 * routes in this project.
 */
export async function GET(request) {
  try {
    const secret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization') || ''
    const bearerOk = secret && authHeader === `Bearer ${secret}`
    const headerOk = secret && request.headers.get('x-cron-secret') === secret
    if (!secret || (!bearerOk && !headerOk)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const teams = await findSyncEnabledTeams()

    const results = []
    // Sequential on purpose: these are outbound Graph API calls plus a write
    // per lead, and Meta rate-limits per app. A stuck agency delays the rest by
    // at most its own timeout rather than fanning out a burst.
    for (const team of teams) {
      try {
        const r = await syncTeamMetaLeads(team)
        results.push({
          teamId: String(team._id),
          name: team.name,
          created: r.created,
          duplicates: r.duplicates,
          failed: r.failed,
          error: r.error,
        })
      } catch (e) {
        console.error('Meta cron sync failed for team', String(team._id), e.message)
        results.push({ teamId: String(team._id), name: team.name, error: e.message })
      }
    }

    const created = results.reduce((n, r) => n + (r.created || 0), 0)
    return Response.json({
      message: `Meta sync complete — ${created} new lead(s) across ${teams.length} workspace(s)`,
      workspaces: teams.length,
      created,
      results,
    })
  } catch (error) {
    console.error('Meta cron error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Vercel Cron issues GETs; POST is here for manual/external triggers. */
export const POST = GET
