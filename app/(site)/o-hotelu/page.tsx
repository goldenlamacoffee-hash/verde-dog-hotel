import type { Metadata } from 'next'
import Image from 'next/image'
import { PageHeader } from '@/components/common/page-header'
import { SectionHeading } from '@/components/common/section-heading'
import { ReservationCta } from '@/components/home/reservation-cta'
import { LeafSprig } from '@/components/brand/leaf-sprig'
import { aboutIntro, aboutValues } from '@/content/pages'
import { pillars as staticPillars } from '@/content/home'
import type { Pillar } from '@/lib/types'
import { PillarIcon } from '@/components/brand/pillar-icon'
import { getPublicPageSections } from '@/lib/public-data'
import { cmsField, cmsList } from '@/lib/cms'

export const metadata: Metadata = {
  title: 'O hotelu',
  description:
    'Psí hotel VERDE vznikl z respektu k psům. Klidné venkovské prostředí nedaleko Brna, individuální péče a bezpečné zázemí.',
}

interface TeamMemberCms { name?: string; role?: string; bio?: string }
interface ValueItemCms { title?: string; description?: string }

export default async function AboutPage() {
  const sections = await getPublicPageSections('o-hotelu')
  const hero = sections.hero
  const story = sections.story
  const team = sections.team
  const values = sections.values
  const principles = sections.principles

  const storyParagraphs = Array.isArray(story?.paragraphs) && story.paragraphs.length > 0
    ? (story.paragraphs as string[])
    : aboutIntro.paragraphs

  const storyImage = cmsField(story, 'image_url', '/images/about-01.png')
  const storyImageAlt = cmsField(story, 'image_alt', 'Pečovatel na procházce se psem v přírodě')

  const valueItems = Array.isArray(values?.items) && values.items.length > 0
    ? (values.items as ValueItemCms[])
    : aboutValues

  const teamMembers = Array.isArray(team?.members) ? (team.members as TeamMemberCms[]) : []

  const principleItems = cmsList<Pillar>(principles, 'items', staticPillars)

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
              src={storyImage}
              alt={storyImageAlt}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div className="flex flex-col gap-6">
            <SectionHeading
              eyebrow={(story?.eyebrow as string) ?? 'Náš přístup'}
              title={(story?.headline as string) ?? 'Klid, bezpečí a dostatek přírody'}
              withSprig
            />
            {storyParagraphs.map((paragraph) => (
              <p key={paragraph} className="text-pretty leading-relaxed text-verde-moss">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      {teamMembers.length > 0 && (
        <section className="bg-secondary/40 py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow={(team?.eyebrow as string) ?? 'Náš tým'}
              title={(team?.headline as string) ?? 'Lidé, kterým na psech záleží'}
              align="center"
              withSprig
              description={team?.description as string | undefined}
              className="mx-auto max-w-2xl"
            />
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {teamMembers.map((member) => (
                <div
                  key={member.name}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-8"
                >
                  <h3 className="font-serif text-xl font-semibold text-verde-deep">
                    {member.name}
                  </h3>
                  <p className="label-caps text-verde-wood">{member.role}</p>
                  {member.bio && (
                    <p className="mt-2 text-pretty text-sm leading-relaxed text-verde-moss">
                      {member.bio}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow={(values?.eyebrow as string) ?? 'Hodnoty'}
            title={(values?.headline as string) ?? 'Na čem nám záleží'}
            align="center"
            className="mx-auto max-w-2xl"
          />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {valueItems.map((value) => (
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

      <section className="bg-secondary/40 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow={cmsField(principles, 'eyebrow', 'Proč Verde')}
            title={cmsField(principles, 'headline', 'Pět principů naší péče')}
            align="center"
            className="mx-auto max-w-2xl"
          />
          <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {principleItems.map((pillar) => (
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

      <ReservationCta cms={sections.cta} />
    </>
  )
}
