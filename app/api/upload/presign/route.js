import { authenticate, requireRoles } from '@/lib/middleware'
import crypto from 'crypto'

/**
 * Returns a presigned PUT URL when AWS env is configured.
 * Install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner for full S3 support.
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

    const body = await request.json()
    const fileName = body?.fileName || body?.key
    const contentType = body?.contentType || 'application/octet-stream'
    if (!fileName) {
      return Response.json({ error: 'fileName required' }, { status: 400 })
    }

    const bucket = process.env.AWS_S3_BUCKET
    const region = process.env.AWS_REGION || 'ap-south-1'
    if (!bucket || !process.env.AWS_ACCESS_KEY_ID) {
      return Response.json(
        {
          mode: 'stub',
          message:
            'Set AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and add @aws-sdk/client-s3 + presigner to enable presigned uploads.',
          uploadUrl: null,
          publicUrl: null,
          key: `uploads/${authResult.user.teamId}/${crypto.randomUUID()}-${fileName}`,
        },
        { status: 200 }
      )
    }

    return Response.json(
      {
        error:
          'S3 presign not loaded. Add @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner, then implement presign in this route.',
      },
      { status: 501 }
    )
  } catch (error) {
    console.error('Presign error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
