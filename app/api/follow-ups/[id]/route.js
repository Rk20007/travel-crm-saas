import connectDB from '@/lib/mongodb'
import FollowUp from '@/models/FollowUp'
import Lead from '@/models/Lead'
import LeadTimeline from '@/models/LeadTimeline'
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

    // A remark entered here (Sales actioning a follow-up) should be visible
    // in the lead's Activity Timeline alongside notes and status changes —
    // otherwise remark history only ever lived on the Follow-ups list.
    if (body.description !== undefined && body.description.trim()) {
      await LeadTimeline.create({
        leadId: followUp.leadId?._id || followUp.leadId,
        teamId: followUp.teamId,
        type: 'follow_up',
        title: body.status === 'completed' ? 'Follow-up completed' : 'Follow-up remark',
        body: body.description.trim(),
        metadata: { followUpId: followUp._id },
        createdBy: authResult.user.userId,
      }).catch(() => {})
    }

    return Response.json({ followUp })
  } catch (error) {
    console.error('Update follow-up error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
