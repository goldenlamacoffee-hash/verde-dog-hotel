import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/page-header'
import { ReservationFlow } from '@/components/reservation/reservation-flow'
import { getPublicPageSection, getPublicContactSettings, getPublicCalendarAppearance, getPublicMaximumStayNights } from '@/lib/public-data'

export const metadata: Metadata = {
  title: 'Rezervace pobytu',
  description:
    'Nezávazná online rezervace pobytu v psím hotelu VERDE. Vyberte termín, představte nám svého psa a my se ozveme do 24 hodin.',
}

export default async function ReservationPage() {
  const [hero, contact, calendarAppearance, maximumStayNights] = await Promise.all([
    getPublicPageSection('rezervace', 'hero'),
    getPublicContactSettings(),
    getPublicCalendarAppearance(),
    getPublicMaximumStayNights(),
  ])

  return (
    <>
      <PageHeader
        eyebrow={(hero?.eyebrow as string) ?? 'Rezervace'}
        title={(hero?.headline as string) ?? 'Rezervujte pobyt pro svého psa'}
        description={(hero?.description as string) ?? 'Vyplňte nezávaznou žádost. Termín i cenu s vámi následně potvrdíme osobně.'}
      />
      <section className="bg-background py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Suspense>
            <ReservationFlow
              contactEmail={contact.email ?? null}
              calendarAppearance={calendarAppearance}
              maximumStayNights={maximumStayNights}
            />
          </Suspense>
        </div>
      </section>
    </>
  )
}
