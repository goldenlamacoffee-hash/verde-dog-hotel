import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/page-header'
import { GalleryGrid } from '@/components/gallery/gallery-grid'
import { ReservationCta } from '@/components/home/reservation-cta'

export const metadata: Metadata = {
  title: 'Galerie',
  description:
    'Prohlédněte si prostředí psího hotelu VERDE — zázemí, přírodní okolí a každodenní život psů u nás.',
}

export default function GalleryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Galerie"
        title="Život ve Verde v obrazech"
        description="Zázemí, příroda a spokojení psi. Klikněte na fotku pro její zvětšení."
      />

      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <GalleryGrid />
        </div>
      </section>

      <ReservationCta />
    </>
  )
}
