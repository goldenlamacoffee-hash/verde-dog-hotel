import type { Metadata } from 'next'
import Image from 'next/image'
import { PageHeader } from '@/components/common/page-header'
import { SectionHeading } from '@/components/common/section-heading'
import { ReservationCta } from '@/components/home/reservation-cta'
import { LeafSprig } from '@/components/brand/leaf-sprig'
import { aboutIntro, aboutValues } from '@/content/pages'
import { pillars } from '@/content/home'
import { PillarIcon } from '@/components/brand/pillar-icon'
import { getPublicPageSection } from '@/lib/public-data'

export const metadata: Metadata = {
  title: 'O hotelu',
  description:
    'Psí hotel VERDE vznikl z respektu k psům. Klidné venkovské prostředí nedaleko Brna, individuální péče a bezpečné zázemí.',
}

export default async function AboutPage() {
  const hero = await getPublicPageSection('o-hotelu', 'hero')

  return (
    <>
      <PageHeader
        eyebrow={(hero?.eyebrow as string) ?? aboutIntro.eyebrow}
        title={(hero?.headline as string) ?? aboutIntro.heading}
        description={(hero?.description as string) ?? aboutIntro.paragraphs[0]}
      />

      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl">
            <Image
              src="/images/about-01.png"
              alt="Pečovatel na procházce se psem v přírodě"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div className="flex flex-col gap-6">
            <SectionHeading
              eyebrow="Náš přístup"
              title="Klid, bezpečí a dostatek přírody"
              withSprig
            />
            {aboutIntro.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-pretty leading-relaxed text-verde-moss">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary/40 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Hodnoty"
            title="Na čem nám záleží"
            align="center"
            className="mx-auto max-w-2xl"
          />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {aboutValues.map((value) => (
              <div
                key={value.title}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-8"
              >
                <LeafSprig className="h-5 w-6 text-verde-green/70" />
                <h3 className="font-serif text-xl font-semibold text-verde-deep">
                  {value.title}
                </h3>
                <p className="text-pretty text-sm leading-relaxed text-verde-moss">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Proč Verde"
            title="Pět principů naší péče"
            align="center"
            className="mx-auto max-w-2xl"
          />
          <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="flex flex-col gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-verde-green">
                  <PillarIcon name={pillar.icon} className="size-6" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-verde-deep">
                  {pillar.title}
                </h3>
                <p className="text-pretty text-sm leading-relaxed text-verde-moss">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ReservationCta />
    </>
  )
}
