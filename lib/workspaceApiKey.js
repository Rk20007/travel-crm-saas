import crypto from 'crypto'

export function generateInboundApiKey() {
  const raw = `crm_${crypto.randomBytes(24).toString('hex')}`
  const hash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex')
  return { raw, hash }
}

export function hashInboundApiKey(raw) {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex')
}
