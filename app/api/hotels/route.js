import { authenticate } from '@/lib/middleware'
import { MASTER_HOTELS } from '@/lib/data/masterRepository'

export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.toLowerCase() || ''

    let hotels = MASTER_HOTELS
    if (q) {
      hotels = hotels.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          h.city.toLowerCase().includes(q) ||
          h.location.toLowerCase().includes(q)
      )
    }

    return Response.json({ hotels })
  } catch (error) {
    console.error('Hotels list error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
