'use client'

import { useEffect, useState, useCallback } from 'react'

// Simple module-level cache so dropdowns don't refetch on every mount.
const cache = new Map() // category -> options[]
const inflight = new Map() // category -> Promise

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function fetchCategory(category) {
  if (cache.has(category)) return cache.get(category)
  if (inflight.has(category)) return inflight.get(category)

  const p = (async () => {
    try {
      const res = await fetch(`/api/settings/options?category=${category}`, {
        headers: authHeaders(),
      })
      const data = await res.json()
      const options = res.ok ? data.options || [] : []
      cache.set(category, options)
      return options
    } catch {
      cache.set(category, [])
      return []
    } finally {
      inflight.delete(category)
    }
  })()

  inflight.set(category, p)
  return p
}

/** Invalidate the cache (call after editing masters in Settings). */
export function invalidateMasters(category = null) {
  if (category) cache.delete(category)
  else cache.clear()
}

/**
 * Load active dropdown options for a master category.
 * @param {string} category e.g. 'lead_status'
 * @param {Array} fallback  options used if none configured / while loading
 * Returns { options, loading, reload } where option = {key,label,color,icon}.
 */
export function useMasters(category, fallback = []) {
  const normalizedFallback = fallback.map((f) =>
    typeof f === 'string' ? { key: f, label: labelize(f) } : f
  )
  const [options, setOptions] = useState(
    cache.get(category) && cache.get(category).length
      ? cache.get(category)
      : normalizedFallback
  )
  const [loading, setLoading] = useState(!cache.has(category))

  const load = useCallback(
    async (force = false) => {
      if (!category) return
      if (force) invalidateMasters(category)
      setLoading(true)
      const opts = await fetchCategory(category)
      setOptions(opts.length ? opts : normalizedFallback)
      setLoading(false)
    },
    [category] // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    load()
  }, [load])

  return { options, loading, reload: () => load(true) }
}

export function labelize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
