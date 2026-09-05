import connectDB from '@/lib/mongodb'
import GoogleCampaignMapping from '@/models/GoogleCampaignMapping'
import Brand from '@/models/Brand'
import User from '@/models/User'
import { authenticate, requireRoles } from '@/lib/middleware'
import { recordAudit } from '@/lib/audit'
import { LEAD_ASSIGNABLE_ROLES } from '@/lib/permissions'

const OWNER_ROLES = ['admin', 'superadmin']

/** GET /api/integrations/google/mappings — every campaign/form/landing-page → company/owner mapping for this workspace. */
export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status })
    const denied = requireRoles(authResult.user.role, OWNER_ROLES)
    if (denied) return Response.json({ error: denied.error }, { status: denied.status })

    await connectDB()
    const mappings = await GoogleCampaignMapping.find({ teamId: authResult.user.teamId })
      .populate('brandId', 'name')
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 })
      .lean()

    return Response.json({ mappings })
  } catch (error) {
    console.error('List Google mappings error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function validateMappingBody(body, teamId) {
  if (!body.brandId) return 'CRM Company is required'
  if (!body.ownerId) return 'Owner is required'
  if (!body.googleCampaignId && !body.formId && !body.landingPageId && !body.isDefault) {
    return 'Provide at least a Campaign ID, Form ID, Landing Page ID, or mark this the workspace default'
  }
  const [brand, owner] = await Promise.all([
    Brand.findOne({ _id: body.brandId, teamId }).select('_id').lean(),
    User.findOne({
      _id: body.ownerId,
      teamId,
      role: { $in: [...LEAD_ASSIGNABLE_ROLES, 'admin'] },
      isActive: true,
    })
      .select('_id')
      .lean(),
  ])
  if (!brand) return 'CRM Company not found in this workspace'
  if (!owner) return 'Owner must be an active Sales Employee, Sales Lead, or Owner in this workspace'
  return null
}

/** POST /api/integrations/google/mappings — create a new mapping row. */
export async function POST(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status })
    const denied = requireRoles(authResult.user.role, OWNER_ROLES)
    if (denied) return Response.json({ error: denied.error }, { status: denied.status })

    await connectDB()
    const body = await request.json()
    const validationError = await validateMappingBody(body, authResult.user.teamId)
    if (validationError) return Response.json({ error: validationError }, { status: 400 })

    if (body.isDefault) {
      // At most one default per workspace — enforced here, not just in the
      // resolver, so the mapping list never shows two rows both claiming it.
      await GoogleCampaignMapping.updateMany(
        { teamId: authResult.user.teamId, isDefault: true },
        { $set: { isDefault: false } }
      )
    }

    const mapping = await GoogleCampaignMapping.create({
      teamId: authResult.user.teamId,
      googleIntegrationId: body.googleIntegrationId || undefined,
      googleCustomerId: body.googleCustomerId?.trim() || undefined,
      googleCampaignId: body.googleCampaignId?.trim() || undefined,
      googleCampaignName: body.googleCampaignName?.trim() || undefined,
      formId: body.formId?.trim() || undefined,
      landingPageId: body.landingPageId?.trim() || undefined,
      brandId: body.brandId,
      ownerId: body.ownerId,
      status: 'active',
      isDefault: !!body.isDefault,
      createdBy: authResult.user.userId,
    })

    await recordAudit({
      teamId: authResult.user.teamId,
      entity: 'GoogleCampaignMapping',
      entityId: mapping._id,
      action: 'google_mapping_created',
      summary: `Mapped Google Ads source (${mapping.googleCampaignId || mapping.formId || mapping.landingPageId || 'default'}) to a Company/Owner`,
      actor: { userId: authResult.user.userId, email: authResult.user.email },
    })

    return Response.json({ mapping }, { status: 201 })
  } catch (error) {
    console.error('Create Google mapping error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
