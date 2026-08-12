import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })
const geistMono = Geist_Mono({ subsets: ['latin'] })

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export const metadata = {
  title: 'Travel CRM - Manage Your Travel Business',
  description: 'Production-level Travel CRM SaaS application',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({ children }) {
  // data-scroll-behavior tells Next the smooth scrolling in globals.css is
  // intentional, so it stops animating (and warning about) every route change.
  // suppressHydrationWarning covers attributes browser extensions inject into
  // <body> before React hydrates — those mismatches were tripping Fast Refresh
  // into full page reloads in dev.
  return (
    <html lang="en" className="bg-background" data-scroll-behavior="smooth">
      <body className={`${geist.className} font-sans antialiased`} suppressHydrationWarning>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
