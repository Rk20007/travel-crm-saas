import connectDB from '@/lib/mongodb'
import Team from '@/models/Team'
import User from '@/models/User'
import RefreshToken from '@/models/RefreshToken'
import { recordAudit } from '@/lib/audit'

/**
 * Daily sweep — flips any agency whose subscriptionExpiresAt has passed to
 * suspended, so the platform's Agencies list shows "Suspended" on its own
 * instead of only finding out the next time someone from that agency tries
 * to log in (login/refresh already hard-block expired workspaces regardless
 * of this; this is purely so the list reflects reality without that trigger).
 *
 * Runs on Vercel Cron (see vercel.json) — Vercel calls this with
 * `Authorization: Bearer $CRON_SECRET` automatically. Also accepts the
 * `x-cron-secret` header used by this project's other cron endpoint, for
 * manual/external triggering.
 */
export async function GET(request) {
  try {
    const secret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization') || ''
    const bearerOk = secret && authHeader === `Bearer ${secret}`
    const headerOk = secret && request.headers.get('x-cron-secret') === secret
    if (!secret || (!bearerOk && !headerOk)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const now = new Date()

    const expired = await Team.find({
      isActive: { $ne: false },
      subscriptionExpiresAt: { $lte: now },
    })
      .select('_id name')
      .lean()

    let suspendedCount = 0
    for (const team of expired) {
      await Team.updateOne(
        { _id: team._id },
        {
          isActive: false,
          suspendedAt: now,
          suspensionReason: 'Subscription expired',
        }
      )
      const memberIds = await User.find({ teamId: team._id }).distinct('_id')
      await User.updateMany({ teamId: team._id }, { isActive: false })
      await RefreshToken.updateMany(
        { userId: { $in: memberIds }, revokedAt: null },
        { revokedAt: now }
      )
      await recordAudit({
        scope: 'platform',
        teamId: team._id,
        entity: 'agency',
        entityId: team._id,
        action: 'suspend',
        summary: `Auto-suspended agency "${team.name}" — subscription expired`,
      })
      suspendedCount += 1
    }

    return Response.json({ message: 'Subscription expiry sweep complete', suspendedCount })
  } catch (error) {
    console.error('Subscription expiry cron error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
