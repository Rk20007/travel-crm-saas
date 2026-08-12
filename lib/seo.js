/**
 * Central SEO configuration for the public marketing site.
 * Private CRM/dashboard routes do not use this — they are kept out of the
 * search index via middleware (X-Robots-Tag) and per-route noindex metadata.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000'
).replace(/\/+$/, '')

export const SITE_NAME = 'Travel CRM'

export const DEFAULT_TITLE = 'Travel CRM – Manage Your Travel Business'

export const DEFAULT_DESCRIPTION =
  'Travel CRM software for travel agencies to manage leads, sales, follow-ups, itineraries, bookings, payments, invoices, team members and business operations from one platform.'

export const DEFAULT_KEYWORDS = [
  'travel CRM',
  'travel agency CRM',
  'CRM for travel agencies',
  'travel agency management software',
  'travel management software',
  'travel business management software',
  'travel sales CRM',
  'travel booking management software',
  'travel itinerary management software',
  'travel agency software',
  'travel CRM software',
  'lead management for travel agencies',
  'travel agency booking software',
  'travel agency sales software',
]

// logo1.png is the real asset dimensions (width x height) — used as-is per
// "don't create unnecessary images" guidance.
export const DEFAULT_OG_IMAGE = {
  url: '/logo1.png',
  width: 1006,
  height: 248,
  alt: `${SITE_NAME} logo`,
}

export function absoluteUrl(path = '/') {
  return new URL(path, `${SITE_URL}/`).toString()
}

// Applied to every private/authenticated route so it never enters the index.
export const NOINDEX_ROBOTS = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
}
