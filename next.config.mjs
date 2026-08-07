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
  /** Keep pdfkit out of webpack bundle so font metrics (Helvetica.afm) resolve correctly */
  serverExternalPackages: ['pdfkit'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('bull')
      config.externals.push('pdfkit')
    }
    return config
  },
}

export default nextConfig
