import connectDB from '@/lib/mongodb'
import FollowUp from '@/models/FollowUp'
import Lead from '@/models/Lead'
import { authenticate } from '@/lib/middleware'
import mongoose from 'mongoose'

export async function PATCH(request, { params }) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: 'Invalid follow-up ID' }, { status: 400 })
    }

    await connectDB()
    const body = await request.json()
    const leadIds = await Lead.distinct('_id', { teamId: authResult.user.teamId })

    const followUp = await FollowUp.findOneAndUpdate(
      { _id: id, leadId: { $in: leadIds } },
      {
        ...(body.status && { status: body.status }),
        ...(body.scheduledDate && { scheduledDate: new Date(body.scheduledDate) }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.priority && { priority: body.priority }),
        ...(body.status === 'completed' && { completedAt: new Date() }),
      },
      { new: true }
    )
      .populate('leadId', 'firstName lastName email phone')
      .populate('assignedTo', 'name email')

    if (!followUp) {
      return Response.json({ error: 'Follow-up not found' }, { status: 404 })
    }

    return Response.json({ followUp })
  } catch (error) {
    console.error('Update follow-up error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
