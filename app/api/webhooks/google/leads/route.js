import connectDB from '@/lib/mongodb'
import Team from '@/models/Team'
import GoogleLeadEvent from '@/models/GoogleLeadEvent'
import { ingestLead } from '@/lib/leadIngest'
import { parseGoogleLeadFormPayload } from '@/lib/googleLeadParser'
import { resolveGoogleMapping } from '@/lib/googleLeadMapping'

/**
 * Google Ads Lead Form ("Webhook" delivery method) — a separate, independent
 * path from the Meta webhook above; does not touch it or its routing.
 *
 * Google has no page-id concept here — every submission instead carries a
 * shared secret (`google_key`) the advertiser pastes into the Lead Form
 * asset's webhook config in Google Ads. That secret doubles as the routing
 * key (Team.googleLeadFormKey), same role metaPageId plays for Meta.
 *
 * Flow:
 *   Google Lead Form submit → Google POST → verify google_key → parse →
 *   resolve owner via campaign/form mapping → ingestLead → ack
 *
 * Response contract Google requires: HTTP 200 with {"api_version":"1.0"} on
 * success. Any non-2xx makes Google retry the same delivery later — so every
 * *transient* failure here should return 5xx (retry-safe), and only a
 * genuinely bad/forged payload should return 4xx (no point retrying that).
 */
export async function POST(request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  let team = null
  let parsed = null
  try {
    await connectDB()

    const { attribution, contact, googleKey } = parseGoogleLeadFormPayload(payload)
    parsed = { attribution, contact }

    if (!googleKey) {
      await logEvent({ status: 'error', error: 'Missing google_key', payload })
      return Response.json({ error: 'Missing google_key' }, { status: 400 })
    }

    // The shared secret IS the team lookup — no match means either a wrong
    // key or a team that hasn't set one up yet. Either way, reject; never
    // fall back to "the first team with a key set" the way Meta's page
    // lookup does — a wrong key here would otherwise leak leads cross-tenant.
    team = await Team.findOne({ googleLeadFormKey: googleKey })
    if (!team) {
      await logEvent({ status: 'error', error: 'No team matched this google_key', payload })
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Idempotency: Google retries a delivery it didn't get a 200 for, and can
    // also legitimately redeliver — the lead's own id is the dedupe key,
    // exactly like Meta's leadgen_id, so a retry never creates a duplicate.
    if (attribution.googleSubmissionId) {
      const existing = await GoogleLeadEvent.findOne({
        teamId: team._id,
        googleSubmissionId: attribution.googleSubmissionId,
        status: { $in: ['processed', 'duplicate'] },
      }).lean()
      if (existing) {
        return Response.json({ api_version: '1.0' }, { status: 200 })
      }
    }

    const mapping = await resolveGoogleMapping({
      teamId: team._id,
      formId: attribution.formId,
      campaignId: attribution.campaignId,
      googleCustomerId: attribution.googleCustomerId,
    })

    const result = await ingestLead({
      teamId: team._id,
      channel: 'google',
      body: {
        ...contact,
        externalId: attribution.googleSubmissionId,
        // Never trust anything the client could forge — assignedTo/brandId
        // only ever come from the server-resolved mapping, if any.
        assignedTo: mapping?.ownerId || undefined,
        brandId: mapping?.brandId || undefined,
        // No mapping found → stays genuinely unassigned rather than a
        // round-robin guess (spec: never randomly assign an unmapped lead) —
        // logEvent() below (status 'unmapped') is what surfaces it to an admin.
        autoAssign: false,
        metadata: {
          google: {
            sourceType: 'google_lead_form',
            ...attribution,
          },
        },
      },
    })

    if (result.error) {
      await logEvent({ teamId: team._id, attribution, status: 'error', error: result.error, payload })
      return Response.json({ error: result.error }, { status: result.status || 500 })
    }

    await logEvent({
      teamId: team._id,
      attribution,
      status: result.duplicate ? 'duplicate' : mapping ? 'processed' : 'unmapped',
      leadId: result.leadId,
      payload,
    })

    return Response.json({ api_version: '1.0' }, { status: 200 })
  } catch (error) {
    console.error('Google Lead Form webhook error:', error)
    await logEvent({
      teamId: team?._id,
      attribution: parsed?.attribution,
      status: 'error',
      error: error.message,
      payload,
    }).catch(() => {})
    // 5xx — Google will retry; the event is already logged either way.
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function logEvent({ teamId, attribution, status, error, leadId, payload }) {
  try {
    await GoogleLeadEvent.create({
      teamId,
      source: 'google_lead_form',
      googleSubmissionId: attribution?.googleSubmissionId,
      googleCampaignId: attribution?.campaignId,
      googleCustomerId: attribution?.googleCustomerId,
      formId: attribution?.formId,
      status,
      leadId,
      error,
      rawPayload: payload,
    })
  } catch (e) {
    // Never let logging itself take down the webhook response.
    console.error('GoogleLeadEvent log failed:', e.message)
  }
}
