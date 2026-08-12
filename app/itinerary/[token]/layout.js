// Public shareable itinerary links contain client-specific travel/booking
// details. They must stay accessible via direct link but never get indexed
// or surfaced in search results.
export const metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
}

export default function PublicItineraryLayout({ children }) {
  return children
}
