import connectDB from '@/lib/mongodb'
import { authenticate } from '@/lib/middleware'
import { parseBody, listItineraryQuerySchema, createItinerarySchema } from '@/lib/validators/itinerary'
import { listItineraries, createItinerary } from '@/services/itineraryService'

export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    await connectDB()
    const { searchParams } = new URL(request.url)
    const parsed = parseBody(listItineraryQuerySchema, Object.fromEntries(searchParams))
    if (parsed.error) {
      return Response.json({ error: parsed.error }, { status: 400 })
    }

    const result = await listItineraries(authResult.user, parsed.data)
    return Response.json({ success: true, ...result })
  } catch (error) {
    console.error('Get itineraries error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** @deprecated Prefer POST /api/itineraries/create */
export async function POST(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    await connectDB()
    const body = await request.json()
    const parsed = parseBody(createItinerarySchema, body)
    if (parsed.error) {
      return Response.json({ error: parsed.error }, { status: 400 })
    }

    const result = await createItinerary(authResult.user, parsed.data)
    return Response.json(
      {
        success: true,
        message: 'Itinerary created successfully',
        itinerary: result.itinerary,
        ...result,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create itinerary error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
