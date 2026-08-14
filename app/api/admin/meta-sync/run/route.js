import connectDB from '@/lib/mongodb'
import Team from '@/models/Team'
import { authenticate, requireRoles } from '@/lib/middleware'
import { rateLimit } from '@/lib/rate-limit'
import { syncTeamMetaLeads } from '@/lib/metaSync'
import { recordAudit } from '@/lib/audit'

/**
 * "Fetch Now" — pull this workspace's Meta leads on demand.
 *
 * Same code path as the cron; this just lets an owner see leads land without
 * waiting for the next scheduled run. `full: true` ignores the incremental
 * watermark and re-scans the form's whole history (dedupe by externalId still
 * prevents re-importing anything already in the CRM).
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }
    const forbidden = requireRoles(authResult.user.role, ['superadmin', 'admin'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    const rl = await rateLimit(`meta-sync-run:${authResult.user.teamId}`, {
      windowMs: 60_000,
      max: 6,
    })
    if (!rl.ok) {
      return Response.json(
        { error: 'Sync already running too often — try again in a minute' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => ({}))
    await connectDB()

    const team = await Team.findById(authResult.user.teamId)
    if (!team) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 })
    }
    if (!team.metaSync?.accessTokenEnc) {
      return Response.json({ error: 'Connect Meta first (form ID + access token)' }, { status: 400 })
    }

    const result = await syncTeamMetaLeads(team, { full: !!body.full })

    await recordAudit({
      teamId: team._id,
      entity: 'Team',
      entityId: team._id,
      action: 'meta_sync_manual_run',
      summary: `Manual Meta sync — ${result.created} new, ${result.duplicates} duplicate, ${result.failed} skipped`,
      actor: { userId: authResult.user.userId, email: authResult.user.email },
    })

    return Response.json(
      {
        ok: result.ok,
        message: result.ok
          ? `${result.created} new lead(s) imported`
          : result.error || 'Sync finished with errors',
        created: result.created,
        duplicates: result.duplicates,
        failed: result.failed,
        forms: result.forms,
        error: result.error,
        lastSyncAt: team.metaSync.lastSyncAt,
      },
      // A partial failure still imported leads, so it isn't a request error —
      // the body carries the per-form detail.
      { status: 200 }
    )
  } catch (error) {
    console.error('Meta sync run error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
