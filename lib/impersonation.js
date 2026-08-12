/**
 * Browser-side bookkeeping for super admin support sessions.
 *
 * Starting an impersonation swaps the active credentials for a short-lived,
 * non-renewable token and stashes the admin's own session so it can be handed
 * straight back on exit. The refresh token is deliberately cleared while
 * impersonating — `scheduleSilentRefresh` finds nothing to rotate and leaves
 * the impersonation token alone, so the session really does expire.
 */

const ORIGIN_KEY = 'impersonation.origin'
const SESSION_KEY = 'impersonation.session'

function readJSON(key) {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** The active support session, or null when acting as yourself. */
export function getImpersonation() {
  return readJSON(SESSION_KEY)
}

export function isImpersonating() {
  return Boolean(getImpersonation())
}

/** Milliseconds until the impersonation token expires (0 once elapsed). */
export function impersonationRemainingMs(session = getImpersonation()) {
  if (!session?.startedAt || !session?.expiresInSeconds) return 0
  const endsAt = new Date(session.startedAt).getTime() + session.expiresInSeconds * 1000
  return Math.max(0, endsAt - Date.now())
}

/**
 * @param {object} payload - the `/api/superadmin/impersonate` response body
 */
export function startImpersonation(payload) {
  if (typeof window === 'undefined') return
  localStorage.setItem(
    ORIGIN_KEY,
    JSON.stringify({
      token: localStorage.getItem('token'),
      refreshToken: localStorage.getItem('refreshToken'),
      user: localStorage.getItem('user'),
    })
  )
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload.impersonating))
  localStorage.setItem('token', payload.token)
  localStorage.setItem('user', JSON.stringify(payload.user))
  localStorage.removeItem('refreshToken')
}

/**
 * Restore the super admin's own session.
 *
 * Best-effort notifies the server so the audit trail is closed, but always
 * restores locally — a network failure must not strand anyone inside another
 * user's account.
 */
export async function stopImpersonation({ notifyServer = true } = {}) {
  if (typeof window === 'undefined') return false

  const session = getImpersonation()
  if (!session) return false

  if (notifyServer) {
    try {
      await fetch('/api/superadmin/impersonate/stop', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
    } catch {
      // Ignore — the local restore below is what actually matters.
    }
  }

  const origin = readJSON(ORIGIN_KEY)
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(ORIGIN_KEY)

  if (origin?.token && origin?.user) {
    localStorage.setItem('token', origin.token)
    localStorage.setItem('user', origin.user)
    if (origin.refreshToken) localStorage.setItem('refreshToken', origin.refreshToken)
    return true
  }

  // No stashed session to go back to — force a fresh login rather than leaving
  // the impersonation token in place.
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  return false
}
