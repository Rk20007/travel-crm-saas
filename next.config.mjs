/** @type {import('next').NextConfig} */
const nextConfig = {
  // The dev-mode build-activity indicator otherwise sits bottom-left, right
  // on top of the wizard's fixed mobile Back/Continue bar.
  devIndicators: {
    position: 'top-left',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  /**
   * Loaded through Node at runtime instead of being bundled:
   *   pdfkit — so its font metrics (Helvetica.afm) resolve off disk
   *   bull   — pulls in optional native/dynamic requires that no bundler likes
   * Declared here rather than only in the webpack hook below so the Turbopack
   * dev server gets the same treatment.
   */
  serverExternalPackages: ['pdfkit', 'bull'],
  /**
   * Empty on purpose: pdfkit/bull are handled by serverExternalPackages above,
   * so Turbopack needs no rules of its own. Declaring the key tells Next the
   * webpack block below is a deliberate leftover for `next build --webpack`
   * rather than an unmigrated config it should error on.
   */
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('bull')
      config.externals.push('pdfkit')
    }
    return config
  },
}

export default nextConfig
