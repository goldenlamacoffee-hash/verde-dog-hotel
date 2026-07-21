import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase storage (gallery images, media assets)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Direct Supabase project URL pattern
      {
        protocol: 'https',
        hostname: 'tpjdhonkvtdkibbrsxux.supabase.co',
        pathname: '/**',
      },
      // Unsplash (placeholder/example images during development)
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      // Media library — allow any https URL (admin-entered public URLs)
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

export default nextConfig
