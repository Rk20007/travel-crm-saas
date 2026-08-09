import { logger } from '@/lib/logger'

const memory = new Map()

async function getRedis() {
  const url = process.env.REDIS_URL
  if (!url) return null
  try {
    const { default: Redis } = await import('ioredis')
    return new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true })
  } catch (e) {
    logger.warn('REDIS_URL set but ioredis unavailable; using in-memory rate limit')
    return null
  }
}

let redisPromise

/**
 * Fixed window rate limit. Keyed by identifier (e.g. IP or userId).
 * @returns {{ ok: boolean, remaining: number, reset: number }}
 */
export async function rateLimit(key, { windowMs = 60_000, max = 60 } = {}) {
  const now = Date.now()
  const redis = redisPromise ?? (redisPromise = getRedis())
  const client = await redis

  if (client) {
    const rkey = `rl:${key}`
    try {
      const n = await client.incr(rkey)
      if (n === 1) {
        await client.pexpire(rkey, windowMs)
      }
      const ttl = await client.pttl(rkey)
      const reset = now + (ttl > 0 ? ttl : windowMs)
      return { ok: n <= max, remaining: Math.max(0, max - n), reset }
    } catch (e) {
      logger.warn('Redis rate limit error, falling back to memory', e?.message)
    }
  }

  const bucketKey = `${key}:${Math.floor(now / windowMs)}`
  const entry = memory.get(bucketKey) || { count: 0, reset: Math.ceil((Math.floor(now / windowMs) + 1) * windowMs) }
  entry.count += 1
  memory.set(bucketKey, entry)
  if (memory.size > 10_000) {
    const cutoff = now - windowMs * 2
    for (const [k] of memory) {
      const parts = k.split(':')
      const slice = Number(parts[parts.length - 1])
      if (slice * windowMs < cutoff) memory.delete(k)
    }
  }
  return {
    ok: entry.count <= max,
    remaining: Math.max(0, max - entry.count),
    reset: entry.reset,
  }
}
