import { PillarIcon } from '@/components/brand/pillar-icon'
import { pillars as staticPillars } from '@/content/home'

interface Props { cms?: Record<string, unknown> }

export function Pillars({ cms }: Props) {
  // cms.items can override the static pillars array with {icon, title, description}[]
  const items = (Array.isArray(cms?.items) ? cms.items as typeof staticPillars : null) ?? staticPillars
  const headline = cms?.headline as string | undefined

  return (
    <section className="bg-primary text-primary-foreground" aria-label="Naše hodnoty">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        {headline && (
          <h2 className="mb-10 text-balance text-center font-serif text-2xl font-semibold text-verde-white sm:text-3xl">
            {headline}
          </h2>
        )}
        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((pillar, i) => (
            <li
              key={pillar.title}
              className="flex flex-col items-center gap-4 text-center lg:border-l lg:border-verde-white/15 lg:px-4 lg:first:border-l-0"
              style={{ borderColor: i === 0 ? 'transparent' : undefined }}
            >
              <span className="flex size-12 items-center justify-center rounded-full border border-verde-white/25">
                <PillarIcon name={pillar.icon} className="size-5 text-verde-white" />
              </span>
              <div className="space-y-1.5">
                <h3 className="font-serif text-base font-semibold uppercase tracking-[0.12em] text-verde-white">
                  {pillar.title}
                </h3>
                <p className="text-sm leading-relaxed text-verde-white/70">
                  {pillar.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
