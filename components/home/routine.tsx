import { SectionHeading } from '@/components/common/section-heading'
import { routine } from '@/content/home'

export function Routine() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:gap-16">
          <SectionHeading
            eyebrow="Den ve Verde"
            title="Vyvážený režim od rána do večera"
            withSprig
            description="Pravidelnost dává psům jistotu. Náš den kombinuje pohyb, péči a dostatek klidu na odpočinek."
          />

          <ol className="relative border-l border-verde-stone/60">
            {routine.map((step, i) => (
              <li key={step.time} className="relative pb-9 pl-8 last:pb-0">
                <span
                  className="absolute -left-[7px] top-1 size-3.5 rounded-full border-2 border-verde-green bg-background"
                  aria-hidden="true"
                />
                <span className="label-caps text-verde-wood">{step.time}</span>
                <h3 className="mt-1 font-serif text-xl font-semibold text-verde-deep">
                  {step.title}
                </h3>
                <p className="mt-1.5 max-w-lg text-pretty text-sm leading-relaxed text-verde-moss">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
