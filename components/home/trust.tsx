import Image from 'next/image'
import { ShieldCheck } from 'lucide-react'
import { SectionHeading } from '@/components/common/section-heading'
import { trustItems as staticTrustItems } from '@/content/home'
import { cmsField, cmsList } from '@/lib/cms'
import type { TrustItem } from '@/lib/types'

interface Props { cms?: Record<string, unknown> | null }

export function Trust({ cms }: Props) {
  const eyebrow = cmsField(cms, 'eyebrow', 'Důvěra a transparentnost')
  const title = cmsField(cms, 'headline', 'Víte, v jakých rukou váš pes je')
  const description = cmsField(
    cms,
    'description',
    'Přehledný režim, evidence potřeb každého psa a otevřená komunikace po celou dobu pobytu.',
  )
  const items = cmsList<TrustItem>(cms, 'items', staticTrustItems)

  return (
    <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
      <Image
        src="/images/about-01.png"
        alt=""
        fill
        sizes="100vw"
        className="object-cover opacity-15"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-verde-deep/80" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <SectionHeading
          tone="light"
          align="center"
          eyebrow={eyebrow}
          title={title}
          withSprig
          description={description}
          className="mx-auto max-w-2xl"
        />

        <ul className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.title} className="flex gap-4">
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-verde-white/25">
                <ShieldCheck className="size-5 text-verde-white" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-serif text-lg font-semibold text-verde-white">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-verde-white/75">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
