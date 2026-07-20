import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/page-header'
import { ReservationFlow } from '@/components/reservation/reservation-flow'

export const metadata: Metadata = {
  title: 'Rezervace pobytu',
  description:
    'Nezávazná online rezervace pobytu v psím hotelu VERDE. Vyberte termín, představte nám svého psa a my se ozveme do 24 hodin.',
}

export default function ReservationPage() {
  return (
    <>
      <PageHeader
        eyebrow="Rezervace"
        title="Rezervujte pobyt pro svého psa"
        description="Vyplňte nezávaznou žádost. Termín i cenu s vámi následně potvrdíme osobně."
      />
      <section className="bg-background py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ReservationFlow />
        </div>
      </section>
    </>
  )
}
