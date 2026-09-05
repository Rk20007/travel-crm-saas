import connectDB from '@/lib/mongodb'
import GoogleIntegration from '@/models/GoogleIntegration'
import { authenticate, requireRoles } from '@/lib/middleware'
import { getValidAccessToken, listCampaigns, encryptToken } from '@/lib/googleAds'

const OWNER_ROLES = ['admin', 'superadmin']

/**
 * GET /api/integrations/google/campaigns?integrationId=...
 * Live campaign list for the mapping picker's "Select campaign" dropdown.
 * If the Google Ads API call itself fails (e.g. developer token still
 * pending Google's approval — common right after first connecting), the
 * mapping UI falls back to manual campaign-id entry rather than being
 * blocked entirely; this just returns the error for that fallback to kick in.
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status })
    const denied = requireRoles(authResult.user.role, OWNER_ROLES)
    if (denied) return Response.json({ error: denied.error }, { status: denied.status })

    const { searchParams } = new URL(request.url)
    const integrationId = searchParams.get('integrationId')
    if (!integrationId) return Response.json({ error: 'integrationId is required' }, { status: 400 })

    await connectDB()
    const integration = await GoogleIntegration.findOne({
      _id: integrationId,
      teamId: authResult.user.teamId,
    })
    if (!integration) return Response.json({ error: 'Integration not found' }, { status: 404 })

    const { accessToken, refreshed, expiresAt } = await getValidAccessToken(integration)
    if (refreshed) {
      integration.accessTokenEnc = encryptToken(accessToken)
      integration.accessTokenExpiresAt = expiresAt
      await integration.save()
    }

    const campaigns = await listCampaigns(accessToken, integration.googleCustomerId)
    return Response.json({ campaigns })
  } catch (error) {
    console.error('List Google campaigns error:', error)
    return Response.json({ error: error.message || 'Could not load campaigns' }, { status: 502 })
  }
}
