import { OAuth2Client } from 'google-auth-library'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import Team from '@/models/Team'
import Brand from '@/models/Brand'
import { issueSession, publicUser } from '@/lib/session'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export async function POST(request) {
  try {
    const audience = process.env.GOOGLE_CLIENT_ID
    if (!audience) {
      return Response.json(
        { error: 'Google OAuth is not configured (GOOGLE_CLIENT_ID)' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const idToken = body?.credential || body?.idToken
    if (!idToken) {
      return Response.json({ error: 'credential (id token) required' }, { status: 400 })
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience,
    })
    const payload = ticket.getPayload()
    if (!payload?.email) {
      return Response.json({ error: 'Invalid Google token' }, { status: 401 })
    }

    await connectDB()
    const email = payload.email.toLowerCase()

    let user = await User.findOne({
      $or: [{ email }, { googleId: payload.sub }],
    })

    if (!user) {
      user = await User.create({
        name: payload.name || email.split('@')[0],
        email,
        googleId: payload.sub,
        avatar: payload.picture,
        role: 'admin',
      })

      const team = await Team.create({
        name: `${user.name}'s Workspace`,
        owner: user._id,
        plan: 'basic',
      })

      const brand = await Brand.create({
        teamId: team._id,
        name: `${user.name}'s Brand`,
        isDefault: true,
      })

      user.teamId = team._id
      user.activeBrandId = brand._id
      await user.save()
    } else {
      if (!user.googleId) {
        user.googleId = payload.sub
      }
      if (payload.picture) {
        user.avatar = payload.picture
      }
      user.lastLogin = new Date()
      await user.save()

      if (!user.teamId) {
        const team = await Team.create({
          name: `${user.name}'s Workspace`,
          owner: user._id,
          plan: 'basic',
        })
        const brand = await Brand.create({
          teamId: team._id,
          name: `${user.name}'s Brand`,
          isDefault: true,
        })
        user.teamId = team._id
        user.activeBrandId = brand._id
        await user.save()
      }
    }

    const ua = request.headers.get('user-agent') || ''
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      ''

    const fresh = await User.findById(user._id)
    const { accessToken, refreshToken } = await issueSession(fresh, {
      userAgent: ua,
      ip,
    })

    return Response.json({
      message: 'Signed in with Google',
      token: accessToken,
      refreshToken,
      user: publicUser(fresh),
    })
  } catch (error) {
    console.error('Google auth error:', error)
    return Response.json({ error: 'Google sign-in failed' }, { status: 500 })
  }
}
