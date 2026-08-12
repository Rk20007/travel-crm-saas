import connectDB from '@/lib/mongodb'
import Team from '@/models/Team'
import { authenticate, requireRoles } from '@/lib/middleware'
import { generateInboundApiKey } from '@/lib/workspaceApiKey'

export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, ['superadmin', 'admin'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const team = await Team.findById(authResult.user.teamId).select(
      'inboundApiKeyCreatedAt metaPageId plan'
    )
    if (!team) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return Response.json({
      hasApiKey: !!team.inboundApiKeyCreatedAt,
      apiKeyCreatedAt: team.inboundApiKeyCreatedAt,
      metaPageId: team.metaPageId || '',
      plan: team.plan,
      apiIngestEnabled: true,
      endpoints: {
        publicLeads: `${baseUrl}/api/public/leads`,
        metaWebhook: `${baseUrl}/api/webhooks/meta/leads`,
      },
    })
  } catch (error) {
    console.error('Workspace API key GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, ['superadmin', 'admin'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const team = await Team.findById(authResult.user.teamId)
    if (!team) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const { raw, hash } = generateInboundApiKey()
    team.inboundApiKeyHash = hash
    team.inboundApiKeyCreatedAt = new Date()
    await team.save()

    return Response.json({
      message: 'Store this key securely; it is shown only once.',
      apiKey: raw,
    })
  } catch (error) {
    console.error('Workspace API key error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Save Meta Page ID for webhook routing */
export async function PATCH(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, ['superadmin', 'admin'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    const body = await request.json()
    await connectDB()
    const team = await Team.findById(authResult.user.teamId)
    if (!team) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 })
    }

    if (body.metaPageId !== undefined) {
      team.metaPageId = body.metaPageId ? String(body.metaPageId).trim() : undefined
    }

    await team.save()

    return Response.json({
      message: 'Updated',
      metaPageId: team.metaPageId,
    })
  } catch (error) {
    console.error('Workspace API key PATCH error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
