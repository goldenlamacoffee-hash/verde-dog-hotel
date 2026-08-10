import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Check } from 'lucide-react'
import { SectionHeading } from '@/components/common/section-heading'
import { accommodationCards } from '@/content/home'

interface Props { cms?: Record<string, unknown> }

export function Accommodation({ cms }: Props) {
  const eyebrow    = (cms?.eyebrow    as string) || 'Zázemí a péče'
  const title      = (cms?.headline   as string) || 'Prostředí, kde se pes cítí bezpečně'
  const description= (cms?.description as string) || 'Spojujeme pohodlné vnitřní zázemí s bezpečným venkovním prostorem v přírodě.'
  const features    = Array.isArray(cms?.features) ? (cms!.features as string[]) : null

  return (
    <section className="bg-secondary paper-texture">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow={eyebrow}
          title={title}
          withSprig
          description={description}
          className="mx-auto max-w-2xl"
        />

        {features && features.length > 0 && (
          <ul className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm leading-relaxed text-verde-moss">
                <Check className="mt-0.5 size-4 shrink-0 text-verde-green" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {accommodationCards.map((card, idx) => {
            const imgSrc      = (cms?.[`card_${idx}_image`] as string) || card.image
            const imgAlt      = (cms?.[`card_${idx}_image_alt`] as string) || card.imageAlt
            const cardTitle   = (cms?.[`card_${idx}_title`] as string) || card.title
            const cardDesc    = (cms?.[`card_${idx}_description`] as string) || card.description
            const ctaLabel    = (cms?.[`card_${idx}_cta_label`] as string) || 'Zjistit více'
            const ctaHref     = (cms?.[`card_${idx}_cta_href`] as string) || card.detailsHref
            return (
            <article
              key={card.title}
              className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-verde-deep/5"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={imgSrc}
                  alt={imgAlt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  unoptimized={imgSrc.startsWith('http')}
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-serif text-xl font-semibold text-verde-deep">
                  {cardTitle}
                </h3>
                <p className="mt-2 flex-1 text-pretty text-sm leading-relaxed text-verde-moss">
                  {cardDesc}
                </p>
                {ctaHref ? (
                  <Link
                    href={ctaHref}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-verde-green transition-colors hover:text-verde-deep"
                  >
                    {ctaLabel}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
