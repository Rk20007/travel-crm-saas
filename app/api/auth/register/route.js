import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import Team from '@/models/Team'
import Brand from '@/models/Brand'
import { hashPassword } from '@/lib/auth'
import { issueSession, publicUser } from '@/lib/session'

export async function POST(request) {
  try {
    await connectDB()
    const body = await request.json()
    const { name, email, phone, password, confirmPassword } = body

    if (!name || !email || !phone || !password) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (password !== confirmPassword) {
      return Response.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      )
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return Response.json(
        { error: 'User already exists' },
        { status: 409 }
      )
    }

    const hashedPassword = await hashPassword(password)

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      role: 'admin',
    })

    const team = await Team.create({
      name: `${name}'s Workspace`,
      owner: user._id,
      plan: 'basic',
    })

    const brand = await Brand.create({
      teamId: team._id,
      name: `${name}'s Brand`,
      isDefault: true,
    })

    user.teamId = team._id
    user.activeBrandId = brand._id
    await user.save()

    const ua = request.headers.get('user-agent') || ''
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      ''

    const freshUser = await User.findById(user._id)
    const { accessToken, refreshToken } = await issueSession(freshUser, {
      userAgent: ua,
      ip,
    })

    return Response.json(
      {
        message: 'User registered successfully',
        token: accessToken,
        refreshToken,
        user: publicUser(freshUser),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
