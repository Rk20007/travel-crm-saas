import mongoose from 'mongoose'

const voucherSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    type: {
      type: String,
      enum: ['hotel', 'cab', 'driver'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'generated', 'sent'],
      default: 'pending',
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    pdfUrl: String,
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    issuedAt: Date,
  },
  { timestamps: true }
)

voucherSchema.index({ teamId: 1, bookingId: 1, type: 1 })

export default mongoose.models.Voucher || mongoose.model('Voucher', voucherSchema)
