import { authenticate, requireRoles } from '@/lib/middleware'
import { isConfigured, buildRedirectUri, buildAuthUrl, signState } from '@/lib/googleAds'

const OWNER_ROLES = ['admin', 'superadmin']

/**
 * GET /api/integrations/google/oauth/start
 * Returns the Google consent-screen URL to redirect the browser to (rather
 * than redirecting itself) — this route is called via the same authenticated
 * apiFetch() every other API call uses, and a plain 302 can't carry a Bearer
 * header through a full-page navigation. The frontend does
 * `window.location.href = data.url` with the returned value. Never exposes
 * the client secret — only Google's own authorization URL.
 */
export async function GET(request) {
  const authResult = await authenticate(request)
  if (authResult.error) {
    return Response.json({ error: authResult.error }, { status: authResult.status })
  }
  const denied = requireRoles(authResult.user.role, OWNER_ROLES)
  if (denied) return Response.json({ error: denied.error }, { status: denied.status })

  if (!isConfigured()) {
    return Response.json(
      { error: 'Google Ads integration is not configured on this server (missing client id/secret/developer token)' },
      { status: 501 }
    )
  }

  const redirectUri = buildRedirectUri(request)
  const state = signState({ teamId: String(authResult.user.teamId), userId: String(authResult.user.userId) })
  const url = buildAuthUrl({ redirectUri, state })

  return Response.json({ url })
}
