import { SectionHeading } from '@/components/common/section-heading'
import { routine } from '@/content/home'
import { cmsField, cmsList } from '@/lib/cms'

interface Props { cms?: Record<string, unknown> | null }

interface ScheduleItem {
  time?: string
  title?: string
  activity?: string
  description?: string
}

export function Routine({ cms }: Props) {
  const eyebrow    = cmsField(cms, 'eyebrow', 'Den ve Verde')
  const title      = cmsField(cms, 'headline', 'Vyvážený režim od rána do večera')
  const description= cmsField(cms, 'description', 'Pravidelnost dává psům jistotu. Náš den kombinuje pohyb, péči a dostatek klidu na odpočinek.')

  // Once a CMS row exists, its `schedule` array is authoritative — even if
  // empty. The static `routine` steps only bootstrap when there is no row.
  const cmsSchedule = cmsList<ScheduleItem>(cms, 'schedule', [])
  const steps = cms == null
    ? routine
    : cmsSchedule.map((step) => ({
        time: step.time ?? '',
        title: step.title ?? step.activity ?? '',
        description: step.description,
      }))

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:gap-16">
          <SectionHeading
            eyebrow={eyebrow}
            title={title}
            withSprig
            description={description}
          />

          <ol className="relative border-l border-verde-stone/60">
            {steps.map((step, i) => (
              <li key={`${step.time}-${i}`} className="relative pb-9 pl-8 last:pb-0">
                <span
                  className="absolute -left-[7px] top-1 size-3.5 rounded-full border-2 border-verde-green bg-background"
                  aria-hidden="true"
                />
                <span className="label-caps text-verde-wood">{step.time}</span>
                <h3 className="mt-1 font-serif text-xl font-semibold text-verde-deep">
                  {step.title}
                </h3>
                {step.description && (
                  <p className="mt-1.5 max-w-lg text-pretty text-sm leading-relaxed text-verde-moss">
                    {step.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
