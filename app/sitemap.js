import { SITE_URL } from '@/lib/seo'

// Only genuinely public, indexable marketing pages belong here. Dashboard,
// auth, admin, API, and per-tenant itinerary-share routes are intentionally
// excluded — see app/robots.js and the noindex layouts on those routes.
export default function sitemap() {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
