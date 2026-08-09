import mongoose from 'mongoose'

const itineraryHotelSchema = new mongoose.Schema(
  {
    itineraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Itinerary',
      required: true,
      index: true,
    },
    dayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ItineraryDay',
      index: true,
    },
    name: { type: String, required: true, trim: true },
    location: String,
    checkIn: Date,
    checkOut: Date,
    roomType: String,
    stars: { type: Number, min: 1, max: 5 },
    /** Set when added under a budget tier in the Hotels step ('high' or
     * 'low'), matching Itinerary.hotels.category. */
    category: String,
    cost: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    images: [String],
    amenities: [String],
    notes: String,
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
)

itineraryHotelSchema.index({ itineraryId: 1, dayId: 1 })

export default mongoose.models.ItineraryHotel ||
  mongoose.model('ItineraryHotel', itineraryHotelSchema)
