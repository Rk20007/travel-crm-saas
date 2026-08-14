/**
 * Normalize Meta Lead Ads / automation relay payloads into CRM lead fields.
 */

const FIELD_MAP = {
  full_name: 'fullName',
  first_name: 'firstName',
  last_name: 'lastName',
  email: 'email',
  phone_number: 'phone',
  phone: 'phone',
  city: 'city',
  destination: 'destination',
  travel_date: 'travelDate',
  'when_do_you_want_to_travel?': 'travelDate',
  package: 'destination',
  'which_package?': 'destination',
}

/**
 * Advertisers write their own question text, so the exact keys above only ever
 * cover Meta's built-in fields. Custom questions arrive as slugified prose —
 * "aap_kis_location_mein_interested_hain?" — and matching those by keyword is
 * the difference between a usable lead and a blank one. Order matters: the
 * first pattern that matches wins, so put the specific ones first.
 */
const FUZZY_RULES = [
  [/(^|_)e-?mail/, 'email'],
  [/whats?app|mobile|phone|contact_?(no|number)|sampark/, 'phone'],
  [/full_?name|your_?name|aapka_?naam|naam/, 'fullName'],
  [/destination|location|place|jagah|kaha|where|package|tour|trip/, 'destination'],
  [/city|shehar|town|origin|departure/, 'city'],
  [/date|when|kab|month|travel_?time|duration/, 'travelDate'],
  [/budget|price|paisa|cost|pax|people|persons|adults|guests/, 'note'],
]

function fuzzyKey(name) {
  const n = String(name || '').toLowerCase()
  for (const [pattern, key] of FUZZY_RULES) {
    if (pattern.test(n)) return key
  }
  return null
}

/** "aap_kis_location_mein_interested_hain?" → "Aap kis location mein interested hain" */
function humanize(name) {
  return String(name || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\?+$/, '')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
}

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/)
  if (!parts.length) return { firstName: 'Lead', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

/** Parse Meta Graph API leadgen field_data array */
export function parseMetaFieldData(fieldData = []) {
  const out = {}
  // Anything that didn't map to a lead column still gets written into the
  // notes, so a custom question's answer is never silently dropped.
  const extras = []

  for (const f of fieldData) {
    const val = Array.isArray(f.values) ? f.values.join(', ') : f.values
    if (val == null || val === '') continue
    const value = String(val)

    const mapped = FIELD_MAP[f.name] || fuzzyKey(f.name)
    if (!mapped || mapped === 'note') {
      extras.push(`${humanize(f.name)}: ${value}`)
      if (!mapped) out[f.name] = value
      continue
    }
    // Two questions can map to the same column ("city" and "departure city");
    // keep the first answer and record the rest in notes.
    if (out[mapped]) {
      extras.push(`${humanize(f.name)}: ${value}`)
    } else {
      out[mapped] = value
    }
  }

  let firstName = out.firstName
  let lastName = out.lastName
  if (!firstName && out.fullName) {
    const s = splitName(out.fullName)
    firstName = s.firstName
    lastName = s.lastName
  }

  return {
    firstName: firstName || 'Lead',
    lastName: lastName || '',
    email: out.email,
    phone: out.phone,
    city: out.city,
    destination: out.destination,
    travelDate: out.travelDate,
    notes: extras.length ? extras.join('\n') : undefined,
    rawFields: out,
  }
}

/** Flat JSON body from Zapier/n8n or direct POST */
export function normalizeInboundBody(body = {}) {
  let firstName = body.firstName || body.first_name
  let lastName = body.lastName || body.last_name || ''
  if (!firstName && body.full_name) {
    const s = splitName(body.full_name)
    firstName = s.firstName
    lastName = s.lastName
  }

  const destination =
    body.destination ||
    body.package ||
    body.packageName ||
    (Array.isArray(body.destinationPreference)
      ? body.destinationPreference[0]
      : body.destinationPreference)

  let travelDate = body.travelDate || body.travel_date
  if (body.travelDates?.startDate) travelDate = body.travelDates.startDate

  return {
    firstName: firstName || 'Lead',
    lastName: lastName || '',
    email: body.email,
    phone: body.phone || body.phoneNumber || body.phone_number,
    city: body.city,
    destination,
    travelDate,
    notes: body.notes,
    source: body.source || 'api',
    externalId: body.externalId || body.leadgen_id || body.leadgenId || body.id,
    metadata: body.metadata || {},
  }
}
