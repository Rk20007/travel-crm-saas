import connectDB from '@/lib/mongodb'
import { authenticate } from '@/lib/middleware'
import { parseBody, createItinerarySchema } from '@/lib/validators/itinerary'
import { createItinerary } from '@/services/itineraryService'

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
        ...result,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create itinerary error:', error)
    if (error.name === 'ValidationError') {
      return Response.json({ error: error.message }, { status: 400 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
