import mongoose from 'mongoose'
import connectDB from '@/lib/mongodb'
import DemoRequest from '@/models/DemoRequest'
import { requireSuperadmin, denied } from '@/lib/superadmin'

const STATUSES = ['new', 'contacted', 'converted', 'dismissed']

export async function PATCH(request, { params }) {
  try {
    const guard = await requireSuperadmin(request)
    if (guard.error) return denied(guard)

    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: 'Invalid id' }, { status: 400 })
    }

    const body = await request.json()
    if (!STATUSES.includes(body?.status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 })
    }

    await connectDB()
    const updated = await DemoRequest.findByIdAndUpdate(
      id,
      { status: body.status },
      { new: true }
    )
    if (!updated) {
      return Response.json({ error: 'Demo request not found' }, { status: 404 })
    }

    return Response.json({ message: 'Updated', request: updated })
  } catch (error) {
    console.error('Demo request update error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
