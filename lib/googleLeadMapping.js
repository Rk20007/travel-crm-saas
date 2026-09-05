import GoogleCampaignMapping from '@/models/GoogleCampaignMapping'

/**
 * Resolve which CRM Company (Brand) + Owner a Google lead belongs to.
 *
 * Priority (first match wins, deterministic — never random):
 *   1. Form ID          (Lead Form asset id, or the website form's own id)
 *   2. Landing Page ID
 *   3. Google Campaign ID
 *   4. Google Customer ID (account-level default)
 *   5. A workspace's single row explicitly flagged isDefault
 *
 * Returns { mapping, brandId, ownerId } or null when nothing matches — the
 * caller must NOT guess an owner in that case (see Part 5 of the spec: the
 * lead still gets created, just unassigned/pending, never silently dropped
 * or randomly assigned).
 */
export async function resolveGoogleMapping({ teamId, formId, landingPageId, campaignId, googleCustomerId }) {
  const base = { teamId, status: 'active' }

  const lookups = [
    formId ? { ...base, formId } : null,
    landingPageId ? { ...base, landingPageId } : null,
    campaignId ? { ...base, googleCampaignId: campaignId } : null,
    googleCustomerId ? { ...base, googleCustomerId, googleCampaignId: { $in: [null, undefined, ''] } } : null,
  ].filter(Boolean)

  for (const query of lookups) {
    const mapping = await GoogleCampaignMapping.findOne(query).sort({ updatedAt: -1 }).lean()
    if (mapping) return { mapping, brandId: mapping.brandId, ownerId: mapping.ownerId }
  }

  const fallback = await GoogleCampaignMapping.findOne({ ...base, isDefault: true }).lean()
  if (fallback) return { mapping: fallback, brandId: fallback.brandId, ownerId: fallback.ownerId }

  return null
}
