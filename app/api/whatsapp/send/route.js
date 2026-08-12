import connectDB from '@/lib/mongodb'
import { authenticate, requireRoles } from '@/lib/middleware'
import { logger } from '@/lib/logger'

/**
 * Stub: wire to AiSensy / Meta WhatsApp Cloud API using WHATSAPP_API_KEY, WHATSAPP_ACCOUNT_ID.
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, [
      'superadmin',
      'admin',
      'manager',
      'agent',
    ])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const body = await request.json()
    const to = body.to
    const template = body.template
    const variables = body.variables || {}

    if (!to) {
      return Response.json({ error: 'to (E.164 phone) required' }, { status: 400 })
    }

    if (!process.env.WHATSAPP_API_KEY) {
      logger.info('whatsapp stub send', { to, template, variables, teamId: authResult.user.teamId })
      return Response.json({
        mode: 'stub',
        message: 'WHATSAPP_API_KEY not configured; message not sent.',
        to,
        template,
      })
    }

    return Response.json(
      {
        error: 'Implement provider call (AiSensy / Meta) in app/api/whatsapp/send/route.js',
      },
      { status: 501 }
    )
  } catch (error) {
    console.error('WhatsApp send error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
