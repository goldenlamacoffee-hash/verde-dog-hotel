import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/page-header'
import { GalleryGrid } from '@/components/gallery/gallery-grid'
import { ReservationCta } from '@/components/home/reservation-cta'
import { getPublicGalleryImages, getPublicPageSection } from '@/lib/public-data'

export const metadata: Metadata = {
  title: 'Galerie',
  description:
    'Prohlédněte si prostředí psího hotelu VERDE — zázemí, přírodní okolí a každodenní život psů u nás.',
}

/** Friendly Czech labels for the admin's suggested gallery categories. */
const CATEGORY_LABELS: Record<string, string> = {
  ubytovani: 'Ubytování',
  venku: 'Venku',
  pece: 'Péče',
  detail: 'Detail',
}

export default async function GalleryPage() {
  const hero = await getPublicPageSection('galerie', 'hero')
  const cmsImages = await getPublicGalleryImages()

  // Build filter tabs from the categories actually present in the CMS data
  // (excluding the catch-all "all" bucket, which items with no category use).
  const cmsCategories = cmsImages
    ? Array.from(new Set(cmsImages.map((img) => img.category).filter((c) => c !== 'all')))
    : []
  const categories = cmsImages
    ? [
        { id: 'vse', label: 'Vše' },
        ...cmsCategories.map((id) => ({ id, label: CATEGORY_LABELS[id] ?? id })),
      ]
    : undefined

  return (
    <>
      <PageHeader
        eyebrow={(hero?.eyebrow as string) ?? 'Galerie'}
        title={(hero?.headline as string) ?? 'Život ve Verde v obrazech'}
        description={(hero?.description as string) ?? 'Zázemí, příroda a spokojení psi. Klikněte na fotku pro její zvětšení.'}
      />

      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <GalleryGrid images={cmsImages ?? undefined} categories={categories} />
        </div>
      </section>

      <ReservationCta />
    </>
  )
}
