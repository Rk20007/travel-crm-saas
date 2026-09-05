/**
 * Google Ads integration — OAuth connect + Google Ads API access.
 *
 * A deliberately separate, own-file implementation (does not touch
 * lib/metaSync.js or app/api/auth/google, which is Google *sign-in*, a
 * different OAuth client/scope entirely). Token encryption mirrors Meta's
 * scheme (lib/metaSync.js encryptToken/decryptToken) exactly, just keyed off
 * its own secret so rotating one never affects the other.
 */

import crypto from 'crypto'

const GOOGLE_ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v17'
const GOOGLE_ADS_API = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`
const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ADS_SCOPE = 'https://www.googleapis.com/auth/adwords'

/* ------------------------------------------------------------------ *
 * Token encryption (AES-256-GCM, same format as Meta's — "v1:iv:tag:data")
 * ------------------------------------------------------------------ */

function encryptionKey() {
  const secret =
    process.env.GOOGLE_ADS_TOKEN_SECRET || process.env.JWT_SECRET || 'google-ads-token-fallback-secret'
  return crypto.createHash('sha256').update(secret, 'utf8').digest()
}

export function encryptToken(plain) {
  if (!plain) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

export function decryptToken(stored) {
  if (!stored) return null
  try {
    const [version, ivB64, tagB64, dataB64] = String(stored).split(':')
    if (version !== 'v1') return null
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export function maskToken(plain) {
  if (!plain) return ''
  const s = String(plain)
  return s.length <= 6 ? '••••••' : `••••••${s.slice(-6)}`
}

/* ------------------------------------------------------------------ *
 * OAuth
 * ------------------------------------------------------------------ */

function credentials() {
  return {
    clientId: process.env.GOOGLE_ADS_CLIENT_ID,
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  }
}

export function isConfigured() {
  const c = credentials()
  return !!(c.clientId && c.clientSecret && c.developerToken)
}

/** Where Google redirects back to after consent — derived per-request so it works on any deployment host without a hardcoded URL. */
export function buildRedirectUri(request) {
  const origin = new URL(request.url).origin
  return `${origin}/api/integrations/google/oauth/callback`
}

/**
 * `state` carries the team + user id through the redirect round-trip
 * (signed, not just base64, so it can't be tampered with to attach the
 * connection to a different team) — HMAC'd with the same secret as tokens.
 */
export function signState(payload) {
  const json = JSON.stringify(payload)
  const b64 = Buffer.from(json, 'utf8').toString('base64url')
  const sig = crypto.createHmac('sha256', encryptionKey()).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

export function verifyState(state) {
  try {
    const [b64, sig] = String(state).split('.')
    const expected = crypto.createHmac('sha256', encryptionKey()).update(b64).digest('base64url')
    if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export function buildAuthUrl({ redirectUri, state }) {
  const { clientId } = credentials()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ADS_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${OAUTH_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code, redirectUri) {
  const { clientId, clientSecret } = credentials()
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token exchange failed')
  return data // { access_token, refresh_token, expires_in, scope, token_type }
}

async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = credentials()
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token refresh failed')
  return data // { access_token, expires_in, scope, token_type }
}

/**
 * A valid access token for this integration, refreshing first if the cached
 * one is missing/expired. Callers should persist the (possibly new) token
 * back onto the GoogleIntegration doc — this function is storage-agnostic.
 */
export async function getValidAccessToken(integration) {
  const cachedToken = decryptToken(integration.accessTokenEnc)
  const notExpired = integration.accessTokenExpiresAt && new Date(integration.accessTokenExpiresAt) > new Date(Date.now() + 60_000)
  if (cachedToken && notExpired) return { accessToken: cachedToken, refreshed: false }

  const refreshToken = decryptToken(integration.refreshTokenEnc)
  if (!refreshToken) throw new Error('No refresh token stored — reconnect Google Ads')
  const data = await refreshAccessToken(refreshToken)
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000),
    refreshed: true,
  }
}

/* ------------------------------------------------------------------ *
 * Google Ads API
 * ------------------------------------------------------------------ */

function adsHeaders(accessToken, loginCustomerId) {
  const { developerToken } = credentials()
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  }
  if (loginCustomerId) headers['login-customer-id'] = String(loginCustomerId).replace(/-/g, '')
  return headers
}

/** Every customer (account) this OAuth grant can see — the connect step's "select account" list. */
export async function listAccessibleCustomers(accessToken) {
  const res = await fetch(`${GOOGLE_ADS_API}/customers:listAccessibleCustomers`, {
    headers: adsHeaders(accessToken),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error?.message || 'Could not list Google Ads accounts')
  // resourceNames look like "customers/1234567890"
  return (data.resourceNames || []).map((rn) => rn.split('/')[1])
}

/** Campaigns for one customer account — used to populate the mapping picker. */
export async function listCampaigns(accessToken, customerId, { loginCustomerId } = {}) {
  const query =
    "SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY campaign.id"
  const res = await fetch(`${GOOGLE_ADS_API}/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers: adsHeaders(accessToken, loginCustomerId),
    body: JSON.stringify({ query }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error?.message || 'Could not list campaigns')
  return (data.results || []).map((r) => ({
    id: String(r.campaign.id),
    name: r.campaign.name,
    status: r.campaign.status,
  }))
}

/** Best-effort account display name — cosmetic only, never blocks a connect. */
export async function getCustomerName(accessToken, customerId) {
  try {
    const query = 'SELECT customer.descriptive_name FROM customer LIMIT 1'
    const res = await fetch(`${GOOGLE_ADS_API}/customers/${customerId}/googleAds:search`, {
      method: 'POST',
      headers: adsHeaders(accessToken),
      body: JSON.stringify({ query }),
    })
    const data = await res.json().catch(() => ({}))
    return data.results?.[0]?.customer?.descriptiveName || null
  } catch {
    return null
  }
}
