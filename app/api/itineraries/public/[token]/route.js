import connectDB from '@/lib/mongodb'
import { getItineraryByShareToken } from '@/services/itineraryService'

export async function GET(request, { params }) {
  try {
    const { token } = await params
    if (!token) {
      return Response.json({ error: 'Invalid share link' }, { status: 400 })
    }

    await connectDB()
    const result = await getItineraryByShareToken(token)
    if (!result) {
      return Response.json({ error: 'Itinerary not found' }, { status: 404 })
    }

    if (result.itinerary.status !== 'published' && result.itinerary.status !== 'sent') {
      return Response.json({ error: 'This itinerary is not available for public viewing' }, { status: 403 })
    }

    return Response.json({ success: true, ...result })
  } catch (error) {
    console.error('Public itinerary error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
