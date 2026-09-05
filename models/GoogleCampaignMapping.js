import mongoose from 'mongoose'

/**
 * Maps a Google Ads source (campaign, and/or a specific Lead Form / landing
 * page form) to a CRM Brand ("Company") + Owner. A lead's mapping is
 * resolved by priority — see lib/googleLeadMapping.js — checking formId,
 * then landingPageId, then googleCampaignId, then googleCustomerId, then
 * (only if explicitly flagged) a workspace default row.
 */
const googleCampaignMappingSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    googleIntegrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoogleIntegration',
    },
    googleCustomerId: { type: String, index: true },
    googleCampaignId: { type: String, index: true },
    googleCampaignName: String,
    /** Lead Form asset id (Lead Form ads) OR a website form's own id. */
    formId: { type: String, index: true },
    landingPageId: { type: String, index: true },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    /** Last-resort fallback for this workspace when nothing else matches —
     * at most meaningful once per team; enforced in the resolver, not here. */
    isDefault: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

googleCampaignMappingSchema.index({ teamId: 1, formId: 1 })
googleCampaignMappingSchema.index({ teamId: 1, landingPageId: 1 })
googleCampaignMappingSchema.index({ teamId: 1, googleCampaignId: 1 })
googleCampaignMappingSchema.index({ teamId: 1, googleCustomerId: 1 })

export default mongoose.models.GoogleCampaignMapping ||
  mongoose.model('GoogleCampaignMapping', googleCampaignMappingSchema)
