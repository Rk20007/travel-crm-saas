import mongoose from 'mongoose'

/**
 * Build MongoDB filter for workspace (team) + optional brand scope.
 * @param {object} authUser - decoded JWT user (teamId, brandId)
 */
export function tenantFilter(authUser) {
  const q = { teamId: new mongoose.Types.ObjectId(String(authUser.teamId)) }
  if (authUser.brandId) {
    q.brandId = new mongoose.Types.ObjectId(String(authUser.brandId))
  }
  return q
}

/**
 * Read-only variant of tenantFilter() for shared catalog data (hotels,
 * vehicles, activities, day-plan templates, marketing templates) that any
 * salesperson can be shown regardless of which single brand they're scoped
 * to. Plain tenantFilter() requires an exact brandId match, so anything the
 * owner added while viewing "All brands" (no brandId set at all) becomes
 * invisible to every brand-scoped user — the owner sees everything, a
 * salesperson pinned to one brand sees only the subset that happens to carry
 * their brandId. Here, a brand-scoped user instead sees their own brand's
 * items PLUS every workspace-wide item that has no brandId.
 * @param {object} authUser - decoded JWT user (teamId, brandId)
 */
export function tenantReadFilter(authUser) {
  const q = { teamId: new mongoose.Types.ObjectId(String(authUser.teamId)) }
  if (authUser.brandId) {
    const brandId = new mongoose.Types.ObjectId(String(authUser.brandId))
    q.$or = [{ brandId }, { brandId: null }, { brandId: { $exists: false } }]
  }
  return q
}

/**
 * Merge tenant scope into an update body (strip client-supplied teamId).
 */
export function withTenantBody(authUser, body) {
  const { teamId: _t, brandId: _b, ...rest } = body || {}
  const out = { ...rest, teamId: authUser.teamId }
  if (authUser.brandId) {
    out.brandId = authUser.brandId
  }
  return out
}
