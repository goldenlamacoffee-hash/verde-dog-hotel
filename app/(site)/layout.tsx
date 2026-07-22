import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { getPublicPageSection, getPublicSiteSetting } from '@/lib/public-data'

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [headerCms, brand] = await Promise.all([
    getPublicPageSection<{
      nav?: { label: string; href: string }[]
      cta?: { label: string; href: string }
    }>('global', 'header'),
    getPublicSiteSetting<{ darkLogo?: string; lightLogo?: string; ogImage?: string }>('brand'),
  ])

  return (
    <>
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
          darkLogoSrc={brand?.darkLogo}
          lightLogoSrc={brand?.lightLogo}
        />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
    </>
  )
}
