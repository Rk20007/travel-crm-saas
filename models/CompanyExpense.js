import mongoose from 'mongoose'

/** Company-level running costs — rent, utilities, marketing, misc — kept
 * separate from per-booking vendor charges (SupplierLedgerEntry) since those
 * are already netted into a booking's profit; this is the agency's own
 * overhead, tracked for the Company Finance dashboard. */
const companyExpenseSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    category: {
      type: String,
      enum: ['rent', 'utilities', 'marketing', 'misc', 'other'],
      default: 'other',
    },
    amount: {
      type: Number,
      required: true,
    },
    remark: String,
    /** Proof of payment — receipt/bill screenshot, same compressed data-URL
     * pattern used elsewhere in the app. Optional since not every overhead
     * (e.g. an auto-debited utility) has a photo to attach. */
    proofUrl: String,
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

companyExpenseSchema.index({ teamId: 1, date: -1 })

export default mongoose.models.CompanyExpense ||
  mongoose.model('CompanyExpense', companyExpenseSchema)
