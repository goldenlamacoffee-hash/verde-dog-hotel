import Image from 'next/image'
import { CtaLink } from '@/components/common/cta-button'
import { LeafSprig } from '@/components/brand/leaf-sprig'
import { siteSettings } from '@/content/site'
import { cmsField } from '@/lib/cms'

interface Props { cms?: Record<string, unknown> | null }

export function Hero({ cms }: Props) {
  const headline    = cmsField(cms, 'headline', 'Kde jsou psi jako doma')
  const description = cmsField(cms, 'description', 'Psí hotel v srdci přírody nedaleko Brna. Individuální péče, bezpečné zázemí a dostatek pohybu pro spokojený pobyt vašeho psa.')
  const badge       = cmsField(cms, 'badge', siteSettings.tagline)
  const ctaPrimary  = cmsField(cms, 'cta_primary', 'Rezervovat pobyt')
  const ctaSecondary= cmsField(cms, 'cta_secondary', 'Jak to u nás vypadá')
  const imageUrl    = cmsField(cms, 'image_url', '/images/hero-verde.png')
  const imageAlt    = cmsField(cms, 'image_alt', 'Ohař v klidné přírodní krajině při západu slunce')

  return (
    <section className="relative isolate flex min-h-[92vh] items-end overflow-hidden">
      <Image
        src={imageUrl}
        alt={imageAlt}
        fill
        priority
        sizes="100vw"
        className="object-cover"
        unoptimized={imageUrl.startsWith('http')}
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-verde-deep/95 via-verde-deep/70 to-verde-deep/35"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-verde-deep/80 via-verde-deep/30 to-transparent"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-14 pt-32 sm:px-6 lg:px-8 lg:pb-20">
        <div className="max-w-2xl">
          <span className="flex items-center gap-3 text-verde-white/80">
            <LeafSprig className="h-4 w-5 text-verde-white/80" />
            <span className="label-caps">{badge}</span>
          </span>
          <h1 className="mt-6 text-balance font-serif text-4xl font-semibold leading-[1.05] text-verde-white sm:text-5xl md:text-6xl lg:text-7xl">
            {headline}
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-verde-white/85 md:text-xl">
            {description}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CtaLink href="/rezervace" variant="light" size="lg">
              {ctaPrimary}
            </CtaLink>
            <CtaLink href="/pece-a-ubytovani" variant="outlineLight" size="lg">
              {ctaSecondary}
            </CtaLink>
          </div>
        </div>
      </div>
    </section>
  )
}
