import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import { verifyToken } from '@/lib/auth'
import { generateTOTPSecret, generateQRCode } from '@/lib/auth'

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

    const user = await User.findById(decoded.userId)
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const secret = generateTOTPSecret(user.email)
    const qrCode = await generateQRCode(secret)

    return Response.json({
      message: '2FA setup initiated',
      secret: secret.base32,
      qrCode: qrCode,
      manualEntryKey: secret.base32,
    })
  } catch (error) {
    console.error('2FA setup error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
