import mongoose from 'mongoose'

/** A salary payout to a team member for a given month — logged by
 * Admin/Accounts for the Company Finance dashboard's expense tracking.
 * `employeeName`/`employeeRole` are denormalized at payment time so the
 * record still reads correctly even if the staff member is later removed. */
const salaryPaymentSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    employeeName: {
      type: String,
      required: true,
    },
    employeeRole: String,
    amount: {
      type: Number,
      required: true,
    },
    /** 'YYYY-MM' — which month's salary this covers (can differ from the
     * date it was actually paid, e.g. paid a few days late). */
    month: {
      type: String,
      required: true,
    },
    remark: String,
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

salaryPaymentSchema.index({ teamId: 1, date: -1 })
salaryPaymentSchema.index({ teamId: 1, userId: 1, month: 1 })

export default mongoose.models.SalaryPayment ||
  mongoose.model('SalaryPayment', salaryPaymentSchema)
