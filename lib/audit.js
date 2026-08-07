import AuditLog from '@/models/AuditLog'

/**
 * Record an audit entry. Never throws — auditing must not break the request.
 */
export async function recordAudit({
  teamId,
  entity,
  entityCategory,
  entityId,
  action,
  summary,
  changes,
  actor,
}) {
  try {
    await AuditLog.create({
      teamId,
      entity,
      entityCategory,
      entityId,
      action,
      summary,
      changes,
      actorId: actor?.userId,
      actorName: actor?.name,
      actorEmail: actor?.email,
    })
  } catch (err) {
    console.error('Audit log error:', err?.message)
  }
}
