import connectDB from '@/lib/mongodb'
import GoogleCampaignMapping from '@/models/GoogleCampaignMapping'
import Brand from '@/models/Brand'
import User from '@/models/User'
import { authenticate, requireRoles } from '@/lib/middleware'
import { recordAudit } from '@/lib/audit'
import { LEAD_ASSIGNABLE_ROLES } from '@/lib/permissions'
import mongoose from 'mongoose'

const OWNER_ROLES = ['admin', 'superadmin']

/** PATCH /api/integrations/google/mappings/[id] — edit fields, or flip status (enable/disable). */
export async function PATCH(request, { params }) {
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
    const body = await request.json()
    const mapping = await GoogleCampaignMapping.findOne({ _id: id, teamId: authResult.user.teamId })
    if (!mapping) return Response.json({ error: 'Mapping not found' }, { status: 404 })

    if (body.brandId !== undefined) {
      const brand = await Brand.findOne({ _id: body.brandId, teamId: authResult.user.teamId }).select('_id').lean()
      if (!brand) return Response.json({ error: 'CRM Company not found in this workspace' }, { status: 400 })
      mapping.brandId = body.brandId
    }
    if (body.ownerId !== undefined) {
      const owner = await User.findOne({
        _id: body.ownerId,
        teamId: authResult.user.teamId,
        role: { $in: [...LEAD_ASSIGNABLE_ROLES, 'admin'] },
        isActive: true,
      })
        .select('_id')
        .lean()
      if (!owner) return Response.json({ error: 'Owner not found or not assignable' }, { status: 400 })
      mapping.ownerId = body.ownerId
    }
    if (body.googleCampaignId !== undefined) mapping.googleCampaignId = body.googleCampaignId?.trim() || undefined
    if (body.googleCampaignName !== undefined) mapping.googleCampaignName = body.googleCampaignName?.trim() || undefined
    if (body.formId !== undefined) mapping.formId = body.formId?.trim() || undefined
    if (body.landingPageId !== undefined) mapping.landingPageId = body.landingPageId?.trim() || undefined
    if (body.status !== undefined && ['active', 'inactive'].includes(body.status)) mapping.status = body.status
    if (body.isDefault !== undefined) {
      if (body.isDefault) {
        await GoogleCampaignMapping.updateMany(
          { teamId: authResult.user.teamId, isDefault: true, _id: { $ne: mapping._id } },
          { $set: { isDefault: false } }
        )
      }
      mapping.isDefault = !!body.isDefault
    }

    await mapping.save()

    await recordAudit({
      teamId: authResult.user.teamId,
      entity: 'GoogleCampaignMapping',
      entityId: mapping._id,
      action: 'google_mapping_updated',
      summary: 'Updated a Google Ads campaign/form mapping',
      actor: { userId: authResult.user.userId, email: authResult.user.email },
    })

    return Response.json({ mapping })
  } catch (error) {
    console.error('Update Google mapping error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/integrations/google/mappings/[id] */
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
    const mapping = await GoogleCampaignMapping.findOneAndDelete({ _id: id, teamId: authResult.user.teamId })
    if (!mapping) return Response.json({ error: 'Mapping not found' }, { status: 404 })

    await recordAudit({
      teamId: authResult.user.teamId,
      entity: 'GoogleCampaignMapping',
      entityId: mapping._id,
      action: 'google_mapping_deleted',
      summary: 'Deleted a Google Ads campaign/form mapping',
      actor: { userId: authResult.user.userId, email: authResult.user.email },
    })

    return Response.json({ message: 'Deleted' })
  } catch (error) {
    console.error('Delete Google mapping error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
