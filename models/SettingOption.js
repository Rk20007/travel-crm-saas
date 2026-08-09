import mongoose from 'mongoose'

/**
 * Generic master / dropdown option, scoped to a workspace (team).
 * Powers every configurable dropdown across the CRM (lead statuses, sources,
 * follow-up types, package types, visa types, payment/booking statuses,
 * supplier categories, priorities, tags, etc.) so companies can customise
 * their own configuration without code changes.
 */
const settingOptionSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
    },
    /** Master category slug, e.g. 'lead_status', 'lead_source' — see lib/masterCategories */
    category: {
      type: String,
      required: true,
      index: true,
    },
    /** Machine value stored on records (slug). Stable, lowercase. */
    key: {
      type: String,
      required: true,
    },
    /** Human label shown in UI. */
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    /** Hex color for badges/pills. */
    color: {
      type: String,
      default: '#64748b',
    },
    /** lucide-react icon name (optional). */
    icon: String,
    /** Sort order within the category. */
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    /** Seeded system default — protected from deletion (can still be archived/edited). */
    isSystem: {
      type: Boolean,
      default: false,
    },
    /** Extra per-category fields (e.g. isLostReason, isWon, tax rate). */
    metadata: mongoose.Schema.Types.Mixed,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

// One key per category per workspace.
settingOptionSchema.index({ teamId: 1, category: 1, key: 1 }, { unique: true })
settingOptionSchema.index({ teamId: 1, category: 1, order: 1 })

export default mongoose.models.SettingOption ||
  mongoose.model('SettingOption', settingOptionSchema)
