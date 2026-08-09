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

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/)
  if (!parts.length) return { firstName: 'Lead', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

/** Parse Meta Graph API leadgen field_data array */
export function parseMetaFieldData(fieldData = []) {
  const out = {}
  for (const f of fieldData) {
    const key = FIELD_MAP[f.name] || f.name
    const val = Array.isArray(f.values) ? f.values[0] : f.values
    if (val != null && val !== '') out[key] = String(val)
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
