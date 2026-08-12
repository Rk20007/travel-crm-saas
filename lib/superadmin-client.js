/** Browser helpers shared by the /dashboard/platform pages. */

export function authToken() {
  return typeof window === 'undefined' ? null : localStorage.getItem('token')
}

/**
 * Redirects away and returns false unless the stored session is a real
 * super admin. The API enforces this too — this only avoids rendering a panel
 * that would fail every request.
 */
export function guardSuperadmin() {
  if (typeof window === 'undefined') return false
  const token = authToken()
  if (!token) {
    window.location.href = '/login'
    return false
  }
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.role !== 'superadmin') {
      window.location.href = '/dashboard'
      return false
    }
  } catch {
    window.location.href = '/login'
    return false
  }
  return true
}

/**
 * fetch() against /api/superadmin with auth attached and the JSON body parsed.
 * Throws an Error carrying the server's message so callers can just try/catch.
 */
export async function saFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${authToken()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data
}

export function formatINR(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`
}

export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
