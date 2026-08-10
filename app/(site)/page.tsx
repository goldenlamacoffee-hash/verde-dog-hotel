import { Hero } from '@/components/home/hero'
import { Pillars } from '@/components/home/pillars'
import { Intro } from '@/components/home/intro'
import { Accommodation } from '@/components/home/accommodation'
import { Routine } from '@/components/home/routine'
import { Trust } from '@/components/home/trust'
import { GalleryPreview } from '@/components/home/gallery-preview'
import { Testimonials } from '@/components/home/testimonials'
import { ReservationCta } from '@/components/home/reservation-cta'
import { getPublicTestimonials, getPublicPageSections, getPublicGalleryImages } from '@/lib/public-data'

export default async function HomePage() {
  const [testimonials, sections, galleryImages] = await Promise.all([
    getPublicTestimonials(),
    getPublicPageSections('home'),
    getPublicGalleryImages(),
  ])

  return (
    <>
      <Hero cms={sections.hero} />
      <Pillars cms={sections.pillars} />
      <Intro cms={sections.intro} />
      <Accommodation cms={sections.accommodation} />
      <Routine cms={sections.routine} />
      <Trust cms={sections.trust} />
      <GalleryPreview images={galleryImages} />
      <Testimonials items={testimonials} />
      <ReservationCta cms={sections.cta} />
    </>
  )
}
