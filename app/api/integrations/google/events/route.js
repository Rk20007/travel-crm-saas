import connectDB from '@/lib/mongodb'
import GoogleLeadEvent from '@/models/GoogleLeadEvent'
import { authenticate, requireRoles } from '@/lib/middleware'

const OWNER_ROLES = ['admin', 'superadmin']

/**
 * GET /api/integrations/google/events?status=unmapped
 * Every inbound Google lead delivery, so an unmapped or failed one is never
 * just lost — an owner can see exactly what came in, from where, and why it
 * didn't turn into an assigned lead.
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status })
    const denied = requireRoles(authResult.user.role, OWNER_ROLES)
    if (denied) return Response.json({ error: denied.error }, { status: denied.status })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

    await connectDB()
    const query = { teamId: authResult.user.teamId }
    if (status) query.status = status

    const events = await GoogleLeadEvent.find(query)
      .select('-rawPayload') // raw payload can be large; fetched separately only if needed
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    return Response.json({ events })
  } catch (error) {
    console.error('List Google lead events error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
