/**
 * Browser helpers for JWT + opaque refresh rotation.
 *
 * The access token is deliberately short-lived (15m). Keeping a session alive
 * across that boundary needs three things, and missing any one of them shows up
 * as a random "Invalid or expired token" a few minutes after signing in:
 *
 *   1. Refresh on the token's *own* expiry, not on a fixed wall-clock interval.
 *      A plain `setInterval(12m)` restarts from zero on every reload while the
 *      stored token keeps its original expiry — reload at minute 14 and the
 *      token dies at 15 with the next refresh not due until 26.
 *   2. Retry once on 401. 49 call sites fetch with a token read straight out of
 *      localStorage; without a retry, one unlucky expiry is a hard error.
 *   3. Exactly one refresh in flight. Rotation revokes the old refresh token, so
 *      two concurrent refreshes race and the loser gets logged out.
 */

const TOKEN_KEY = 'token'
const REFRESH_KEY = 'refreshToken'
const USER_KEY = 'user'

/** Refresh this far before the token actually expires. */
const SKEW_MS = 90_000
/** Cross-tab refresh lock; short enough that a crashed tab can't wedge it. */
const LOCK_KEY = 'auth.refreshLock'
const LOCK_TTL_MS = 10_000

/** Single-flight guard within this tab. */
let inFlight = null

function ls(key) {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function getToken() {
  return ls(TOKEN_KEY)
}

export function clearSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
}

/** Expiry of a JWT in epoch ms, or 0 when it can't be read. */
export function tokenExpiryMs(token = getToken()) {
  if (!token) return 0
  try {
    const [, payload] = token.split('.')
    if (!payload) return 0
    const json = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    )
    return typeof json.exp === 'number' ? json.exp * 1000 : 0
  } catch {
    return 0
  }
}

/** True when the token is gone, unreadable, or inside the refresh skew window. */
export function tokenNeedsRefresh(token = getToken()) {
  if (!token) return false // nothing to refresh against
  const exp = tokenExpiryMs(token)
  if (!exp) return false // opaque/impersonation token — leave it alone
  return exp - Date.now() <= SKEW_MS
}

/**
 * Another tab is mid-rotation. Waiting for its result beats starting a second
 * rotation that would revoke the token the first one is about to hand back.
 */
function lockHeldByOtherTab() {
  const raw = ls(LOCK_KEY)
  if (!raw) return false
  const at = Number(raw)
  return Number.isFinite(at) && Date.now() - at < LOCK_TTL_MS
}

function takeLock() {
  try {
    localStorage.setItem(LOCK_KEY, String(Date.now()))
  } catch {}
}

function releaseLock() {
  try {
    localStorage.removeItem(LOCK_KEY)
  } catch {}
}

async function waitForOtherTab(previousToken) {
  const deadline = Date.now() + LOCK_TTL_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150))
    if (!lockHeldByOtherTab()) break
  }
  const current = getToken()
  return current && current !== previousToken ? current : null
}

async function doRefresh() {
  const refreshToken = ls(REFRESH_KEY)
  // Impersonation sessions intentionally carry no refresh token — they must be
  // allowed to expire rather than be silently renewed.
  if (!refreshToken) return null

  const previous = getToken()
  if (lockHeldByOtherTab()) {
    const fromOtherTab = await waitForOtherTab(previous)
    if (fromOtherTab) return fromOtherTab
  }

  takeLock()
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    const data = await res.json().catch(() => null)

    if (!res.ok || !data?.token || !data?.refreshToken || !data?.user) {
      // A 5xx or a dropped connection says nothing about the session's
      // validity — only the server explicitly rejecting the refresh token does.
      // Signing the user out on a blip is exactly the bug we're fixing.
      if (res.status === 401 || res.status === 403) {
        clearSession()
      }
      return null
    }

    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(REFRESH_KEY, data.refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data.token
  } catch {
    return null
  } finally {
    releaseLock()
  }
}

