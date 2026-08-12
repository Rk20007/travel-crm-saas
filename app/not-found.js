import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Page Not Found',
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Page not found</h1>
      <p className="mt-4 max-w-md text-balance text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/">
          <Button size="lg">Back to homepage</Button>
        </Link>
        <Link href="/login">
          <Button variant="outline" size="lg">
            Sign in
          </Button>
        </Link>
      </div>
    </main>
  )
}
