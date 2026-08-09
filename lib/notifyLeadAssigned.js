import User from '@/models/User'
import { notifyUser } from '@/lib/notify'
import mongoose from 'mongoose'

/**
 * Notify sales employee when a new lead is assigned, and the agency owner
 * that a new lead came in — both as in-app notifications and browser push
 * (phone + laptop) so nobody has to keep the CRM tab open to see it.
 */
export async function notifyLeadAssigned({ lead, teamId }) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'New lead'
  const location = lead.city || lead.destination || ''
  const packageHint = lead.destination ? ` · ${lead.destination}` : ''
  const summary = `${name}${location ? ` — ${location}` : ''}${packageHint}`

  if (lead.assignedTo) {
    const assigneeId = new mongoose.Types.ObjectId(String(lead.assignedTo))
    await notifyUser({
      userId: assigneeId,
      teamId,
      type: 'lead_assigned',
      title: 'New Lead Assigned',
      message: summary,
      relatedId: lead._id,
      relatedModel: 'Lead',
      priority: 'high',
      action: { text: 'Open lead', link: `/dashboard/leads/${lead._id}` },
    })

    const assignee = await User.findById(assigneeId).select('preferences').lean()
    // Email/SMS can be wired here when provider keys are configured
    if (assignee?.preferences?.notifications?.email) {
      /* future: sendEmail(assignee, ...) */
    }
  }

  // The owner should know a lead came in even if they didn't pick it up
  // themselves. Skip it when the owner *is* the assignee — they already got
  // the "assigned" notification above and don't need a duplicate.
  const owners = await User.find({ teamId, role: 'admin', isActive: true }).select('_id').lean()
  const assigneeStr = lead.assignedTo ? String(lead.assignedTo) : null
  await Promise.all(
    owners
      .filter((owner) => String(owner._id) !== assigneeStr)
      .map((owner) =>
      notifyUser({
        userId: owner._id,
        teamId,
        type: 'lead_assigned',
        title: 'New Lead',
        message: summary,
        relatedId: lead._id,
        relatedModel: 'Lead',
        priority: 'normal',
        action: { text: 'Open lead', link: `/dashboard/leads/${lead._id}` },
      })
    )
  )
}
