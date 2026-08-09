import crypto from 'crypto'
import { generateToken } from '@/lib/auth'
import RefreshToken from '@/models/RefreshToken'
import User from '@/models/User'

const REFRESH_DAYS = 7

export function hashRefreshToken(raw) {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex')
}

/**
 * @param {object} user
 * @param {object} [impersonatedBy] - superadmin JWT payload, when this token is
 *   a support-impersonation session. Stamped into the `imp` claim so every
 *   downstream route can tell a real login from an assumed identity.
 */
export function buildAccessPayload(user, impersonatedBy = null) {
  const teamId = user.teamId ? String(user.teamId) : null
  const brandId = user.activeBrandId ? String(user.activeBrandId) : null
  const payload = {
    userId: String(user._id),
    email: user.email,
    role: user.role,
    teamId,
    workspaceId: teamId,
    brandId,
  }
  if (impersonatedBy) {
    payload.imp = {
      by: String(impersonatedBy.userId),
      byEmail: impersonatedBy.email,
    }
  }
  return payload
}

export async function issueSession(user, { userAgent, ip } = {}) {
  const accessToken = generateToken(buildAccessPayload(user))
  const rawRefresh = crypto.randomBytes(48).toString('hex')
  const tokenHash = hashRefreshToken(rawRefresh)
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000)

  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
    userAgent: userAgent || null,
    ip: ip || null,
  })

  return { accessToken, refreshToken: rawRefresh, expiresAt }
}

export async function rotateRefreshToken(oldRaw, { userAgent, ip } = {}) {
  const oldHash = hashRefreshToken(oldRaw)
  const existing = await RefreshToken.findOne({
    tokenHash: oldHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
  if (!existing) {
    return null
  }

  const user = await User.findById(existing.userId)
  if (!user || !user.isActive || user.isBlocked) {
    existing.revokedAt = new Date()
    await existing.save()
    return null
  }

  existing.revokedAt = new Date()
  await existing.save()

  const session = await issueSession(user, { userAgent, ip })
  return { ...session, user: publicUser(user) }
}

export function publicUser(user) {
  return {
    id: user._id,
    userId: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    teamId: user.teamId,
    workspaceId: user.teamId,
    activeBrandId: user.activeBrandId || null,
  }
}
