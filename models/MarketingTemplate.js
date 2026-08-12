import mongoose from 'mongoose'

/**
 * Owner-managed marketing overview template, scoped to a workspace (team).
 * A reusable welcome summary (title + body) selectable in the itinerary
 * builder's "Marketing overview" step.
 */
const marketingTemplateSchema = new mongoose.Schema(
  {
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
    /** e.g. "Kashmir welcome" or "Goa beach welcome". */
    title: {
      type: String,
      required: true,
      trim: true,
    },
    /** The welcome summary text applied to the itinerary cover and PDF. */
    description: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

marketingTemplateSchema.index({ teamId: 1, title: 1 })

export default mongoose.models.MarketingTemplate ||
  mongoose.model('MarketingTemplate', marketingTemplateSchema)
