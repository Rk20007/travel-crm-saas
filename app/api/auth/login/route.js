import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import { comparePasswords } from '@/lib/auth'
import { issueSession, publicUser } from '@/lib/session'

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
