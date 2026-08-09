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

    /** Workspace / SaaS billing (Team = isolated workspace) */
    plan: {
      type: String,
      enum: ['basic', 'standard', 'premium'],
      default: 'basic',
    },
    subscriptionStatus: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'cancelled'],
      default: 'trialing',
    },
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
