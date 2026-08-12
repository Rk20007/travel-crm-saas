import { NextResponse } from 'next/server'

/**
 * SEO-only concern: private/authenticated CRM areas and API responses must
 * never be indexed. Their layouts are client components (can't export
 * metadata), so the noindex signal is applied here as a response header
 * instead — equivalent to a <meta name="robots"> tag, per Google's docs.
 * This does not touch auth, routing, or any request/response body.
 */
export function proxy(request) {
  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
