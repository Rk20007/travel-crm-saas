import mongoose from 'mongoose'

/**
 * Owner-managed day-plan template, scoped to a workspace (team).
 * A reusable day block (title + distance + duration + description) that can
 * be applied to any itinerary day in the builder.
 */
const dayPlanTemplateSchema = new mongoose.Schema(
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
    /** e.g. "Day 1: Arrival" or "Sonmarg - Gulmarg | Via Drung Waterfall". */
    title: {
      type: String,
      required: true,
      trim: true,
    },
    /** Free text, e.g. "125-135 km (one way)". */
    distance: { type: String, trim: true },
    /** Free text, e.g. "4 hours". */
    duration: { type: String, trim: true },
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

dayPlanTemplateSchema.index({ teamId: 1, title: 1 })

export default mongoose.models.DayPlanTemplate ||
  mongoose.model('DayPlanTemplate', dayPlanTemplateSchema)
