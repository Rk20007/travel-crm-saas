import connectDB from '@/lib/mongodb'
import Team from '@/models/Team'
import { authenticate, requireRoles } from '@/lib/middleware'
import { rateLimit } from '@/lib/rate-limit'
import { decryptToken, verifyMetaForm } from '@/lib/metaSync'

/**
 * Dry-run a form ID + token pair against the Graph API.
 *
 * Runs before anything is saved so the owner sees "Form 'Kashmir Package' —
 * 42 leads" (or Meta's own error text) instead of discovering a typo hours
 * later when no leads have appeared.
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

    // Each check is an outbound call to Meta on our IP — worth a leash.
    const rl = await rateLimit(`meta-test:${authResult.user.teamId}`, {
      windowMs: 60_000,
      max: 20,
    })
    if (!rl.ok) {
      return Response.json({ error: 'Too many test requests, wait a minute' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    await connectDB()

    // Falls back to the saved token so "Test" works after a reload, when the
    // input is showing a mask rather than the real value.
    let accessToken = String(body.accessToken || '').trim()
    if (!accessToken) {
      const team = await Team.findById(authResult.user.teamId).select('metaSync')
      accessToken = decryptToken(team?.metaSync?.accessTokenEnc)
    }
    if (!accessToken) {
      return Response.json({ error: 'Access token required' }, { status: 400 })
    }

    const rawIds = Array.isArray(body.formIds)
      ? body.formIds
      : String(body.formIds || body.formId || '').split(/[\s,]+/)
    const formIds = [...new Set(rawIds.map((f) => String(f).trim()).filter(Boolean))]
    if (!formIds.length) {
      return Response.json({ error: 'At least one form ID required' }, { status: 400 })
    }

    const results = []
    for (const formId of formIds.slice(0, 20)) {
      const check = await verifyMetaForm(formId, accessToken)
      results.push(
        check.ok
          ? { formId, ok: true, ...check.form }
          : { formId, ok: false, error: check.error }
      )
    }

    const okCount = results.filter((r) => r.ok).length
    return Response.json({
      ok: okCount === results.length,
      message:
        okCount === results.length
          ? `Connected — ${okCount} form(s) reachable`
          : `${okCount}/${results.length} form(s) reachable`,
      results,
    })
  } catch (error) {
    console.error('Meta sync test error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
