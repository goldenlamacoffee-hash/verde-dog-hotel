import { Quote } from 'lucide-react'
import { SectionHeading } from '@/components/common/section-heading'
import type { Testimonial } from '@/lib/types'

interface Props {
  items: Testimonial[]
}

export function Testimonials({ items }: Props) {
  return (
    <section className="bg-secondary paper-texture">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow="Reference"
          title="Co říkají majitelé psů"
          withSprig
          className="mx-auto max-w-2xl"
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {items.map((t, i) => (
            <figure
              key={i}
              className="flex flex-col rounded-2xl bg-card p-7 shadow-sm ring-1 ring-verde-deep/5"
            >
              <Quote className="size-7 text-verde-green/30" aria-hidden="true" />
              <blockquote className="mt-4 flex-1 text-pretty leading-relaxed text-verde-charcoal/80">
                {t.quote}
              </blockquote>
              <figcaption className="mt-6 border-t border-verde-stone/50 pt-4">
                <span className="block font-serif text-base font-semibold text-verde-deep">
                  {t.author}
                </span>
                <span className="mt-0.5 block text-xs uppercase tracking-[0.14em] text-verde-wood">
                  {t.context}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
