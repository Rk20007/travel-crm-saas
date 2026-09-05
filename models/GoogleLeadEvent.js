import mongoose from 'mongoose'

/**
 * A durable log of every inbound Google lead event (Lead Form webhook +
 * landing-page/website form submits) — separate from AuditLog (which is for
 * admin actions, not raw inbound payloads). Exists so a failed/unmapped
 * delivery is never silently lost: it's always here, with the raw payload,
 * for an admin to inspect and (for 'unmapped') manually resolve.
 */
const googleLeadEventSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      index: true,
    },
    source: {
      type: String,
      enum: ['google_lead_form', 'google_landing_page'],
      required: true,
    },
    googleSubmissionId: { type: String, index: true },
    googleCampaignId: String,
    googleCustomerId: String,
    formId: String,
    landingPageId: String,
    status: {
      type: String,
      enum: ['processed', 'duplicate', 'unmapped', 'error'],
      required: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
    },
    error: String,
    rawPayload: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
)

googleLeadEventSchema.index({ teamId: 1, createdAt: -1 })
googleLeadEventSchema.index({ googleSubmissionId: 1 })
googleLeadEventSchema.index({ status: 1, createdAt: -1 })

export default mongoose.models.GoogleLeadEvent ||
  mongoose.model('GoogleLeadEvent', googleLeadEventSchema)
