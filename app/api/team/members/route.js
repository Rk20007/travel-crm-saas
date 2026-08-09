import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import { authenticate } from '@/lib/middleware'

export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    await connectDB()
    const users = await User.find({ teamId: authResult.user.teamId, isActive: { $ne: false } })
      .select('name email role')
      .sort({ name: 1 })
      .lean()

    return Response.json({ success: true, members: users })
  } catch (error) {
    console.error('Team members error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
