import mongoose from 'mongoose'

/**
 * One route offered for a vehicle, with separate AC / Non-AC pricing.
 */
const vehicleRouteSchema = new mongoose.Schema(
  {
    fromLocation: { type: String, trim: true },
    toLocation: { type: String, trim: true },
    priceAC: { type: Number, min: 0 },
    priceNonAC: { type: Number, min: 0 },
  },
  { _id: false }
)

/**
 * Owner-managed vehicle/transfer rate master, scoped to a workspace (team).
 * One entry = a vehicle (e.g. "Innova Crysta") with one or more priced
 * routes. Selectable in the itinerary builder.
 */
const vehicleSchema = new mongoose.Schema(
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
    /** Vehicle name, e.g. "Innova Crysta", "Sedan (Etios/Dzire)". */
    name: {
      type: String,
      required: true,
      trim: true,
    },
    routes: [vehicleRouteSchema],
    priceCurrency: { type: String, default: 'INR' },
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

vehicleSchema.index({ teamId: 1, name: 1 })

export default mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema)
