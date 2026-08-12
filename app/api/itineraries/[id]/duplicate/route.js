import connectDB from '@/lib/mongodb'
import mongoose from 'mongoose'
import { authenticate } from '@/lib/middleware'
import { duplicateItinerary } from '@/services/itineraryService'

export async function POST(request, { params }) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: 'Invalid itinerary ID' }, { status: 400 })
    }

    await connectDB()
    const result = await duplicateItinerary(id, authResult.user)
    if (!result) {
      return Response.json({ error: 'Itinerary not found' }, { status: 404 })
    }

    return Response.json(
      {
        success: true,
        message: 'Itinerary duplicated successfully',
        ...result,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Duplicate itinerary error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
