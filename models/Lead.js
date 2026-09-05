import mongoose from 'mongoose'

const leadSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    city: {
      type: String,
    },
    destination: {
      type: String,
    },
    travelDate: {
      type: Date,
    },
    whatsapp: {
      type: String,
    },
    /** Deduplicate Meta/API leads — e.g. leadgen_id */
    externalId: {
      type: String,
      index: true,
    },
    ingestChannel: {
      type: String,
      enum: ['manual', 'api', 'meta', 'website', 'google'],
      default: 'manual',
    },
    destinationPreference: [String],
    budget: {
      min: Number,
      max: Number,
    },
    travelDates: {
      startDate: Date,
      endDate: Date,
    },
    numberOfTravelers: Number,
    // status values are dynamic (workspace masters); default kept for new leads.
    status: {
      type: String,
      default: 'new',
    },
    /** Reason a lead was marked lost (dynamic master value). */
    lostReason: {
      type: String,
    },
    /** Follow-up captured when a lead is marked Lost. */
    lostDetails: {
      nextFollowUpAt: Date,
      followUpType: String,
      remarks: String,
    },
    /** Pipeline status change history. */
    statusHistory: [
      {
        from: String,
        to: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        note: String,
      },
    ],
    /** File attachments on the lead. */
    attachments: [
      {
        url: String,
        name: String,
        type: String,
        size: Number,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      index: true,
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      index: true,
    },
    // source values are dynamic (workspace masters); default kept for new leads.
    source: {
      type: String,
      default: 'website',
    },
    notes: String,
    followUpDate: Date,
    lastContact: Date,
    conversionRate: {
      type: Number,
      default: 0,
    },
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
)

leadSchema.index({ teamId: 1, externalId: 1 }, { sparse: true })
leadSchema.index({ teamId: 1, status: 1, createdAt: -1 })
leadSchema.index({ teamId: 1, assignedTo: 1, createdAt: -1 })

export default mongoose.models.Lead || mongoose.model('Lead', leadSchema)
