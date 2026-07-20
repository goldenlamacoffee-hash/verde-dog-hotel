import type { GalleryImage } from '@/lib/types'

export const galleryCategories: { id: GalleryImage['category'] | 'vse'; label: string }[] = [
  { id: 'vse', label: 'Vše' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'exterier', label: 'Přírodní prostředí' },
  { id: 'psi', label: 'Psi' },
  { id: 'pece', label: 'Každodenní péče' },
]

export const galleryImages: GalleryImage[] = [
  {
    src: '/images/gallery/gallery-06.png',
    alt: 'Psi odpočívající v dřevěném zázemí hotelu',
    category: 'hotel',
    width: 1200,
    height: 900,
  },
  {
    src: '/images/gallery/gallery-02.png',
    alt: 'Pes běžící lesní mýtinou',
    category: 'psi',
    width: 1200,
    height: 900,
  },
  {
    src: '/images/gallery/gallery-03.png',
    alt: 'Pečovatel hladí klidného psa venku',
    category: 'pece',
    width: 1200,
    height: 900,
  },
  {
    src: '/images/gallery/gallery-04.png',
    alt: 'Venkovský areál psího hotelu mezi stromy',
    category: 'exterier',
    width: 1200,
    height: 900,
  },
  {
    src: '/images/gallery/gallery-05.png',
    alt: 'Pes u misky během krmení',
    category: 'pece',
    width: 1200,
    height: 900,
  },
  {
    src: '/images/gallery/gallery-01.png',
    alt: 'Pes odpočívající na pelíšku v útulném zázemí',
    category: 'hotel',
    width: 1200,
    height: 900,
  },
  {
    src: '/images/dogs-outdoor-01.png',
    alt: 'Psi na procházce ve venkovním výběhu',
    category: 'psi',
    width: 1200,
    height: 900,
  },
  {
    src: '/images/hotel-exterior-01.png',
    alt: 'Přírodní oplocené zázemí psího hotelu',
    category: 'exterier',
    width: 1200,
    height: 900,
  },
]
