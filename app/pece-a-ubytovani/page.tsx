import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/page-header'
import { SectionHeading } from '@/components/common/section-heading'
import { Accommodation } from '@/components/home/accommodation'
import { Routine } from '@/components/home/routine'
import { ReservationCta } from '@/components/home/reservation-cta'
import { LeafSprig } from '@/components/brand/leaf-sprig'
import { services } from '@/content/services'
import { formatPrice, unitLabel } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Péče a ubytování',
  description:
    'Jak vypadá péče o vašeho psa ve Verde — komfortní ubytování, denní režim, krmení podle zvyklostí a doplňkové služby.',
}

export default function CarePage() {
  return (
    <>
      <PageHeader
        eyebrow="Péče a ubytování"
        title="Péče šitá na míru každému psovi"
        description="Od komfortního zázemí přes vyvážený denní režim až po doplňkové služby. Vše přizpůsobíme povaze a zvyklostem vašeho psa."
      />

      <Accommodation />

      <Routine />

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
            {services.map((service) => (
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
                    {service.standard
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

      <ReservationCta />
    </>
  )
}
