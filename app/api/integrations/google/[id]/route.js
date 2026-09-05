import connectDB from '@/lib/mongodb'
import GoogleIntegration from '@/models/GoogleIntegration'
import { authenticate, requireRoles } from '@/lib/middleware'
import { recordAudit } from '@/lib/audit'
import mongoose from 'mongoose'

const OWNER_ROLES = ['admin', 'superadmin']

/** DELETE /api/integrations/google/[id] — disconnect one Google Ads account. */
export async function DELETE(request, { params }) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status })
    const denied = requireRoles(authResult.user.role, OWNER_ROLES)
    if (denied) return Response.json({ error: denied.error }, { status: denied.status })

    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: 'Invalid id' }, { status: 400 })
    }

    await connectDB()
    const integration = await GoogleIntegration.findOneAndDelete({
      _id: id,
      teamId: authResult.user.teamId,
    })
    if (!integration) return Response.json({ error: 'Not found' }, { status: 404 })

    await recordAudit({
      teamId: authResult.user.teamId,
      entity: 'GoogleIntegration',
      entityId: integration._id,
      action: 'google_ads_disconnected',
      summary: `Disconnected Google Ads account ${integration.googleCustomerId}`,
      actor: { userId: authResult.user.userId, email: authResult.user.email },
    })

    return Response.json({ message: 'Disconnected' })
  } catch (error) {
    console.error('Disconnect Google integration error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
