import User from '@/models/User'
import Team from '@/models/Team'
import mongoose from 'mongoose'
import { LEAD_ASSIGNABLE_ROLES } from '@/lib/permissions'

/**
 * Build weighted pool: user with weight 3 appears 3 times in the ring.
 * Weight 0 = excluded (e.g. employee in training).
 */
function buildWeightedPool(candidates) {
  const pool = []
  for (const c of candidates) {
    const w = Math.max(0, c.leadAssignmentWeight ?? 1)
    for (let i = 0; i < w; i++) {
      pool.push(c._id)
    }
  }
  return pool
}

/**
 * Pick next assignee using weighted round-robin among sales employees.
 */
export async function assignLeadRoundRobin(teamId) {
  const tid = new mongoose.Types.ObjectId(String(teamId))
  const candidates = await User.find({
    teamId: tid,
    isActive: true,
    isBlocked: false,
    role: { $in: LEAD_ASSIGNABLE_ROLES },
    leadAssignmentWeight: { $gt: 0 },
  })
    .sort({ _id: 1 })
    .select('_id leadAssignmentWeight')
    .lean()

  if (!candidates.length) {
    return null
  }

  const pool = buildWeightedPool(candidates)
  if (!pool.length) return null

  const team = await Team.findById(tid).select('leadRoundRobinIndex')
  if (!team) return null

  const idx = (team.leadRoundRobinIndex || 0) % pool.length
  const assignee = pool[idx]

  team.leadRoundRobinIndex = (team.leadRoundRobinIndex || 0) + 1
  await team.save()

  return assignee
}

/**
 * Plain (unweighted) round-robin among all active users of a given role —
 * used to hand a new booking to exactly one Operations person and one
 * Accounts person, instead of every teammate in that role seeing it.
 */
export async function assignByRoleRoundRobin(teamId, role, indexField) {
  const tid = new mongoose.Types.ObjectId(String(teamId))
  const candidates = await User.find({
    teamId: tid,
    isActive: true,
    isBlocked: false,
    role,
  })
    .sort({ _id: 1 })
    .select('_id')
    .lean()

  if (!candidates.length) return null

  const team = await Team.findById(tid).select(indexField)
  if (!team) return null

  const idx = (team[indexField] || 0) % candidates.length
  const assignee = candidates[idx]._id

  team[indexField] = (team[indexField] || 0) + 1
  await team.save()

  return assignee
}

export { buildWeightedPool }
