'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { galleryCategories as staticCategories, galleryImages as staticImages } from '@/content/gallery'
import type { GalleryImage } from '@/lib/types'

type Filter = string

interface GalleryGridProps {
  /** Admin-managed photos from the CMS. Falls back to static content when omitted/empty. */
  images?: GalleryImage[]
  /** Filter tabs matching `images`. Falls back to the static category list when omitted. */
  categories?: { id: string; label: string }[]
}

export function GalleryGrid({ images, categories }: GalleryGridProps) {
  const hasCmsImages = !!images && images.length > 0
  const allImages = hasCmsImages ? images : staticImages
  const filterTabs = hasCmsImages && categories ? categories : staticCategories

  const [filter, setFilter] = useState<Filter>(filterTabs[0]?.id ?? 'vse')
  const [active, setActive] = useState<GalleryImage | null>(null)

  const visible =
    filter === filterTabs[0]?.id
      ? allImages
      : allImages.filter((img) => img.category === filter)

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="Filtr galerie">
        {filterTabs.map((cat) => {
          const selected = filter === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(cat.id)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                selected
                  ? 'border-verde-green bg-verde-green text-verde-white'
                  : 'border-border bg-card text-verde-moss hover:border-verde-green/40 hover:text-verde-deep',
              )}
            >
              {cat.label}
            </button>
          )
        })}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {visible.map((img) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setActive(img)}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-verde-green focus-visible:ring-offset-2"
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="(min-width: 768px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-verde-deep/0 transition-colors group-hover:bg-verde-deep/15" />
          </button>
        ))}
      </div>

      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.alt}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-verde-deep/85 p-4 backdrop-blur-sm"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            aria-label="Zavřít"
            onClick={() => setActive(null)}
            className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-full bg-verde-white/10 text-verde-white transition-colors hover:bg-verde-white/20"
          >
            <X className="size-5" />
          </button>
          <figure
            className="relative max-h-[85vh] w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
              <Image src={active.src} alt={active.alt} fill className="object-cover" sizes="90vw" />
            </div>
            <figcaption className="mt-3 text-center text-sm text-verde-white/80">
              {active.alt}
            </figcaption>
          </figure>
        </div>
      ) : null}
    </div>
  )
}
