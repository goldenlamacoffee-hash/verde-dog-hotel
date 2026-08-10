import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Check } from 'lucide-react'
import { SectionHeading } from '@/components/common/section-heading'
import { accommodationCards } from '@/content/home'
import { cmsField, cmsList } from '@/lib/cms'

interface Props { cms?: Record<string, unknown> | null }

interface AccommodationCard {
  image: string
  imageAlt: string
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
}

export function Accommodation({ cms }: Props) {
  const eyebrow    = cmsField(cms, 'eyebrow', 'Zázemí a péče')
  const title      = cmsField(cms, 'headline', 'Prostředí, kde se pes cítí bezpečně')
  const description= cmsField(cms, 'description', 'Spojujeme pohodlné vnitřní zázemí s bezpečným venkovním prostorem v přírodě.')
  const features    = cmsList<string>(cms, 'features', [])

  // Once a CMS row exists for this section, its card_N_* fields are the sole
  // source of truth for that card — an empty field renders empty, it never
  // silently falls back to the unrelated static `accommodationCards` demo
  // content. The static cards only bootstrap the *entire* section when there
  // is no CMS row at all yet.
  const cards: AccommodationCard[] = cms == null
    ? accommodationCards.map((card) => ({
        image: card.image,
        imageAlt: card.imageAlt,
        title: card.title,
        description: card.description,
        ctaLabel: 'Zjistit více',
        ctaHref: card.detailsHref ?? '',
      }))
    : [0, 1, 2].map((idx) => ({
        image: cmsField(cms, `card_${idx}_image`, ''),
        imageAlt: cmsField(cms, `card_${idx}_image_alt`, ''),
        title: cmsField(cms, `card_${idx}_title`, ''),
        description: cmsField(cms, `card_${idx}_description`, ''),
        ctaLabel: cmsField(cms, `card_${idx}_cta_label`, ''),
        ctaHref: cmsField(cms, `card_${idx}_cta_href`, ''),
      })).filter((card) => card.title || card.description || card.image)

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
          {cards.map((card, idx) => (
            <article
              key={`${card.title}-${idx}`}
              className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-verde-deep/5"
            >
              {card.image && (
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={card.image}
                    alt={card.imageAlt}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    unoptimized={card.image.startsWith('http')}
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-serif text-xl font-semibold text-verde-deep">
                  {card.title}
                </h3>
                <p className="mt-2 flex-1 text-pretty text-sm leading-relaxed text-verde-moss">
                  {card.description}
                </p>
                {card.ctaHref ? (
                  <Link
                    href={card.ctaHref}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-verde-green transition-colors hover:text-verde-deep"
                  >
                    {card.ctaLabel || 'Zjistit více'}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
