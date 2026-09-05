import mongoose from 'mongoose'

/**
 * One connected Google Ads customer account per workspace (a team can
 * connect more than one — Google Ads doesn't assume 1:1 like Meta's single
 * page-token model, so this is its own collection rather than a sub-schema
 * on Team, unlike Team.metaSync).
 */
const googleIntegrationSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    /** Digits only, e.g. "1234567890" (Google Ads shows it as 123-456-7890). */
    googleCustomerId: {
      type: String,
      required: true,
    },
    googleCustomerName: String,
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'error'],
      default: 'connected',
    },
    /** AES-256-GCM encrypted, same scheme as Team.metaSync.accessTokenEnc. */
    refreshTokenEnc: String,
    accessTokenEnc: String,
    accessTokenExpiresAt: Date,
    connectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lastError: String,
    lastSyncAt: Date,
  },
  { timestamps: true }
)

googleIntegrationSchema.index({ teamId: 1, googleCustomerId: 1 }, { unique: true })

export default mongoose.models.GoogleIntegration ||
  mongoose.model('GoogleIntegration', googleIntegrationSchema)
