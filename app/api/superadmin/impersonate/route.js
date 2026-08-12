import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import Team from '@/models/Team'
import { generateToken } from '@/lib/auth'
import { buildAccessPayload, publicUser } from '@/lib/session'
import { requireSuperadmin, denied, recordPlatformAudit } from '@/lib/superadmin'

/** Impersonation sessions are deliberately short and non-renewable. */
const IMPERSONATION_TTL = '30m'
const IMPERSONATION_TTL_SECONDS = 30 * 60

/**
 * POST /api/superadmin/impersonate — start a support session as an agency user.
 *
 * Body: `{ userId }`, or `{ teamId }` to assume that agency's owner.
 *
 * Returns an access token only — no refresh token — so the session cannot be
 * silently extended and dies within 30 minutes even if the tab stays open.
 */
export async function POST(request) {
  try {
    const guard = await requireSuperadmin(request)
    if (guard.error) return denied(guard)

    const body = await request.json().catch(() => ({}))
    await connectDB()

    let target = null
    if (body?.userId) {
      if (!mongoose.Types.ObjectId.isValid(body.userId)) {
        return Response.json({ error: 'Invalid userId' }, { status: 400 })
      }
      target = await User.findById(body.userId)
    } else if (body?.teamId) {
      if (!mongoose.Types.ObjectId.isValid(body.teamId)) {
        return Response.json({ error: 'Invalid teamId' }, { status: 400 })
      }
      const team = await Team.findById(body.teamId).select('owner').lean()
      if (!team) {
        return Response.json({ error: 'Agency not found' }, { status: 404 })
      }
      target = await User.findById(team.owner)
    } else {
      return Response.json({ error: 'userId or teamId is required' }, { status: 400 })
    }

    if (!target) {
      return Response.json({ error: 'Target user not found' }, { status: 404 })
    }
    if (target.role === 'superadmin') {
      return Response.json({ error: 'Super admins cannot be impersonated' }, { status: 403 })
    }
    if (target.isBlocked) {
      return Response.json({ error: 'That user is blocked — unblock them first' }, { status: 409 })
    }
    if (!target.teamId) {
      return Response.json({ error: 'That user does not belong to an agency' }, { status: 409 })
    }

    const team = await Team.findById(target.teamId).select('name').lean()

    const token = generateToken(buildAccessPayload(target, guard.user), IMPERSONATION_TTL)

    await recordPlatformAudit(guard.user, {
      teamId: target.teamId,
      entity: 'impersonation',
      entityId: target._id,
      action: 'impersonate_start',
      summary: `${guard.user.email} started impersonating ${target.email} (${team?.name || 'unknown agency'})`,
      changes: { targetRole: target.role, agency: team?.name },
    })

    return Response.json({
      message: 'Impersonation started',
      token,
      user: publicUser(target),
      impersonating: {
        targetUserId: String(target._id),
        targetName: target.name,
        targetEmail: target.email,
        targetRole: target.role,
        agencyId: String(target.teamId),
        agencyName: team?.name || null,
        byEmail: guard.user.email,
        startedAt: new Date().toISOString(),
        expiresInSeconds: IMPERSONATION_TTL_SECONDS,
      },
    })
  } catch (error) {
    console.error('Impersonation start error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
