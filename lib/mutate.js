'use client'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// A blip worth retrying: proxy/gateway/server hiccup or rate-limit — never a
// real 4xx rejection (that fails again identically).
const isRetryable = (status) => status === 408 || status === 429 || status >= 500

/**
 * JSON mutation (POST / PUT / PATCH / DELETE) with a bounded retry for
 * genuinely transient failures — a dropped connection, a timeout, or a
 * 5xx/429 blip. Meant for the follow-up / lead / booking writes that used to
 * be fire-and-forget (`.catch(() => {})`) and would silently vanish on a
 * momentary network hiccup, leaving the UI showing success while nothing was
 * saved.
 *
 * Safe to retry:
 *  - PUT / PATCH / DELETE are idempotent by construction here.
 *  - The POSTs it's used for (bookings, follow-ups) dedupe server-side
 *    (bookings return the existing record; follow-ups supersede prior pending
 *    ones), so a retried create can't produce a duplicate.
 *
 * Returns the parsed response body on success; throws an Error with a
 * human-readable `.message` (and `.status` when it was an HTTP error) on
 * final failure.
 */
export async function mutateJson(
  url,
  { method = 'POST', body, token, retries = 2, timeoutMs = 15000 } = {}
) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await sleep(600 * attempt)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      clearTimeout(timer)

      const text = await res.text()
      let data = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        // Not JSON — a reverse-proxy error page, not our API. Treat by status.
      }

      if (res.ok) return data ?? {}

      const err = new Error(data?.error || `Request failed (${res.status})`)
      err.status = res.status
      if (!isRetryable(res.status)) throw err // real rejection — stop now
      lastErr = err
    } catch (err) {
      clearTimeout(timer)
      if (err.status && !isRetryable(err.status)) throw err
      lastErr =
        err.name === 'AbortError'
          ? new Error('The request timed out. Please try again.')
          : err instanceof TypeError
            ? new Error('Could not reach the server. Check your connection.')
            : err
    }
  }
  throw lastErr || new Error('Request failed')
}
