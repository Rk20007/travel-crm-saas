import mongoose from 'mongoose'

const demoRequestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      type: String,
    },
    preferredDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'converted', 'dismissed'],
      default: 'new',
    },
    convertedTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
    },
  },
  { timestamps: true }
)

export default mongoose.models.DemoRequest || mongoose.model('DemoRequest', demoRequestSchema)
