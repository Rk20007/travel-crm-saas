import mongoose from 'mongoose'

/** Accounts-payable ledger for a Supplier. 'charge' entries are created
 * automatically when Operations confirms a hotel room with a negotiated
 * price (see app/api/bookings/[id]/confirmations/route.js); 'payment'
 * entries are logged manually by Accounts/Owner against the running
 * balance on Supplier.balanceDue. */
const supplierLedgerEntrySchema = new mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    type: {
      type: String,
      enum: ['charge', 'payment'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: String,
    /** Set on 'charge' entries — the booking that generated this room charge. */
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    /** Matches Booking.hotelConfirmations[].key — lets a re-confirm with a
     * new price update this same entry instead of creating a duplicate. */
    hotelKey: String,
    /** Same idea as hotelKey, for Booking.vehicleConfirmations[].key. */
    vehicleKey: String,
    /** Client whose stay this charge is for — lets the ledger show a
     * client-wise breakdown instead of just a booking number. */
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
    },
    roomType: String,
    roomCount: Number,
    nights: Number,
    checkIn: Date,
    checkOut: Date,
    extraBeds: Number,
    cnbCount: Number,
    mealPlan: String,
    /** Transport-charge-only fields — set on 'charge' entries created from a
     * confirmed vehicle (see chargeSupplierForVehicle). */
    pax: Number,
    arrivalDate: Date,
    departureDate: Date,
    pickupLocation: String,
    dropLocation: String,
    driverName: String,
    driverPhone: String,
    description: String,
    /** Whether the hotel needs an advance to hold the booking, and how much —
     * a hint for Accounts, not a separate payment record; the actual payment
     * is still logged as its own 'payment' entry when made. */
    advanceRequired: Boolean,
    advanceAmount: Number,
    /** Set only on 'charge' entries — how much of this specific charge has
     * been settled. Payments are auto-allocated oldest-charge-first (see
     * app/api/suppliers/[id]/payments) since Accounts records a lump sum
     * against the supplier, not against one charge — this is what lets a
     * booking's ledger row show "cleared" vs "balance due" instead of only
     * the supplier's overall running balance. */
    paidAmount: { type: Number, default: 0 },
    /** One-off charge (e.g. late check-out fee) folded into `amount` — kept
     * separately too so the ledger can show why it was added. */
    extraCharge: Number,
    extraChargeRemark: String,
    /** Manual +/- corrections to a charge's amount after the fact — e.g. the
     * vehicle got swapped mid-trip, or the stay ran an extra day. Each entry
     * is a signed adjustment to `amount` with a mandatory remark, kept as an
     * audit trail rather than silently overwriting the total. */
    adjustments: [
      {
        amount: Number,
        direction: { type: String, enum: ['add', 'subtract'] },
        remark: String,
        date: { type: Date, default: Date.now },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    /** Accountant's note on a payment entry. */
    note: String,
    /** Proof of payment — set on a 'payment' entry when Accounts pays a
     * specific client's charge directly (see app/api/suppliers/[id]/payments
     * with chargeEntryId), and mirrored onto that charge entry too so its
     * row can show "View proof" without joining back to the payment. */
    screenshotUrl: String,
    date: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

supplierLedgerEntrySchema.index({ supplierId: 1, date: -1 })
supplierLedgerEntrySchema.index({ bookingId: 1, hotelKey: 1 })
supplierLedgerEntrySchema.index({ bookingId: 1, vehicleKey: 1 })

export default mongoose.models.SupplierLedgerEntry ||
  mongoose.model('SupplierLedgerEntry', supplierLedgerEntrySchema)
