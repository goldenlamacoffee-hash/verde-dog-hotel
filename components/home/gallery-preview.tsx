import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { SectionHeading } from '@/components/common/section-heading'
import { galleryImages } from '@/content/gallery'

const preview = galleryImages.slice(0, 5)

export function GalleryPreview() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="Galerie"
            title="Nahlédněte k nám"
            withSprig
            description="Prostředí, zázemí a každodenní život psů ve Verde."
          />
          <Link
            href="/galerie"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-verde-green transition-colors hover:text-verde-deep"
          >
            Celá galerie
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-2">
          {preview.map((img, i) => (
            <div
              key={img.src}
              className={
                i === 0
                  ? 'relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-2xl lg:aspect-auto'
                  : 'relative aspect-square overflow-hidden rounded-2xl'
              }
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
