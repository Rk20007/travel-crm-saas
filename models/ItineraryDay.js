import mongoose from 'mongoose'

const timelineBlockSchema = {
  time: String,
  title: String,
  description: String,
  location: String,
}

const itineraryDaySchema = new mongoose.Schema(
  {
    itineraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Itinerary',
      required: true,
      index: true,
    },
    dayNumber: { type: Number, required: true, min: 1 },
    sortOrder: { type: Number, default: 0 },
    title: { type: String, trim: true },
    description: String,
    date: Date,
    distance: String,
    travelDuration: String,
    hotel: {
      name: String,
      location: String,
      checkIn: String,
      checkOut: String,
      stars: Number,
      notes: String,
    },
    meals: [
      {
        type: { type: String },
        venue: String,
        time: String,
        notes: String,
      },
    ],
    activities: [
      {
        name: String,
        time: String,
        duration: String,
        description: String,
        cost: Number,
        location: String,
      },
    ],
    transfers: [
      {
        type: String,
        from: String,
        to: String,
        time: String,
        notes: String,
      },
    ],
    timelineBlocks: [timelineBlockSchema],
    notes: String,
    images: [String],
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
)

itineraryDaySchema.index({ itineraryId: 1, sortOrder: 1 })
itineraryDaySchema.index({ itineraryId: 1, dayNumber: 1 })

export default mongoose.models.ItineraryDay ||
  mongoose.model('ItineraryDay', itineraryDaySchema)
