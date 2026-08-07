import Notification from '@/models/Notification'
import User from '@/models/User'
import mongoose from 'mongoose'

/**
 * Notify sales employee when a new lead is assigned.
 */
export async function notifyLeadAssigned({ lead, teamId }) {
  if (!lead?.assignedTo) return

  const assigneeId = new mongoose.Types.ObjectId(String(lead.assignedTo))
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'New lead'
  const location = lead.city || lead.destination || ''
  const packageHint = lead.destination ? ` · ${lead.destination}` : ''

  await Notification.create({
    userId: assigneeId,
    teamId,
    type: 'lead_assigned',
    title: 'New Lead Assigned',
    message: `${name}${location ? ` — ${location}` : ''}${packageHint}`,
    relatedId: lead._id,
    relatedModel: 'Lead',
    priority: 'high',
    action: {
      text: 'Open lead',
      link: `/dashboard/leads/${lead._id}`,
    },
  }).catch(() => {})

  const assignee = await User.findById(assigneeId).select('preferences').lean()
  // Email/SMS can be wired here when provider keys are configured
  if (assignee?.preferences?.notifications?.email) {
    /* future: sendEmail(assignee, ...) */
  }
}
