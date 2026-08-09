import mongoose from 'mongoose'

/**
 * Owner-managed hotel master, scoped to a workspace (team).
 * Can be entered manually or imported from Google Places.
 */
const hotelSchema = new mongoose.Schema(
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
    /** Destination / region grouping (free text or master value). */
    destination: {
      type: String,
      trim: true,
      index: true,
    },
    city: {
      type: String,
      trim: true,
      index: true,
    },
    country: { type: String, trim: true },
    address: String,
    /** Category / star rating label (e.g. '5 Star', 'Deluxe'). */
    category: String,
    stars: { type: Number, min: 0, max: 5 },
    /** Room type this pricing applies to (from the Room Types master) — mirrors rooms[0]. */
    roomType: { type: String, trim: true },
    /** Per-night selling price shown in itinerary quotes / PDFs — mirrors rooms[0]. */
    price: { type: Number, min: 0 },
    priceCurrency: { type: String, default: 'INR' },
    /** A hotel can offer several room categories, each at its own per-night price. */
    rooms: [
      {
        roomType: { type: String, trim: true },
        price: { type: Number, min: 0 },
      },
    ],
    extraBedCharge: { type: Number, min: 0 },
    cnbPrice: { type: Number, min: 0 },
    phone: String,
    email: String,
    website: String,
    description: String,
    /** Geo + Google Places linkage. */
    location: {
      lat: Number,
      lng: Number,
    },
    placeId: { type: String, index: true },
    googleRating: Number,
    googleReviews: Number,
    priceLevel: Number,
    photos: [String],
    amenities: [String],
    /** 'manual' | 'google_places' */
    source: {
      type: String,
      enum: ['manual', 'google_places'],
      default: 'manual',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    notes: String,
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

hotelSchema.index({ teamId: 1, destination: 1 })
hotelSchema.index({ teamId: 1, city: 1 })
// Avoid duplicate imports of the same Google place into one workspace.
// NOTE: `sparse: true` alone does NOT work here — for a *compound* index,
// Mongo only excludes a document when *every* indexed field is absent, and
// teamId is always present, so a sparse compound index still enforces
// uniqueness across all placeId-less (manual) hotels. A partial index with
// an explicit filter is the correct way to scope uniqueness to documents
// that actually have a placeId.
hotelSchema.index(
  { teamId: 1, placeId: 1 },
  { unique: true, partialFilterExpression: { placeId: { $exists: true } } }
)

export default mongoose.models.Hotel || mongoose.model('Hotel', hotelSchema)
