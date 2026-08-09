import mongoose from 'mongoose'

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: String,
    logo: String,
    website: String,
    email: String,
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: {
          type: String,
          enum: ['admin', 'manager', 'agent'],
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    /**
     * Workspace / SaaS billing (Team = isolated workspace).
     * Not an enum — plan keys are rows in the Plan collection, which the
     * platform super admin can add to at runtime.
     */
    plan: {
      type: String,
      default: 'basic',
      lowercase: true,
      trim: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'cancelled'],
      default: 'trialing',
    },
    /**
     * Per-agency limit overrides set by the super admin. Only the keys present
     * here deviate from the plan; everything else inherits. Resolved by
     * lib/plans.js → resolveTeamLimits().
     */
    planOverrides: {
      maxBrands: Number,
      maxAgents: Number,
      maxLeadsPerMonth: Number,
      automation: Boolean,
      whatsappAutomation: Boolean,
      apiIngest: Boolean,
    },
    /** Set when the super admin suspends the agency (isActive = false). */
    suspendedAt: Date,
    suspensionReason: String,
    /** Internal super-admin-only notes; never exposed to agency users. */
    platformNotes: String,
    walletCredits: {
      type: Number,
      default: 0,
    },
    usage: {
      leadsThisMonth: { type: Number, default: 0 },
      whatsappSentThisMonth: { type: Number, default: 0 },
      lastUsageResetAt: Date,
    },
    leadRoundRobinIndex: {
      type: Number,
      default: 0,
    },
    opsRoundRobinIndex: {
      type: Number,
      default: 0,
    },
    accountsRoundRobinIndex: {
      type: Number,
      default: 0,
    },
    inboundApiKeyHash: { type: String, sparse: true, unique: true },
    inboundApiKeyCreatedAt: Date,
    /** Meta Lead Ads — page ID for webhook routing to this agency */
    metaPageId: { type: String, sparse: true },

    settings: {
      currency: {
        type: String,
        default: 'USD',
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
      language: {
        type: String,
        default: 'en',
      },
      emailNotifications: {
        type: Boolean,
        default: true,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

export default mongoose.models.Team || mongoose.model('Team', teamSchema)
