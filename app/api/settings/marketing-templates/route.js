import connectDB from '@/lib/mongodb'
import MarketingTemplate from '@/models/MarketingTemplate'
import { authenticate, requireRoles } from '@/lib/middleware'
import { recordAudit } from '@/lib/audit'
import { tenantFilter } from '@/lib/tenant'

const OWNER_ROLES = ['admin', 'superadmin']

/**
 * GET /api/settings/marketing-templates?search=
 * Readable by any authenticated user (used in itinerary builder);
 * writes are owner-only.
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    await connectDB()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()
    const includeArchived = searchParams.get('includeArchived') === '1'

    const query = { ...tenantFilter(authResult.user) }
    if (!includeArchived) query.isArchived = false
    if (search) {
      query.title = { $regex: search, $options: 'i' }
    }

    const templates = await MarketingTemplate.find(query).sort({ title: 1 }).lean()
    return Response.json({ templates })
  } catch (error) {
    console.error('List marketing templates error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }
    const denied = requireRoles(authResult.user.role, OWNER_ROLES)
    if (denied) return Response.json({ error: denied.error }, { status: denied.status })

    await connectDB()
    const body = await request.json()
    if (!body.title || !body.title.trim()) {
      return Response.json({ error: 'Template title is required' }, { status: 400 })
    }

    const template = await MarketingTemplate.create({
      teamId: authResult.user.teamId,
      brandId: authResult.user.brandId || undefined,
      title: body.title.trim(),
      description: body.description,
      createdBy: authResult.user.userId,
    })

    await recordAudit({
      teamId: authResult.user.teamId,
      entity: 'marketing_template',
      entityId: template._id,
      action: 'create',
      summary: `Added marketing template "${template.title}"`,
      actor: authResult.user,
    })

    return Response.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Create marketing template error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
