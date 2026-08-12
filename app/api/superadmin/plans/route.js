import connectDB from '@/lib/mongodb'
import Plan from '@/models/Plan'
import Team from '@/models/Team'
import { requireSuperadmin, denied, recordPlatformAudit } from '@/lib/superadmin'
import { sanitizeLimits, seedDefaultPlans } from '@/lib/plans'

export async function GET(request) {
  try {
    const guard = await requireSuperadmin(request)
    if (guard.error) return denied(guard)

    await connectDB()
    await seedDefaultPlans()

    const plans = await Plan.find({}).sort({ sortOrder: 1, key: 1 }).lean()
    const usage = await Team.aggregate([{ $group: { _id: '$plan', n: { $sum: 1 } } }])
    const usageMap = Object.fromEntries(usage.map((r) => [r._id || 'basic', r.n]))

    return Response.json({
      plans: plans.map((p) => ({ ...p, agencyCount: usageMap[p.key] || 0 })),
    })
  } catch (error) {
    console.error('Superadmin plans list error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const guard = await requireSuperadmin(request)
    if (guard.error) return denied(guard)

    const body = await request.json()
    const key = String(body?.key || '').trim().toLowerCase()
    const name = String(body?.name || '').trim()

    if (!/^[a-z0-9_-]{2,32}$/.test(key)) {
      return Response.json(
        { error: 'key must be 2-32 chars, lowercase letters/numbers/dash/underscore' },
        { status: 400 }
      )
    }
    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 })
    }

    await connectDB()
    if (await Plan.exists({ key })) {
      return Response.json({ error: 'A plan with that key already exists' }, { status: 409 })
    }

    const plan = await Plan.create({
      key,
      name,
      description: body?.description || '',
      priceMonthly: Math.max(0, Number(body?.priceMonthly) || 0),
      currency: body?.currency || 'INR',
      limits: sanitizeLimits(body?.limits),
      isActive: body?.isActive !== false,
      sortOrder: Number(body?.sortOrder) || 0,
    })

    await recordPlatformAudit(guard.user, {
      entity: 'plan',
      entityId: plan._id,
      action: 'create',
      summary: `Created plan "${plan.name}" (${plan.key})`,
      changes: { after: plan.toObject() },
    })

    return Response.json({ message: 'Plan created', plan }, { status: 201 })
  } catch (error) {
    console.error('Superadmin plan create error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const guard = await requireSuperadmin(request)
    if (guard.error) return denied(guard)

    const body = await request.json()
    const key = String(body?.key || '').trim().toLowerCase()
    if (!key) {
      return Response.json({ error: 'key is required' }, { status: 400 })
    }

    await connectDB()
    const plan = await Plan.findOne({ key })
    if (!plan) {
      return Response.json({ error: 'Plan not found' }, { status: 404 })
    }

    const before = plan.toObject()

    if (typeof body.name === 'string' && body.name.trim()) plan.name = body.name.trim()
    if (typeof body.description === 'string') plan.description = body.description
    if (body.priceMonthly !== undefined) plan.priceMonthly = Math.max(0, Number(body.priceMonthly) || 0)
    if (typeof body.currency === 'string' && body.currency.trim()) plan.currency = body.currency.trim()
    if (typeof body.isActive === 'boolean') plan.isActive = body.isActive
    if (body.sortOrder !== undefined) plan.sortOrder = Number(body.sortOrder) || 0
    if (body.limits) {
      const patch = sanitizeLimits(body.limits)
      for (const [k, v] of Object.entries(patch)) plan.limits[k] = v
    }

    await plan.save()

    await recordPlatformAudit(guard.user, {
      entity: 'plan',
      entityId: plan._id,
      action: 'update',
      summary: `Updated plan "${plan.name}" (${plan.key})`,
      changes: { before, after: plan.toObject() },
    })

    return Response.json({ message: 'Plan updated', plan })
  } catch (error) {
    console.error('Superadmin plan update error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const guard = await requireSuperadmin(request)
    if (guard.error) return denied(guard)

    const { searchParams } = new URL(request.url)
    const key = String(searchParams.get('key') || '').trim().toLowerCase()
    if (!key) {
      return Response.json({ error: 'key is required' }, { status: 400 })
    }

    await connectDB()

    // Deleting a plan that agencies are still on would silently drop them to
    // the code-default limits, so require them to be migrated off first.
    const inUse = await Team.countDocuments({ plan: key })
    if (inUse > 0) {
      return Response.json(
        { error: `${inUse} agenc${inUse === 1 ? 'y is' : 'ies are'} still on this plan — move them first` },
        { status: 409 }
      )
    }

    const plan = await Plan.findOneAndDelete({ key })
    if (!plan) {
      return Response.json({ error: 'Plan not found' }, { status: 404 })
    }

    await recordPlatformAudit(guard.user, {
      entity: 'plan',
      entityId: plan._id,
      action: 'delete',
      summary: `Deleted plan "${plan.name}" (${plan.key})`,
      changes: { before: plan.toObject() },
    })

    return Response.json({ message: 'Plan deleted' })
  } catch (error) {
    console.error('Superadmin plan delete error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
