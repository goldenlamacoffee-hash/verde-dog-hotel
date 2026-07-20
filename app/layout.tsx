import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import { siteSettings } from '@/content/site'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { getPublicPageSection } from '@/lib/public-data'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.verdehotel.cz'),
  title: {
    default: siteSettings.defaultTitle,
    template: `%s | ${siteSettings.name}`,
  },
  description: siteSettings.defaultDescription,
  generator: 'v0.app',
  applicationName: siteSettings.name,
  keywords: [
    'psí hotel',
    'hlídání psů',
    'ubytování psů',
    'Brno',
    'psí penzion',
    'péče o psy',
  ],
  openGraph: {
    type: 'website',
    locale: 'cs_CZ',
    siteName: siteSettings.name,
    title: siteSettings.defaultTitle,
    description: siteSettings.defaultDescription,
    url: 'https://www.verdehotel.cz',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#193a22',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headerCms = await getPublicPageSection<{
    nav?: { label: string; href: string }[]
    cta?: { label: string; href: string }
  }>('global', 'header')

  return (
    <html
      lang="cs"
      className={`light ${cormorant.variable} ${manrope.variable} bg-background`}
    >
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Přeskočit na obsah
        </a>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader
            navItems={headerCms?.nav}
            ctaLabel={headerCms?.cta?.label}
          />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </div>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
