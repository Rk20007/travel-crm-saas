/**
 * Normalize the two Google lead shapes into the flat contact-field body
 * lib/leadIngest.js's normalizeInboundBody() already knows how to read
 * (firstName/lastName/email/phone/city/destination/...), plus a separate
 * Google attribution block. Mirrors lib/metaLeadParser.js's approach
 * (mapped columns + fuzzy fallback for advertiser-custom questions) without
 * touching that file — Google's column ids are a different vocabulary.
 */

const COLUMN_MAP = {
  FULL_NAME: 'fullName',
  FIRST_NAME: 'firstName',
  LAST_NAME: 'lastName',
  EMAIL: 'email',
  WORK_EMAIL: 'email',
  PHONE_NUMBER: 'phone',
  WORK_PHONE_NUMBER: 'phone',
  CITY: 'city',
  REGION: 'city',
  POSTAL_CODE: 'note',
  COMPANY_NAME: 'note',
  JOB_TITLE: 'note',
  COUNTRY: 'note',
}

const FUZZY_RULES = [
  [/(^|_)e-?mail/i, 'email'],
  [/phone|mobile|whatsapp|contact/i, 'phone'],
  [/full.?name|your.?name|^name$/i, 'fullName'],
  [/destination|location|place|package|tour|trip/i, 'destination'],
  [/city|town/i, 'city'],
  [/date|when|travel.?time|duration/i, 'travelDate'],
]

function fuzzyKey(name) {
  const n = String(name || '')
  for (const [pattern, key] of FUZZY_RULES) {
    if (pattern.test(n)) return key
  }
  return null
}

function humanize(name) {
  return String(name || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
}

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/)
  if (!parts.length) return { firstName: 'Lead', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

/**
 * Google's Lead Form "Webhook" delivery payload. Field names below follow
 * Google's documented schema; read defensively (camelCase/snake_case, a
 * couple of historical aliases) since Google has changed casing between doc
 * revisions and this must not hard-fail on a harmless rename.
 */
export function parseGoogleLeadFormPayload(payload = {}) {
  const columnData = payload.user_column_data || payload.userColumnData || []
  const out = {}
  const extras = []

  for (const col of columnData) {
    const id = col.column_id || col.columnId || col.column_name || col.columnName
    const value = col.string_value ?? col.stringValue ?? col.value
    if (value == null || value === '') continue
    const mapped = COLUMN_MAP[id] || fuzzyKey(col.column_name || col.columnName || id)
    if (!mapped || mapped === 'note') {
      extras.push(`${humanize(col.column_name || col.columnName || id)}: ${value}`)
      continue
    }
    if (out[mapped]) {
      extras.push(`${humanize(col.column_name || col.columnName || id)}: ${value}`)
    } else {
      out[mapped] = String(value)
    }
  }

  let firstName = out.firstName
  let lastName = out.lastName
  if (!firstName && out.fullName) {
    const s = splitName(out.fullName)
    firstName = s.firstName
    lastName = s.lastName
  }

  const campaignId = payload.campaign_id ?? payload.campaignId
  const leadId = payload.lead_id ?? payload.leadId
  const formId = payload.form_id ?? payload.formId ?? payload.asset_id ?? payload.assetId

  return {
    contact: {
      firstName: firstName || 'Lead',
      lastName: lastName || '',
      email: out.email,
      phone: out.phone,
      city: out.city,
      destination: out.destination,
      notes: extras.length ? extras.join('\n') : undefined,
    },
    attribution: {
      googleCustomerId: payload.customer_id ? String(payload.customer_id) : undefined,
      campaignId: campaignId != null ? String(campaignId) : undefined,
      campaignName: payload.campaign_name || payload.campaignName,
      adGroupId: (payload.adgroup_id ?? payload.adGroupId) != null ? String(payload.adgroup_id ?? payload.adGroupId) : undefined,
      adId: (payload.creative_id ?? payload.creativeId ?? payload.ad_id) != null
        ? String(payload.creative_id ?? payload.creativeId ?? payload.ad_id)
        : undefined,
      formId: formId != null ? String(formId) : undefined,
      googleSubmissionId: leadId != null ? String(leadId) : undefined,
      gclid: payload.gcl_id || payload.gclid || undefined,
      isTest: payload.is_test === true || payload.is_test === 'true',
      submittedAt: payload.lead_submitted_at || payload.leadSubmittedAt || new Date().toISOString(),
    },
    googleKey: payload.google_key || payload.googleKey,
  }
}

/** Hard cap on any single attribution string so a malicious/garbled query
 * string can't bloat the document or blow past Mongo's field-size limits. */
const MAX_LEN = 512

function clean(value) {
  if (value == null) return undefined
  const s = String(value).trim().slice(0, MAX_LEN)
  return s || undefined
}

/**
 * Landing-page/website form attribution — never trust the client blindly,
 * so every field is whitelisted, coerced to a string, and length-capped
 * before it ever reaches the database.
 */
export function sanitizeAttribution(input = {}) {
  return {
    gclid: clean(input.gclid),
    utmSource: clean(input.utm_source ?? input.utmSource),
    utmMedium: clean(input.utm_medium ?? input.utmMedium),
    utmCampaign: clean(input.utm_campaign ?? input.utmCampaign),
    utmCampaignId: clean(input.utm_campaign_id ?? input.utmCampaignId),
    utmTerm: clean(input.utm_term ?? input.utmTerm),
    utmContent: clean(input.utm_content ?? input.utmContent),
    landingPageId: clean(input.landing_page_id ?? input.landingPageId),
    formId: clean(input.form_id ?? input.formId),
    referrer: clean(input.referrer),
    landingPageUrl: clean(input.page_url ?? input.pageUrl ?? input.landing_page_url),
    submittedAt: new Date().toISOString(),
  }
}
