import connectDB from '@/lib/mongodb'
import GoogleIntegration from '@/models/GoogleIntegration'
import { recordAudit } from '@/lib/audit'
import {
  verifyState,
  buildRedirectUri,
  exchangeCodeForTokens,
  listAccessibleCustomers,
  getCustomerName,
  encryptToken,
} from '@/lib/googleAds'

/**
 * GET /api/integrations/google/oauth/callback
 * Google redirects the user's own browser here — there is no Bearer token on
 * this request (it's a full-page navigation from Google, not our app), so
 * the team/user this connection belongs to comes from the signed `state`
 * param instead (HMAC'd in oauth/start, verified here — can't be forged into
 * attaching a connection to a different team).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const redirectTo = (params) => Response.redirect(`${new URL(request.url).origin}/dashboard/admin?${params}`, 302)

  if (error) return redirectTo(`google_error=${encodeURIComponent(error)}`)
  if (!code || !state) return redirectTo('google_error=missing_code')

  const claims = verifyState(state)
  if (!claims?.teamId) return redirectTo('google_error=invalid_state')

  try {
    await connectDB()
    const redirectUri = buildRedirectUri(request)
    const tokens = await exchangeCodeForTokens(code, redirectUri)
    if (!tokens.refresh_token) {
      // Google only returns a refresh_token the FIRST time a user consents
      // (or after `prompt=consent`, which oauth/start always sets) — if it's
      // still missing something's off; fail loudly rather than saving a
      // connection that can never refresh past its first hour.
      return redirectTo('google_error=no_refresh_token')
    }

    const accessibleCustomers = await listAccessibleCustomers(tokens.access_token)
    if (!accessibleCustomers.length) {
      return redirectTo('google_error=no_accessible_accounts')
    }

    const accessTokenExpiresAt = new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000)
    const refreshTokenEnc = encryptToken(tokens.refresh_token)
    const accessTokenEnc = encryptToken(tokens.access_token)

    for (const customerId of accessibleCustomers) {
      const name = await getCustomerName(tokens.access_token, customerId)
      await GoogleIntegration.findOneAndUpdate(
        { teamId: claims.teamId, googleCustomerId: customerId },
        {
          googleCustomerName: name || undefined,
          status: 'connected',
          refreshTokenEnc,
          accessTokenEnc,
          accessTokenExpiresAt,
          connectedBy: claims.userId,
          lastError: null,
        },
        { upsert: true, new: true }
      )
    }

    await recordAudit({
      teamId: claims.teamId,
      entity: 'GoogleIntegration',
      action: 'google_ads_connected',
      summary: `Connected ${accessibleCustomers.length} Google Ads account(s)`,
      actor: { userId: claims.userId },
    })

    return redirectTo(`google_connected=${accessibleCustomers.length}`)
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return redirectTo(`google_error=${encodeURIComponent(err.message || 'connect_failed')}`)
  }
}
