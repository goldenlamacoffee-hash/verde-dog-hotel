import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/page-header'
import { SectionHeading } from '@/components/common/section-heading'
import { Accommodation } from '@/components/home/accommodation'
import { Routine } from '@/components/home/routine'
import { FeedingSection } from '@/components/care/feeding-section'
import { RequirementsSection } from '@/components/care/requirements-section'
import { ReservationCta } from '@/components/home/reservation-cta'
import { LeafSprig } from '@/components/brand/leaf-sprig'
import { formatPrice, unitLabel } from '@/lib/format'
import { getPublicPageSections, getPublicPriceItems } from '@/lib/public-data'

export const metadata: Metadata = {
  title: 'Péče a ubytování',
  description:
    'Jak vypadá péče o vašeho psa ve Verde — komfortní ubytování, denní režim, krmení podle zvyklostí a doplňkové služby.',
}

export default async function CarePage() {
  const [sections, priceItems] = await Promise.all([
    getPublicPageSections('pece-a-ubytovani'),
    getPublicPriceItems(),
  ])
  const hero = sections.hero

  return (
    <>
      <PageHeader
        eyebrow={(hero?.eyebrow as string) ?? 'Péče a ubytování'}
        title={(hero?.headline as string) ?? 'Péče šitá na míru každému psovi'}
        description={(hero?.description as string) ?? 'Od komfortního zázemí přes vyvážený denní režim až po doplňkové služby. Vše přizpůsobíme povaze a zvyklostem vašeho psa.'}
      />

      <Accommodation cms={sections.accommodation_detail} />

      <Routine cms={sections.care_detail} />

      <FeedingSection cms={sections.feeding} />

      <section className="bg-secondary/40 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Služby"
            title="Co je součástí pobytu"
            align="center"
            withSprig
            description="Základní péče je zahrnuta v ceně pobytu. Doplňkové služby si můžete přiobjednat podle potřeb vašeho psa."
            className="mx-auto max-w-2xl"
          />

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {priceItems.map((service) => (
              <article
                key={service.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-7"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <LeafSprig className="h-5 w-6 shrink-0 text-verde-green/70" />
                    <h3 className="font-serif text-xl font-semibold text-verde-deep">
                      {service.title}
                    </h3>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-verde-green">
                    {service.featured
                      ? 'V ceně'
                      : service.price === 0
                        ? 'Zdarma'
                        : `${formatPrice(service.price)} ${unitLabel(service.unit)}`}
                  </span>
                </div>
                <p className="text-pretty text-sm leading-relaxed text-verde-moss">
                  {service.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <RequirementsSection cms={sections.requirements} />

      <ReservationCta />
    </>
  )
}
