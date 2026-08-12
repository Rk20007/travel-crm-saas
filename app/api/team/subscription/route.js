import connectDB from '@/lib/mongodb'
import Team from '@/models/Team'
import { authenticate, requireRoles } from '@/lib/middleware'

/**
 * GET — the agency's own subscription status, for the owner only (not staff
 * they've added). Used to show a "days left" notice in Settings.
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, ['admin'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const team = await Team.findById(authResult.user.teamId)
      .select('subscriptionStatus subscriptionExpiresAt isActive')
      .lean()
    if (!team) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 })
    }

    return Response.json({
      subscriptionStatus: team.subscriptionStatus,
      subscriptionExpiresAt: team.subscriptionExpiresAt,
      isActive: team.isActive,
    })
  } catch (error) {
    console.error('Team subscription fetch error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
