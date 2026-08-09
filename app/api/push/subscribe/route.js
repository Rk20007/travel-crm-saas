import connectDB from '@/lib/mongodb'
import PushSubscription from '@/models/PushSubscription'
import { authenticate } from '@/lib/middleware'

export async function POST(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const sub = body.subscription
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return Response.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    await connectDB()
    await PushSubscription.findOneAndUpdate(
      { endpoint: sub.endpoint },
      {
        userId: authResult.user.userId,
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        userAgent: request.headers.get('user-agent') || '',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    return Response.json({ message: 'Subscribed' })
  } catch (error) {
    console.error('Push subscribe error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint')
    if (!endpoint) {
      return Response.json({ error: 'endpoint is required' }, { status: 400 })
    }

    await connectDB()
    await PushSubscription.deleteOne({ endpoint, userId: authResult.user.userId })

    return Response.json({ message: 'Unsubscribed' })
  } catch (error) {
    console.error('Push unsubscribe error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
