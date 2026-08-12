import connectDB from '@/lib/mongodb'
import SettingOption from '@/models/SettingOption'
import { authenticate, requireRoles } from '@/lib/middleware'
import { ensureSeeded } from '@/lib/masters'
import { recordAudit } from '@/lib/audit'
import { getCategory, slugifyKey } from '@/lib/masterCategories'

const OWNER_ROLES = ['admin', 'superadmin']

/**
 * Owner master management.
 * GET  /api/settings/masters?category=lead_status   → full list (incl. inactive/archived)
 * POST /api/settings/masters                          → create option
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }
    const denied = requireRoles(authResult.user.role, OWNER_ROLES)
    if (denied) return Response.json({ error: denied.error }, { status: denied.status })

    await connectDB()
    const teamId = authResult.user.teamId
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    if (!category || !getCategory(category)) {
      return Response.json({ error: 'Invalid or missing category' }, { status: 400 })
    }

    await ensureSeeded(teamId, category, authResult.user.userId)
    const options = await SettingOption.find({ teamId, category })
      .sort({ order: 1, label: 1 })
      .lean()

    return Response.json({ category, options })
  } catch (error) {
    console.error('Get masters error:', error)
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
    const teamId = authResult.user.teamId
    const body = await request.json()
    const { category, label } = body

    if (!getCategory(category)) {
      return Response.json({ error: 'Invalid category' }, { status: 400 })
    }
    if (!label || !label.trim()) {
      return Response.json({ error: 'Label is required' }, { status: 400 })
    }

    const key = (body.key && slugifyKey(body.key)) || slugifyKey(label)
    if (!key) {
      return Response.json({ error: 'Could not derive a key from label' }, { status: 400 })
    }

    const exists = await SettingOption.findOne({ teamId, category, key })
    if (exists) {
      return Response.json({ error: 'An option with this key already exists' }, { status: 409 })
    }

    const last = await SettingOption.findOne({ teamId, category })
      .sort({ order: -1 })
      .select('order')
      .lean()

    const option = await SettingOption.create({
      teamId,
      brandId: authResult.user.brandId || undefined,
      category,
      key,
      label: label.trim(),
      description: body.description,
      color: body.color || '#64748b',
      icon: body.icon,
      order: body.order ?? (last ? last.order + 1 : 0),
      isActive: body.isActive !== false,
      metadata: body.metadata || {},
      createdBy: authResult.user.userId,
    })

    await recordAudit({
      teamId,
      entity: 'setting_option',
      entityCategory: category,
      entityId: option._id,
      action: 'create',
      summary: `Created "${option.label}" in ${category}`,
      changes: { after: option.toObject() },
      actor: authResult.user,
    })

    return Response.json({ option }, { status: 201 })
  } catch (error) {
    console.error('Create master error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
