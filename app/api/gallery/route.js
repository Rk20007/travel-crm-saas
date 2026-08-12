import connectDB from '@/lib/mongodb'
import Brand from '@/models/Brand'
import { authenticate } from '@/lib/middleware'
import { MASTER_GALLERY } from '@/lib/data/masterRepository'
import mongoose from 'mongoose'

export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.toLowerCase() || ''

    await connectDB()
    const teamId = new mongoose.Types.ObjectId(String(authResult.user.teamId))
    let brand = await Brand.findOne({ teamId, isDefault: true }).lean()
    if (!brand) {
      brand = await Brand.findOne({ teamId }).sort({ createdAt: 1 }).lean()
    }

    // Once the owner has curated their own gallery in Settings, use that
    // exclusively. New workspaces fall back to the stock photo set so the
    // builder isn't empty on day one.
    let items = brand?.gallery?.length
      ? brand.gallery.map((g) => ({ id: String(g._id), url: g.url, label: g.label || '', tags: [] }))
      : MASTER_GALLERY

    if (q) {
      items = items.filter(
        (g) => g.label.toLowerCase().includes(q) || g.tags.some((t) => t.includes(q))
      )
    }

    return Response.json({ gallery: items })
  } catch (error) {
    console.error('Gallery list error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
