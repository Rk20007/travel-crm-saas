import mongoose from 'mongoose'

/**
 * Lightweight audit trail for master/settings changes, scoped to a workspace.
 */
const auditLogSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
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
      enum: ['create', 'update', 'delete', 'archive', 'restore', 'seed'],
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

export default mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)
