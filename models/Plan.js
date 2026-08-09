import mongoose from 'mongoose'

/**
 * Subscription plan definition, managed by the platform super admin.
 *
 * Seeded from the hardcoded defaults in lib/plans.js the first time the
 * super admin panel loads, after which the DB is the source of truth. A
 * single agency can still deviate via `Team.planOverrides`.
 */
const planSchema = new mongoose.Schema(
  {
    /** Stable identifier stored on Team.plan, e.g. 'basic'. */
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    priceMonthly: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    limits: {
      maxBrands: { type: Number, default: 1, min: 0 },
      maxAgents: { type: Number, default: 3, min: 0 },
      maxLeadsPerMonth: { type: Number, default: 500, min: 0 },
      automation: { type: Boolean, default: false },
      whatsappAutomation: { type: Boolean, default: false },
      apiIngest: { type: Boolean, default: false },
    },
    /** Inactive plans stay valid for agencies already on them, but can't be newly assigned. */
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
)

planSchema.index({ sortOrder: 1, key: 1 })

export default mongoose.models.Plan || mongoose.model('Plan', planSchema)
