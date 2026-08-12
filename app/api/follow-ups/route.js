import connectDB from '@/lib/mongodb'
import FollowUp from '@/models/FollowUp'
import Lead from '@/models/Lead'
import { authenticate } from '@/lib/middleware'
import { tenantFilter } from '@/lib/tenant'
import { canOnlyViewOwnLeads } from '@/lib/permissions'
import { enqueueFollowUpReminder } from '@/lib/queue/bull'
import mongoose from 'mongoose'

export async function GET(request) {
  try {
    await connectDB()

    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 10
    const status = searchParams.get('status')
    const leadId = searchParams.get('leadId')
    const overdue = searchParams.get('overdue') === 'true'

    const tf = tenantFilter(authResult.user)
    if (canOnlyViewOwnLeads(authResult.user.role)) {
      tf.assignedTo = new mongoose.Types.ObjectId(String(authResult.user.userId))
    }
    const leadIds = await Lead.distinct('_id', tf)
    const query = { leadId: { $in: leadIds } }
    if (status) query.status = status
    if (leadId) query.leadId = leadId
    const now = new Date()
    if (overdue) {
      query.scheduledDate = { $lt: now }
      query.status = 'pending'
    }

    const [totalFollowUps, followUps] = await Promise.all([
      FollowUp.countDocuments(query),
      FollowUp.find(query)
        .populate('leadId', 'firstName lastName email phone status destination')
        .populate('assignedTo', 'name email avatar')
        .sort({ scheduledDate: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ])

    return Response.json({
      success: true,
      followUps,
      pagination: {
        page,
        limit,
        total: totalFollowUps,
        pages: Math.ceil(totalFollowUps / limit),
      },
    })
  } catch (error) {
    console.error('Get follow-ups error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await connectDB()

    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { leadId, type, scheduledDate, description, priority } = body
    const assignedTo = body.assignedTo || authResult.user.userId

    if (!leadId || !type || !scheduledDate) {
      return Response.json(
        { error: 'Lead, type, and scheduled date are required' },
        { status: 400 }
      )
    }

    const lead = await Lead.findOne({
      _id: leadId,
      teamId: authResult.user.teamId,
    })

    if (!lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 })
    }

    const followUp = await FollowUp.create({
      leadId,
      assignedTo,
      type,
      scheduledDate,
      description,
      priority: priority || 'medium',
      teamId: authResult.user.teamId,
      brandId: lead.brandId,
    })

    await enqueueFollowUpReminder({
      followUpId: String(followUp._id),
      teamId: String(authResult.user.teamId),
      scheduledAt: new Date(scheduledDate),
    }).catch(() => {})

    return Response.json(
      {
        message: 'Follow-up created successfully',
        followUp,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create follow-up error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
