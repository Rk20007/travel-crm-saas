import mongoose from 'mongoose'

/**
 * Lightweight audit trail for master/settings changes, scoped to a workspace.
 */
const auditLogSchema = new mongoose.Schema(
  {
    /**
     * Absent for platform-scope entries (plan edits and similar), which belong
     * to no single workspace.
     */
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      index: true,
    },
    /** 'platform' entries are written by the super admin across tenants. */
    scope: {
      type: String,
      enum: ['workspace', 'platform'],
      default: 'workspace',
      index: true,
    },
    /** Entity type touched, e.g. 'setting_option', 'hotel'. */
    entity: {
      type: String,
      required: true,
    },
    /** Sub-scope, e.g. the master category slug. */
    entityCategory: String,
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    action: {
      type: String,
      enum: [
        'create',
        'update',
        'delete',
        'archive',
        'restore',
        'seed',
        'suspend',
        'activate',
        'renew',
        'plan_change',
        'password_reset',
        'impersonate_start',
        'impersonate_stop',
        'meta_sync_settings_updated',
        'meta_sync_manual_run',
      ],
      required: true,
    },
    /** Human summary of the change. */
    summary: String,
    /** Before/after snapshot (partial). */
    changes: mongoose.Schema.Types.Mixed,
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actorName: String,
    actorEmail: String,
  },
  { timestamps: true }
)

auditLogSchema.index({ teamId: 1, entity: 1, createdAt: -1 })
auditLogSchema.index({ scope: 1, createdAt: -1 })

export default mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)
