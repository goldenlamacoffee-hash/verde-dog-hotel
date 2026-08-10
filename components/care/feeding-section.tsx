import { Droplets } from 'lucide-react'
import { SectionHeading } from '@/components/common/section-heading'
import { cmsField, cmsList } from '@/lib/cms'

interface Props { cms?: Record<string, unknown> | null }

export function FeedingSection({ cms }: Props) {
  const eyebrow     = cmsField(cms, 'eyebrow', 'Krmení')
  const headline     = cmsField(cms, 'headline', 'Krmíme podle vašich pokynů')
  const description = cmsField(cms, 'description', 'Respektujeme stávající krmný plán vašeho psa. Přivezete-li vlastní krmivo, použijeme ho.')
  const notes = cmsList<string>(cms, 'notes', [])

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          <SectionHeading eyebrow={eyebrow} title={headline} withSprig description={description} />

          {notes.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {notes.map((note, i) => (
                <li
                  key={`${note}-${i}`}
                  className="flex items-start gap-3 rounded-xl bg-secondary/60 p-4"
                >
                  <Droplets className="mt-0.5 size-4 shrink-0 text-verde-green" aria-hidden="true" />
                  <span className="text-sm leading-relaxed text-verde-moss">{note}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
