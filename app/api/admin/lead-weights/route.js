import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import { authenticate, requireRoles } from '@/lib/middleware'
import mongoose from 'mongoose'

/** GET lead distribution weights for sales team */
export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, ['superadmin', 'admin'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const users = await User.find({
      teamId: authResult.user.teamId,
      role: { $in: ['agent', 'manager'] },
    })
      .select('name email role leadAssignmentWeight isActive isBlocked')
      .sort({ name: 1 })
      .lean()

    return Response.json({ weights: users })
  } catch (error) {
    console.error('Lead weights GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** PATCH update lead assignment weights — weight 0 pauses new lead assignment */
export async function PATCH(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, ['superadmin', 'admin'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    const body = await request.json()
    const { weights } = body
    if (!Array.isArray(weights)) {
      return Response.json({ error: 'weights array required' }, { status: 400 })
    }

    await connectDB()

    const valid = weights
      .filter((w) => w.userId && mongoose.Types.ObjectId.isValid(w.userId))
      .map((w) => ({
        userId: w.userId,
        weight: Math.max(0, Math.min(10, Number(w.weight) ?? 1)),
      }))

    if (valid.length) {
      await User.bulkWrite(
        valid.map((w) => ({
          updateOne: {
            filter: {
              _id: w.userId,
              teamId: authResult.user.teamId,
              role: { $in: ['agent', 'manager'] },
            },
            update: { $set: { leadAssignmentWeight: w.weight } },
          },
        }))
      )
    }

    const updatedUsers = await User.find({
      _id: { $in: valid.map((w) => w.userId) },
      teamId: authResult.user.teamId,
    })
      .select('name')
      .lean()
    const nameById = new Map(updatedUsers.map((u) => [String(u._id), u.name]))
    const updates = valid
      .filter((w) => nameById.has(String(w.userId)))
      .map((w) => ({ userId: w.userId, name: nameById.get(String(w.userId)), weight: w.weight }))

    return Response.json({ message: 'Weights updated', updates })
  } catch (error) {
    console.error('Lead weights PATCH error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
