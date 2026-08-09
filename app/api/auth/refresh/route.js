import connectDB from '@/lib/mongodb'
import { rotateRefreshToken } from '@/lib/session'

export async function POST(request) {
  try {
    await connectDB()
    const body = await request.json()
    const refreshToken = body?.refreshToken
    if (!refreshToken) {
      return Response.json({ error: 'refreshToken required' }, { status: 400 })
    }

    const ua = request.headers.get('user-agent') || ''
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      ''

    const rotated = await rotateRefreshToken(refreshToken, { userAgent: ua, ip })
    if (!rotated?.user) {
      return Response.json({ error: 'Invalid refresh token' }, { status: 401 })
    }

    return Response.json({
      token: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      user: rotated.user,
    })
  } catch (error) {
    console.error('Refresh error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
