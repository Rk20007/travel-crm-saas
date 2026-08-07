import mongoose from 'mongoose'

const leadTimelineSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
    },
    type: {
      type: String,
      enum: ['note', 'call', 'follow_up', 'status_change', 'assignment', 'whatsapp', 'email', 'system'],
      required: true,
    },
    title: String,
    body: String,
    metadata: mongoose.Schema.Types.Mixed,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    callDurationSec: Number,
    callOutcome: {
      type: String,
      enum: ['connected', 'no_answer', 'busy', 'voicemail', 'wrong_number', 'other'],
    },
  },
  { timestamps: true }
)

leadTimelineSchema.index({ leadId: 1, createdAt: -1 })

export default mongoose.models.LeadTimeline || mongoose.model('LeadTimeline', leadTimelineSchema)
