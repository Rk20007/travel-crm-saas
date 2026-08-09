

import mongoose from 'mongoose'

const brandSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
    },
    logo: String,
    website: String,
    /** Public contact shown on itineraries / documents. */
    phone: String,
    email: String,
    /** Social / Meta (Facebook / Instagram) page link. */
    metaLink: String,
    /** Payment QR scanner (image data-URL or URL). */
    scanner1: String,
    /** Background image shown behind the final contact/payment page of the itinerary PDF. */
    contactBackground: String,
    /** Cover-image picker shown in the itinerary builder — capped at 4 by the settings UI/API. */
    gallery: [
      {
        url: String,
        label: String,
      },
    ],
    isDefault: {
      type: Boolean,
      default: false,
    },
    address: String,
    /** Optional second office address. */
    address2: String,
    bankDetails: {
      bankName: String,
      accountName: String,
      accountNumber: String,
      ifscCode: String,
    },
    settings: {
      currency: { type: String, default: 'INR' },
      whatsappBusinessId: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

brandSchema.index({ teamId: 1, name: 1 }, { unique: true })

export default mongoose.models.Brand || mongoose.model('Brand', brandSchema)
