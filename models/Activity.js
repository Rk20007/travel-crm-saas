import mongoose from 'mongoose'

/**
 * Owner-managed activity master, scoped to a workspace (team).
 * Selectable in the itinerary builder day plan.
 */
const activitySchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    /** Free text, e.g. "2 hours", "Half day", "Full day". */
    duration: {
      type: String,
      trim: true,
    },
    price: { type: Number, min: 0 },
    priceCurrency: { type: String, default: 'INR' },
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

activitySchema.index({ teamId: 1, name: 1 })

export default mongoose.models.Activity || mongoose.model('Activity', activitySchema)
