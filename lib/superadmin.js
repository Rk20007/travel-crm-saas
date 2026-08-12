import { authenticate } from '@/lib/middleware'
import { recordAudit } from '@/lib/audit'

/**
 * Guard for every /api/superadmin/* route.
 *
 * Returns `{ error, status }` on rejection, or `{ user }` on success.
 *
 * Impersonation tokens are rejected outright even when the impersonated user
 * somehow carries an elevated role: once a session is acting as somebody else
 * it must never be able to reach back into platform administration (and it
 * must not be able to chain a second impersonation hop).
 */
export async function requireSuperadmin(request) {
  const authResult = await authenticate(request)
  if (authResult.error) {
    return { error: authResult.error, status: authResult.status }
  }

  const user = authResult.user
  if (user.imp) {
    return { error: 'Not available while impersonating', status: 403 }
  }
  if (user.role !== 'superadmin') {
    return { error: 'Super admin access required', status: 403 }
  }

  return { user }
}

/** Convenience: turn a guard rejection into a Response. */
export function denied(guard) {
  return Response.json({ error: guard.error }, { status: guard.status })
}

/**
 * Write a platform-scope audit entry.
 *
 * @param {object} actor       - decoded superadmin JWT payload
 * @param {object} entry       - { entity, entityId, action, summary, changes, teamId }
 */
export async function recordPlatformAudit(actor, entry) {
  await recordAudit({
    ...entry,
    scope: 'platform',
    actor: {
      userId: actor?.userId,
      name: actor?.name || actor?.email,
      email: actor?.email,
    },
  })
}

/** Escape user input before using it inside a RegExp search filter. */
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Shared paging parser for list endpoints. */
export function parsePaging(searchParams, { defaultLimit = 25, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const rawLimit = Number(searchParams.get('limit')) || defaultLimit
  const limit = Math.min(maxLimit, Math.max(1, rawLimit))
  return { page, limit, skip: (page - 1) * limit }
}
