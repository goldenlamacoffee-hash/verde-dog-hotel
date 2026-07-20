import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { SectionHeading } from '@/components/common/section-heading'
import { accommodationCards } from '@/content/home'

export function Accommodation() {
  return (
    <section className="bg-secondary paper-texture">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow="Zázemí a péče"
          title="Prostředí, kde se pes cítí bezpečně"
          withSprig
          description="Spojujeme pohodlné vnitřní zázemí s bezpečným venkovním prostorem v přírodě."
          className="mx-auto max-w-2xl"
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {accommodationCards.map((card) => (
            <article
              key={card.title}
              className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-verde-deep/5"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={card.image}
                  alt={card.imageAlt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-serif text-xl font-semibold text-verde-deep">
                  {card.title}
                </h3>
                <p className="mt-2 flex-1 text-pretty text-sm leading-relaxed text-verde-moss">
                  {card.description}
                </p>
                {card.detailsHref ? (
                  <Link
                    href={card.detailsHref}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-verde-green transition-colors hover:text-verde-deep"
                  >
                    Zjistit více
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
