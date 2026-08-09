/**
 * Browser helpers for JWT + opaque refresh rotation.
 */

export async function refreshAccessToken() {
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null
  if (!refreshToken) return null

  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.token || !data?.refreshToken || !data?.user) {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    return null
  }

  localStorage.setItem('token', data.token)
  localStorage.setItem('refreshToken', data.refreshToken)
  localStorage.setItem('user', JSON.stringify(data.user))
  return data.token
}

export function scheduleSilentRefresh(intervalMs = 12 * 60 * 1000) {
  if (typeof window === 'undefined') return () => {}
  const id = window.setInterval(() => {
    refreshAccessToken().catch(() => {})
  }, intervalMs)
  return () => window.clearInterval(id)
}
