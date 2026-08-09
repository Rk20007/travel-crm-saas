import connectDB from '@/lib/mongodb'
import { authenticate } from '@/lib/middleware'
import { recordAudit } from '@/lib/audit'

/**
 * POST /api/superadmin/impersonate/stop — close the audit trail for a support
 * session.
 *
 * Authenticated with the *impersonation* token (the caller is currently acting
 * as the target user), so this uses plain `authenticate` rather than the
 * superadmin guard, and reads the original admin's identity from the `imp`
 * claim. The client then discards the token and restores the stashed one.
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const { imp, email, teamId, userId } = authResult.user
    if (!imp) {
      return Response.json({ error: 'Not an impersonation session' }, { status: 400 })
    }

    await connectDB()
    await recordAudit({
      teamId,
      scope: 'platform',
      entity: 'impersonation',
      entityId: userId,
      action: 'impersonate_stop',
      summary: `${imp.byEmail} stopped impersonating ${email}`,
      actor: { userId: imp.by, email: imp.byEmail, name: imp.byEmail },
    })

    return Response.json({ message: 'Impersonation ended' })
  } catch (error) {
    console.error('Impersonation stop error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
