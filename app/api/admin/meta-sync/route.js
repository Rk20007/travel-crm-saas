import connectDB from '@/lib/mongodb'
import Team from '@/models/Team'
import { authenticate, requireRoles } from '@/lib/middleware'
import { encryptToken, decryptToken, maskToken } from '@/lib/metaSync'
import { schedulerState } from '@/lib/metaSyncScheduler'
import { recordAudit } from '@/lib/audit'

/**
 * Which scheduler is actually driving the sync, so the UI can say "every 15
 * min" honestly instead of promising automation that nothing is running.
 */
function autoMode() {
  if (process.env.META_SYNC_AUTO === 'off') {
    return { mode: 'off', active: false, intervalMinutes: null }
  }
  if (process.env.VERCEL) {
    return { mode: 'vercel-cron', active: !!process.env.CRON_SECRET, intervalMinutes: 15 }
  }
  const s = schedulerState()
  return {
    mode: 'in-process',
    active: s.active,
    intervalMinutes: Math.round(s.intervalMs / 60000),
    running: s.running,
    lastRunAt: s.lastRunAt,
  }
}

/** Config the browser is allowed to see — never the token itself. */
function publicConfig(team) {
  const cfg = team.metaSync || {}
  const token = decryptToken(cfg.accessTokenEnc)
  return {
    auto: autoMode(),
    enabled: !!cfg.enabled,
    formIds: cfg.formIds || [],
    hasToken: !!token,
    tokenPreview: maskToken(token),
    tokenSavedAt: cfg.tokenSavedAt || null,
    lastSyncAt: cfg.lastSyncAt || null,
    lastSyncStatus: cfg.lastSyncStatus || null,
    lastSyncError: cfg.lastSyncError || null,
    lastSyncCreated: cfg.lastSyncCreated || 0,
    totalSynced: cfg.totalSynced || 0,
    lastLeadCreatedTime: cfg.lastLeadCreatedTime || null,
  }
}

async function authorize(request) {
  const authResult = await authenticate(request)
  if (authResult.error) {
    return { response: Response.json({ error: authResult.error }, { status: authResult.status }) }
  }
  const forbidden = requireRoles(authResult.user.role, ['superadmin', 'admin'])
  if (forbidden) {
    return { response: Response.json({ error: forbidden.error }, { status: forbidden.status }) }
  }
  return { user: authResult.user }
}

export async function GET(request) {
  try {
    const auth = await authorize(request)
    if (auth.response) return auth.response

    await connectDB()
    const team = await Team.findById(auth.user.teamId).select('metaSync')
    if (!team) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 })
    }

    return Response.json(publicConfig(team))
  } catch (error) {
    console.error('Meta sync GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Save the agency's Meta pull-sync settings.
 *
 * `accessToken` is write-only: omit it to keep whatever is already stored, send
 * an empty string to clear it. That way the UI can re-save the form IDs without
 * ever having to hold the real token in the browser.
 */
export async function PATCH(request) {
  try {
    const auth = await authorize(request)
    if (auth.response) return auth.response

    const body = await request.json().catch(() => ({}))
    await connectDB()
    const team = await Team.findById(auth.user.teamId)
    if (!team) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 })
    }

    if (!team.metaSync) team.metaSync = {}

    if (body.formIds !== undefined) {
      const raw = Array.isArray(body.formIds)
        ? body.formIds
        : String(body.formIds).split(/[\s,]+/)
      const ids = [...new Set(raw.map((f) => String(f).trim()).filter(Boolean))]
      if (ids.some((id) => !/^\d{5,}$/.test(id))) {
        return Response.json(
          { error: 'Form IDs must be numeric (copy the ID from Meta Business Suite → Instant Forms)' },
          { status: 400 }
        )
      }
      if (ids.length > 20) {
        return Response.json({ error: 'At most 20 form IDs' }, { status: 400 })
      }
      team.metaSync.formIds = ids
    }

    if (body.accessToken !== undefined) {
      const t = String(body.accessToken).trim()
      if (t) {
        team.metaSync.accessTokenEnc = encryptToken(t)
        team.metaSync.tokenSavedAt = new Date()
      } else {
        team.metaSync.accessTokenEnc = undefined
        team.metaSync.tokenSavedAt = undefined
        team.metaSync.enabled = false
      }
    }

    if (body.enabled !== undefined) {
      const wantOn = !!body.enabled
      if (wantOn && !team.metaSync.accessTokenEnc) {
        return Response.json({ error: 'Save an access token before turning sync on' }, { status: 400 })
      }
      if (wantOn && !(team.metaSync.formIds || []).length) {
        return Response.json({ error: 'Add at least one form ID before turning sync on' }, { status: 400 })
      }
      team.metaSync.enabled = wantOn
    }

    // Re-running history is an explicit choice, not something a settings save
    // should trigger by accident.
    if (body.resetWatermark === true) {
      team.metaSync.lastLeadCreatedTime = undefined
    }

    await team.save()

    await recordAudit({
      teamId: team._id,
      entity: 'Team',
      entityId: team._id,
      action: 'meta_sync_settings_updated',
      summary: `Meta lead sync ${team.metaSync.enabled ? 'enabled' : 'disabled'} — ${
        (team.metaSync.formIds || []).length
      } form(s)${body.accessToken !== undefined ? ', token updated' : ''}`,
      actor: { userId: auth.user.userId, email: auth.user.email },
    })

    return Response.json({ message: 'Meta sync settings saved', ...publicConfig(team) })
  } catch (error) {
    console.error('Meta sync PATCH error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
