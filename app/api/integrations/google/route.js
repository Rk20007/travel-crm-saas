import crypto from 'crypto'
import connectDB from '@/lib/mongodb'
import Team from '@/models/Team'
import GoogleIntegration from '@/models/GoogleIntegration'
import { authenticate, requireRoles } from '@/lib/middleware'
import { recordAudit } from '@/lib/audit'
import { isConfigured } from '@/lib/googleAds'

const OWNER_ROLES = ['admin', 'superadmin']

/**
 * GET /api/integrations/google
 * Connected Google Ads accounts + the Lead Form webhook key/URL for this
 * workspace — the equivalent "status" view Meta's /api/admin/meta-sync GET
 * provides, just for Google.
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status })
    const denied = requireRoles(authResult.user.role, OWNER_ROLES)
    if (denied) return Response.json({ error: denied.error }, { status: denied.status })

    await connectDB()
    const [team, integrations] = await Promise.all([
      Team.findById(authResult.user.teamId).select('googleLeadFormKey').lean(),
      GoogleIntegration.find({ teamId: authResult.user.teamId })
        .select('googleCustomerId googleCustomerName status lastError lastSyncAt createdAt updatedAt')
        .sort({ createdAt: -1 })
        .lean(),
    ])

    return Response.json({
      oauthConfigured: isConfigured(),
      integrations,
      webhookKeySet: !!team?.googleLeadFormKey,
      webhookUrlHint: '/api/webhooks/google/leads', // full origin filled in client-side
    })
  } catch (error) {
    console.error('Get Google integrations error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/integrations/google
 * Body: { action: 'generateWebhookKey' } — (re)generates the Lead Form
 * webhook key. Rotating it invalidates the old one immediately, same as
 * regenerating an API key elsewhere in this app.
 */
export async function PATCH(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status })
    const denied = requireRoles(authResult.user.role, OWNER_ROLES)
    if (denied) return Response.json({ error: denied.error }, { status: denied.status })

    const body = await request.json().catch(() => ({}))
    if (body.action !== 'generateWebhookKey') {
      return Response.json({ error: 'Unsupported action' }, { status: 400 })
    }

    await connectDB()
    const key = `gwf_${crypto.randomBytes(20).toString('hex')}`
    await Team.findByIdAndUpdate(authResult.user.teamId, { googleLeadFormKey: key })

    await recordAudit({
      teamId: authResult.user.teamId,
      entity: 'Team',
      entityId: authResult.user.teamId,
      action: 'google_webhook_key_generated',
      summary: 'Generated a new Google Ads Lead Form webhook key',
      actor: { userId: authResult.user.userId, email: authResult.user.email },
    })

    // Returned once, in full — same "shown only at creation" convention as
    // the existing inbound API key generator.
    return Response.json({ googleLeadFormKey: key })
  } catch (error) {
    console.error('Update Google integration error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
