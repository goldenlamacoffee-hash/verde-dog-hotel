import { Hero } from '@/components/home/hero'
import { Pillars } from '@/components/home/pillars'
import { Intro } from '@/components/home/intro'
import { Accommodation } from '@/components/home/accommodation'
import { Routine } from '@/components/home/routine'
import { Trust } from '@/components/home/trust'
import { GalleryPreview } from '@/components/home/gallery-preview'
import { Testimonials } from '@/components/home/testimonials'
import { ReservationCta } from '@/components/home/reservation-cta'

export default function HomePage() {
  return (
    <>
      <Hero />
      <Pillars />
      <Intro />
      <Accommodation />
      <Routine />
      <Trust />
      <GalleryPreview />
      <Testimonials />
      <ReservationCta />
    </>
  )
}
