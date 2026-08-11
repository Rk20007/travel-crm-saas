import mongoose from 'mongoose'

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    /**
     * Every token minted from the same login shares a family id. Presenting a
     * token that was already rotated long ago means it leaked, so the whole
     * family is revoked at once rather than just that one token.
     */
    familyId: {
      type: String,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: Date,
    /** 'reuse-detected' marks a token that can never be honoured again. */
    revokedReason: String,
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
)

// TTL sweep. Declared only here — adding `index: true` on the field as well
// makes mongoose emit a duplicate-index warning and the plain index wins,
// which silently disables expiry and lets the collection grow forever.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema)
