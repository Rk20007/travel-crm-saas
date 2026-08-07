import mongoose from 'mongoose'

const itineraryActivitySchema = new mongoose.Schema(
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
    time: String,
    duration: String,
    description: String,
    location: String,
    cost: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    images: [String],
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

itineraryActivitySchema.index({ itineraryId: 1, dayId: 1 })

export default mongoose.models.ItineraryActivity ||
  mongoose.model('ItineraryActivity', itineraryActivitySchema)