/** Rotate the session. Concurrent callers share one request. */
export async function refreshAccessToken() {
  if (typeof window === 'undefined') return null
  if (inFlight) return inFlight
  inFlight = doRefresh().finally(() => {
    inFlight = null
  })
  return inFlight
}

/** The current token, rotated first if it is expired or about to be. */
export async function getValidToken() {
  const token = getToken()
  if (!token) return null
  if (!tokenNeedsRefresh(token)) return token
  return (await refreshAccessToken()) || getToken()
}

/**
 * fetch() with the session attached: refreshes ahead of expiry, and retries
 * once on a 401 so a token that died mid-request is invisible to the caller.
 */
export async function apiFetch(input, init = {}) {
  const token = await getValidToken()
  const headers = new Headers(init.headers || {})
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(input, { ...init, headers })
  if (res.status !== 401) return res

  const fresh = await refreshAccessToken()
  if (!fresh) return res

  const retryHeaders = new Headers(init.headers || {})
  retryHeaders.set('Authorization', `Bearer ${fresh}`)
  return fetch(input, { ...init, headers: retryHeaders })
}

/** Requests that must never be rewritten or retried by the interceptor. */
const AUTH_EXEMPT = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]

function requestUrl(input) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input?.url || ''
}

function isOwnApi(url) {
  if (!url) return false
  try {
    const parsed = new URL(url, window.location.origin)
    if (parsed.origin !== window.location.origin) return false
    if (!parsed.pathname.startsWith('/api/')) return false
    return !AUTH_EXEMPT.some((p) => parsed.pathname.startsWith(p))
  } catch {
    return false
  }
}

let uninstall = null

/**
 * Patch window.fetch so every existing `fetch('/api/...', { Authorization })`
 * call site gets pre-expiry refresh and 401-retry without being rewritten.
 * Idempotent; returns the uninstaller.
 */
export function installAuthFetch() {
  if (typeof window === 'undefined') return () => {}
  if (uninstall) return uninstall

  const original = window.fetch.bind(window)

  window.fetch = async function patchedFetch(input, init) {
    const url = requestUrl(input)
    if (!isOwnApi(url)) return original(input, init)

    const headers = new Headers(
      (init && init.headers) || (input instanceof Request ? input.headers : undefined)
    )
    // Anonymous API calls (public share links, webhooks) stay anonymous.
    if (!headers.has('Authorization')) return original(input, init)

    const token = await getValidToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const body = init?.body ?? undefined
    const first = await original(input instanceof Request ? url : input, {
      ...init,
      body,
      headers,
    })
    if (first.status !== 401) return first

    const fresh = await refreshAccessToken()
    if (!fresh) return first

    headers.set('Authorization', `Bearer ${fresh}`)
    return original(input instanceof Request ? url : input, { ...init, body, headers })
  }

  uninstall = () => {
    window.fetch = original
    uninstall = null
  }
  return uninstall
}

/**
 * Keep the session alive by rotating just before the current token expires,
 * plus a catch-up whenever the tab regains focus.
 *
 * Timer-based scheduling alone is not enough: background tabs get their timers
 * throttled hard, so a tab left open for an hour wakes up with a dead token.
 * The visibility check covers that case.
 */
export function scheduleSilentRefresh() {
  if (typeof window === 'undefined') return () => {}

  let timer = null
  let stopped = false

  const arm = () => {
    if (stopped) return
    if (timer) clearTimeout(timer)
    const exp = tokenExpiryMs()
    // Unreadable/absent expiry (e.g. impersonation): re-check periodically
    // rather than scheduling against a value we don't trust.
    const delay = exp ? Math.max(5_000, exp - Date.now() - SKEW_MS) : 60_000
    timer = setTimeout(run, Math.min(delay, 10 * 60_000))
  }

  const run = async () => {
    if (stopped) return
    if (tokenNeedsRefresh()) await refreshAccessToken()
    arm()
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible' && tokenNeedsRefresh()) {
      refreshAccessToken().finally(arm)
    }
  }

  // A token restored from a previous session may already be past its expiry.
  run()
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onVisible)

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onVisible)
  }
}
