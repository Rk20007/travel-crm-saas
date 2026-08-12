import mongoose from 'mongoose'

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['hotel', 'airline', 'activity', 'transport', 'guide', 'other'],
      required: true,
    },
    /** Not required at the schema level — suppliers auto-created from a hotel
     * confirmation (see lib/hotelSupplier.js) have no email captured yet;
     * the manual "add supplier" form still enforces it itself. */
    email: {
      type: String,
    },
    phone: String,
    website: String,
    rating: {
      type: Number,
      min: 0,
      max: 5,
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    contactPerson: {
      name: String,
      title: String,
      phone: String,
      email: String,
    },
    bankDetails: {
      accountName: String,
      accountNumber: String,
      bankName: String,
      routingNumber: String,
      swiftCode: String,
    },
    paymentTerms: String,
    cancellationPolicy: String,
    commission: {
      percentage: Number,
      fixedAmount: Number,
      currency: String,
    },
    documents: [
      {
        name: String,
        url: String,
        uploadedAt: Date,
      },
    ],
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: String,
    /** Running balance owed to this supplier — sum of ledger 'charge' entries
     * minus 'payment' entries. Kept as a cached counter (updated via $inc
     * alongside each SupplierLedgerEntry write) so lists don't need to
     * aggregate the ledger on every read. */
    balanceDue: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
)

export default mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema)
