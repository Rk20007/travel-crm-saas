import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import Brand from '@/models/Brand'
import { authenticate } from '@/lib/middleware'
import { generateToken } from '@/lib/auth'
import { buildAccessPayload, publicUser } from '@/lib/session'
import mongoose from 'mongoose'

export async function PATCH(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const brandId = body?.brandId
    await connectDB()

    // Only the Owner (or platform superadmin) may view the whole workspace —
    // everyone else must stay scoped to a single brand, otherwise sales staff
    // could pick "all brands" and see every other brand's leads/hotels/etc.
    const canViewAllBrands = authResult.user.role === 'admin' || authResult.user.role === 'superadmin'
    if (!brandId && !canViewAllBrands) {
      return Response.json({ error: 'Select a brand — only the owner can view all brands' }, { status: 403 })
    }

    if (!brandId) {
      await User.updateOne({ _id: authResult.user.userId }, { $unset: { activeBrandId: 1 } })
      const u = await User.findById(authResult.user.userId)
      const token = u ? generateToken(buildAccessPayload(u)) : null
      return Response.json({
        message: 'Viewing all brands in workspace',
        activeBrandId: null,
        token,
        user: u ? publicUser(u) : null,
      })
    }

    if (!mongoose.Types.ObjectId.isValid(brandId)) {
      return Response.json({ error: 'Invalid brandId' }, { status: 400 })
    }

    const brand = await Brand.findOne({
      _id: brandId,
      teamId: authResult.user.teamId,
      isActive: true,
    })
    if (!brand) {
      return Response.json({ error: 'Brand not found' }, { status: 404 })
    }

    await User.updateOne({ _id: authResult.user.userId }, { activeBrandId: brand._id })
    const u = await User.findById(authResult.user.userId)
    const token = u ? generateToken(buildAccessPayload(u)) : null

    return Response.json({
      message: 'Active brand updated',
      activeBrandId: brand._id,
      brand,
      token,
      user: u ? publicUser(u) : null,
    })
  } catch (error) {
    console.error('Set active brand error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
