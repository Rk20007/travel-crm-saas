import connectDB from '@/lib/mongodb'

export async function GET(req) {
  try {
    const conn = await connectDB()
    return Response.json({
      success: true,
      message: 'MongoDB connection successful',
      database: conn.connection.name,
      host: conn.connection.host,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return Response.json({
      success: false,
      message: 'MongoDB connection failed',
      error: error.message
    }, { status: 500 })
  }
}
