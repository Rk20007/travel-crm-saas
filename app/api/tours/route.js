import connectDB from '@/lib/mongodb'
import TourCalendar from '@/models/TourCalendar'
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
    const limit = parseInt(searchParams.get('limit')) || 10
    const status = searchParams.get('status')
    const destination = searchParams.get('destination')

    const query = { teamId: decoded.teamId }
    if (status) query.status = status
    if (destination) query.destination = { $regex: destination, $options: 'i' }

    const totalTours = await TourCalendar.countDocuments(query)
    const tours = await TourCalendar.find(query)
      .populate('assignedMembers', 'name email avatar')
      .sort({ startDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    return Response.json({
      success: true,
      tours,
      pagination: {
        page,
        limit,
        total: totalTours,
        pages: Math.ceil(totalTours / limit),
      },
    })
  } catch (error) {
    console.error('Get tours error:', error)
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
    const { tourName, destination, startDate, endDate, price } = body

    if (!tourName || !destination || !startDate || !endDate || !price) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1

    const tour = await TourCalendar.create({
      teamId: decoded.teamId,
      tourName,
      destination,
      startDate: start,
      endDate: end,
      duration,
      price,
    })

    return Response.json(
      {
        message: 'Tour created successfully',
        tour,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create tour error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
