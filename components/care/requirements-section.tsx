import { ShieldCheck } from 'lucide-react'
import { SectionHeading } from '@/components/common/section-heading'

interface RequirementItem { title?: string; description?: string }
interface Props { cms?: Record<string, unknown> | null }

export function RequirementsSection({ cms }: Props) {
  const eyebrow  = (cms?.eyebrow  as string) || 'Podmínky pobytu'
  const headline = (cms?.headline as string) || 'Co od vás potřebujeme'
  const description = cms?.description as string | undefined
  const items = Array.isArray(cms?.items) ? (cms!.items as RequirementItem[]) : []

  if (items.length === 0) return null

  return (
    <section className="bg-secondary/40 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={eyebrow}
          title={headline}
          align="center"
          withSprig
          description={description}
          className="mx-auto max-w-2xl"
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {items.map((item, i) => (
            <div
              key={`${item.title}-${i}`}
              className="flex items-start gap-4 rounded-2xl border border-border bg-card p-6"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                <ShieldCheck className="size-4 text-verde-green" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-serif text-lg font-semibold text-verde-deep">{item.title}</h3>
                {item.description && (
                  <p className="mt-1.5 text-pretty text-sm leading-relaxed text-verde-moss">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
