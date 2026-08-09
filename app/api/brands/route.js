import connectDB from '@/lib/mongodb'
import Brand from '@/models/Brand'
import Team from '@/models/Team'
import { authenticate, requireRoles } from '@/lib/middleware'
import { getPlanLimits } from '@/lib/plans'

export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    await connectDB()
    const brands = await Brand.find({ teamId: authResult.user.teamId, isActive: true }).sort({
      isDefault: -1,
      name: 1,
    })

    return Response.json({ brands })
  } catch (error) {
    console.error('List brands error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, ['superadmin', 'admin', 'manager'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const team = await Team.findById(authResult.user.teamId)
    if (!team) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const limits = getPlanLimits(team.plan || 'basic')
    const existing = await Brand.countDocuments({
      teamId: team._id,
      isActive: true,
    })
    if (existing >= limits.maxBrands) {
      return Response.json(
        {
          error: `Plan limit reached (${limits.maxBrands} brands for ${team.plan}). Upgrade to add more.`,
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const name = body?.name?.trim()
    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 })
    }

    const brand = await Brand.create({
      teamId: team._id,
      name,
      slug: body?.slug?.trim(),
      logo: body?.logo,
      website: body?.website,
    })

    return Response.json({ brand }, { status: 201 })
  } catch (error) {
    console.error('Create brand error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
