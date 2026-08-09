import Image from 'next/image'
import { PawPrint, Trees, Heart, ShieldCheck, Leaf, type LucideIcon } from 'lucide-react'
import { SectionHeading } from '@/components/common/section-heading'
import { CtaLink } from '@/components/common/cta-button'

interface Props { cms?: Record<string, unknown> }

interface Feature { icon?: string; text?: string }

const FEATURE_ICONS: Record<string, LucideIcon> = {
  paw: PawPrint,
  tree: Trees,
  heart: Heart,
  shield: ShieldCheck,
  leaf: Leaf,
}

export function Intro({ cms }: Props) {
  const eyebrow    = (cms?.eyebrow    as string) || 'Vítejte ve Verde'
  const title      = (cms?.headline   as string) || (cms?.title as string) || 'Pobyt, který respektuje povahu vašeho psa'
  const lead       = (cms?.description as string) || (cms?.lead as string) || 'Věříme, že spokojený pes potřebuje klid, prostor a lidský přístup. Proto ve Verde spojujeme přírodní prostředí s péčí přizpůsobenou každému psovi zvlášť — od krmení a pohybu až po odpočinek.'
  const body       = (cms?.body       as string) || 'Nacházíme se v klidné lokalitě Brno – venkov, obklopeni zelení a dostatkem místa k procházkám. Ať už jedete na dovolenou nebo služební cestu, váš pes u nás najde bezpečné zázemí a lidi, kterým na něm záleží.'
  const ctaLabel   = (cms?.cta_label   as string) || 'Více o hotelu'
  const imageUrl   = (cms?.image_url   as string) || '/images/intro-detail-01.png'
  const imageAlt   = (cms?.image_alt   as string) || 'Detail klidného ohaře v přírodě'
  const features   = Array.isArray(cms?.features) ? (cms!.features as Feature[]) : null

  return (
    <section className="bg-background">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className="relative order-last aspect-[4/5] overflow-hidden rounded-2xl lg:order-first">
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover"
            unoptimized={imageUrl.startsWith('http')}
          />
          <div className="absolute inset-0 ring-1 ring-inset ring-verde-deep/10" aria-hidden="true" />
        </div>

        <div>
          <SectionHeading
            eyebrow={eyebrow}
            title={title}
            withSprig
            description={lead}
          />
          <p className="mt-6 max-w-xl text-pretty leading-relaxed text-verde-moss">
            {body}
          </p>

          {features && features.length > 0 && (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {features.map((feature, i) => {
                const Icon = FEATURE_ICONS[feature.icon ?? ''] ?? PawPrint
                return (
                  <li key={`${feature.text}-${i}`} className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <Icon className="size-4 text-verde-green" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <span className="pt-1 text-sm leading-relaxed text-verde-moss">{feature.text}</span>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mt-8">
            <CtaLink href="/o-hotelu" variant="secondary" size="lg">
              {ctaLabel}
            </CtaLink>
          </div>
        </div>
      </div>
    </section>
  )
}
