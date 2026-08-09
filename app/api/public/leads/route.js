import connectDB from '@/lib/mongodb'
import Team from '@/models/Team'
import { hashInboundApiKey } from '@/lib/workspaceApiKey'
import { rateLimit } from '@/lib/rate-limit'
import { resolveTeamLimits } from '@/lib/plans'
import { ingestLead } from '@/lib/leadIngest'

/**
 * Public lead ingest API — agencies connect Meta/Zapier/website forms here.
 *
 * POST /api/public/leads
 * Headers: x-api-key: crm_xxxx (mint from Dashboard → Team & Weights → Generate Key)
 *
 * Body example:
 * {
 *   "firstName": "Rahul",
 *   "lastName": "Sharma",
 *   "phone": "9876543210",
 *   "email": "rahul@email.com",
 *   "city": "Delhi",
 *   "destination": "Kashmir Package",
 *   "travelDate": "2026-06-15",
 *   "source": "facebook_ads",
 *   "externalId": "meta_lead_123",
 *   "autoAssign": true
 * }
 */
export async function POST(request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const rl = await rateLimit(`public-lead:${ip}`, { windowMs: 60_000, max: 60 })
    if (!rl.ok) {
      return Response.json({ error: 'Too many requests' }, { status: 429 })
    }

    const apiKey = request.headers.get('x-api-key')
    if (!apiKey) {
      return Response.json(
        {
          error: 'Missing x-api-key header',
          hint: 'Generate API key from Dashboard → Team & Weights',
        },
        { status: 401 }
      )
    }

    await connectDB()
    const hash = hashInboundApiKey(apiKey)
    const team = await Team.findOne({ inboundApiKeyHash: hash })
    if (!team) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const limits = await resolveTeamLimits(team)
    if (!limits.apiIngest) {
      return Response.json(
        {
          error: 'API ingest is not enabled on your plan (Standard+ required).',
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const channel = body.source === 'facebook_ads' || body.source === 'instagram' ? 'meta' : 'api'

    const result = await ingestLead({
      teamId: team._id,
      body,
      channel,
      autoAssign: body.autoAssign,
    })

    if (result.error) {
      return Response.json({ error: result.error }, { status: result.status })
    }

    return Response.json(
      {
        message: result.message,
        leadId: result.leadId,
        assignedTo: result.lead?.assignedTo?._id || result.lead?.assignedTo,
        duplicate: result.duplicate || false,
      },
      { status: result.status }
    )
  } catch (error) {
    console.error('Public lead ingest error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
