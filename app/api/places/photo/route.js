const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY

/**
 * Proxy a Google Places photo so the API key stays server-side.
 * Public (no auth) because it is rendered via <img> tags which cannot send
 * Authorization headers; only proxies Google place photo refs.
 * GET /api/places/photo?ref=places/PLACE_ID/photos/RESOURCE
 */
export async function GET(request) {
  if (!PLACES_KEY) {
    return Response.json({ error: 'Places not configured' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const ref = searchParams.get('ref')
  if (!ref || !ref.startsWith('places/')) {
    return Response.json({ error: 'Invalid photo reference' }, { status: 400 })
  }

  try {
    const url = `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=800&maxWidthPx=1200&key=${PLACES_KEY}`
    const upstream = await fetch(url, { redirect: 'follow' })
    if (!upstream.ok) {
      return Response.json({ error: 'Photo unavailable' }, { status: 502 })
    }
    const buf = await upstream.arrayBuffer()
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error('Places photo error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
