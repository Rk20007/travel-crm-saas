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
