import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { SectionHeading } from '@/components/common/section-heading'
import { ReservationCta } from '@/components/home/reservation-cta'
import { CtaLink } from '@/components/common/cta-button'
import { LeafSprig } from '@/components/brand/leaf-sprig'
import { formatPrice, unitLabel } from '@/lib/format'
import { getPublicPriceItems } from '@/lib/public-data'

export const metadata: Metadata = {
  title: 'Ceník',
  description:
    'Přehledný ceník psího hotelu VERDE — cena za noc, zvýhodnění pro další psy a doplňkové služby. Ceny jsou orientační.',
}

const included = [
  'Ubytování v klidném a bezpečném zázemí',
  'Krmení a čerstvá voda',
  'Každodenní pohyb a procházky',
  'Základní péče a dohled po celý den',
  'Pravidelný kontakt a informace o pobytu',
]

export default async function PricingPage() {
  const priceItems = await getPublicPriceItems()
  const [featured, ...rest] = [...priceItems].sort((a, b) =>
    a.featured === b.featured ? 0 : a.featured ? -1 : 1,
  )

  return (
    <>
      <PageHeader
        eyebrow="Ceník"
        title="Férové ceny bez skrytých poplatků"
        description="Ceny jsou orientační a vždy je potvrdíme při rezervaci podle délky pobytu a potřeb vašeho psa."
      />

      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:px-8">
          {featured && (
            <div className="flex flex-col gap-6 rounded-3xl bg-verde-deep p-8 text-verde-white md:p-10">
              <span className="label-caps text-verde-white/70">{featured.title}</span>
              <div className="flex items-end gap-2">
                <span className="font-serif text-5xl font-semibold leading-none">
                  {formatPrice(featured.price)}
                </span>
                <span className="pb-1 text-verde-white/70">{unitLabel(featured.unit)}</span>
              </div>
              <p className="text-pretty text-sm leading-relaxed text-verde-white/80">
                {featured.description}
              </p>
              <ul className="mt-2 flex flex-col gap-3">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-verde-white/90">
                    <Check className="mt-0.5 size-4 shrink-0 text-verde-white" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <CtaLink href="/rezervace" size="md" className="mt-2 self-start">
                Nezávazně rezervovat
              </CtaLink>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <SectionHeading
              eyebrow="Další položky"
              title="Doplňkové služby a zvýhodnění"
              withSprig
            />
            <div className="divide-y divide-border rounded-2xl border border-border bg-card">
              {rest.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <LeafSprig className="mt-1 h-4 w-5 shrink-0 text-verde-green/60" />
                    <div>
                      <h3 className="font-medium text-verde-deep">{item.title}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-verde-moss">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-right font-serif text-lg font-semibold text-verde-green">
                    {formatPrice(item.price)}
                    <span className="block text-xs font-normal text-verde-stone">
                      {unitLabel(item.unit)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-verde-moss">
              Nenašli jste, co hledáte?{' '}
              <Link
                href="/kontakt"
                className="font-medium text-verde-green underline-offset-4 hover:underline"
              >
                Napište nám
              </Link>{' '}
              a domluvíme se na individuálním řešení.
            </p>
          </div>
        </div>
      </section>

      <ReservationCta />
    </>
  )
}
