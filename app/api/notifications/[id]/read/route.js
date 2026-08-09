import connectDB from '@/lib/mongodb'
import Notification from '@/models/Notification'
import { verifyToken } from '@/lib/auth'

export async function PUT(request, { params }) {
  try {
    await connectDB()

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      return Response.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { id } = params

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: decoded.userId },
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true }
    )

    if (!notification) {
      return Response.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    return Response.json({
      message: 'Notification marked as read',
      notification,
    })
  } catch (error) {
    console.error('Mark notification as read error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
