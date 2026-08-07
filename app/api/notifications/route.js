import connectDB from '@/lib/mongodb'
import Notification from '@/models/Notification'
import { verifyToken } from '@/lib/auth'

export async function GET(request) {
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 20
    const isRead = searchParams.get('isRead')

    const query = { userId: decoded.userId }
    if (isRead !== null) query.isRead = isRead === 'true'

    const [totalNotifications, unreadCount, notifications] = await Promise.all([
      Notification.countDocuments(query),
      Notification.countDocuments({ userId: decoded.userId, isRead: false }),
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ])

    return Response.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total: totalNotifications,
        pages: Math.ceil(totalNotifications / limit),
      },
    })
  } catch (error) {
    console.error('Get notifications error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
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

    const body = await request.json()
    const { type, title, message, relatedId, relatedModel, priority } = body

    if (!type || !title || !message) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const notification = await Notification.create({
      userId: decoded.userId,
      teamId: decoded.teamId,
      type,
      title,
      message,
      relatedId,
      relatedModel,
      priority: priority || 'normal',
    })

    return Response.json(
      {
        message: 'Notification created',
        notification,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create notification error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
