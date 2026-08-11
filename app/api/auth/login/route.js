import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import Team from '@/models/Team'
import { comparePasswords } from '@/lib/auth'
import { issueSession, publicUser } from '@/lib/session'
import { isSubscriptionExpired } from '@/lib/subscription'

export async function POST(request) {
  try {
    await connectDB()
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return Response.json(
        { error: 'Missing email or password' },
        { status: 400 }
      )
    }

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    if (!user.password) {
      return Response.json(
        {
          error: 'This account uses Google sign-in',
        },
        { status: 401 }
      )
    }

    const passwordMatch = await comparePasswords(password, user.password)
    if (!passwordMatch) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Checked after the password so a wrong password and a suspended/pending
    // account are indistinguishable to someone probing for valid emails.
    if (user.approvalStatus === 'pending') {
      return Response.json(
        { error: 'Your account is awaiting super admin approval. You will be able to sign in once approved.' },
        { status: 403 }
      )
    }
    if (user.approvalStatus === 'rejected') {
      return Response.json(
        { error: 'Your account request was declined. Contact your administrator.' },
        { status: 403 }
      )
    }

    if (user.isBlocked || user.isActive === false) {
      return Response.json(
        { error: 'This account has been suspended. Contact your administrator.' },
        { status: 403 }
      )
    }

    // Super admins are platform-level — a workspace being suspended/expired
    // (they can even be seeded with a home teamId, e.g. the platform's own
    // "workspace") must never lock them out of the panel that manages it.
    if (user.teamId && user.role !== 'superadmin') {
      const team = await Team.findById(user.teamId)
        .select('isActive subscriptionExpiresAt')
        .lean()
      if (team && team.isActive === false) {
        return Response.json(
          { error: 'This workspace has been suspended. Contact support.' },
          { status: 403 }
        )
      }
      if (isSubscriptionExpired(team)) {
        return Response.json(
          { error: 'This workspace\'s subscription has expired. Contact your platform admin to renew.' },
          { status: 403 }
        )
      }
    }

    user.lastLogin = new Date()
    await user.save()

    const ua = request.headers.get('user-agent') || ''
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      ''

    const { accessToken, refreshToken } = await issueSession(user, {
      userAgent: ua,
      ip,
    })

    return Response.json(
      {
        message: 'Login successful',
        token: accessToken,
        refreshToken,
        user: publicUser(user),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Login error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
