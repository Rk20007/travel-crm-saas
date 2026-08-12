import jwt from 'jsonwebtoken'
import bcryptjs from 'bcryptjs'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production'

export async function hashPassword(password) {
  const salt = await bcryptjs.genSalt(10)
  return bcryptjs.hash(password, salt)
}

export async function comparePasswords(password, hashedPassword) {
  return bcryptjs.compare(password, hashedPassword)
}

export function generateToken(payload, expiresIn = '15m') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

/** Legacy JWT refresh (prefer opaque refresh tokens via lib/session) */
export function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET)
  } catch (error) {
    return null
  }
}

export function decodeToken(token) {
  try {
    return jwt.decode(token)
  } catch (error) {
    return null
  }
}

// 2FA - TOTP Management
export function generateTOTPSecret(email) {
  return speakeasy.generateSecret({
    name: `Travel CRM (${email})`,
    issuer: 'Travel CRM',
    length: 32,
  })
}

export async function generateQRCode(secret) {
  try {
    return await QRCode.toDataURL(secret.otpauth_url)
  } catch (error) {
    console.error('QR Code generation error:', error)
    return null
  }
}

export function verifyTOTP(secret, token) {
  try {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2,
    })
  } catch (error) {
    return false
  }
}

// OTP Generation (6-digit for email/SMS)
export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function generateOTPExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
}

// Roles & Permissions
export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  OPERATIONS: 'operations',
  ACCOUNTS: 'accounts',
  USER: 'user',
}

export const PERMISSIONS = {
  superadmin: ['all'],
  admin: ['manage_users', 'manage_leads', 'manage_team', 'manage_settings', 'view_analytics', 'manage_invoices', 'manage_weights'],
  manager: ['manage_leads', 'manage_agents', 'view_analytics', 'manage_team'],
  agent: ['manage_leads', 'view_analytics'],
  operations: ['manage_bookings', 'manage_vouchers'],
  accounts: ['manage_invoices', 'manage_payments'],
  user: ['view_own_data'],
}

export function checkRole(userRole, requiredRoles) {
  if (typeof requiredRoles === 'string') {
    return userRole === requiredRoles
  }
  return requiredRoles.includes(userRole)
}

export function checkPermission(userRole, permission) {
  const rolePermissions = PERMISSIONS[userRole] || []
  return rolePermissions.includes('all') || rolePermissions.includes(permission)
}
