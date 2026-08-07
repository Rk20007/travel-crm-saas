import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import { verifyToken, verifyTOTP } from '@/lib/auth'

export async function POST(request) {
  try {
    await connectDB()

    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      return Response.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { secret, totp } = await request.json()
    if (!secret || !totp) {
      return Response.json(
        { error: 'Secret and TOTP are required' },
        { status: 400 }
      )
    }

    const isValid = verifyTOTP(secret, totp)
    if (!isValid) {
      return Response.json({ error: 'Invalid 2FA code' }, { status: 400 })
    }

    const user = await User.findById(decoded.userId)
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Save 2FA settings
    await User.updateOne(
      { _id: user._id },
      {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      }
    )

    return Response.json({
      message: '2FA enabled successfully',
      twoFactorEnabled: true,
    })
  } catch (error) {
    console.error('2FA verification error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
