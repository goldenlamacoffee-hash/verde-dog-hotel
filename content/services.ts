import type { PriceItem, ServiceOption } from '@/lib/types'

/**
 * Data-driven mock services. Prices are placeholders for the prototype and are
 * structured so they can later come from a database / CMS.
 */
export const services: ServiceOption[] = [
  {
    id: 'standard',
    title: 'Standardní pobyt',
    description:
      'Ubytování ve vlastním klidném zázemí, krmení, každodenní pohyb a základní péče.',
    price: 490,
    unit: 'per-night',
    standard: true,
  },
  {
    id: 'individual-walk',
    title: 'Individuální procházka',
    description: 'Delší procházka jen s vaším psem nad rámec běžného programu.',
    price: 150,
    unit: 'per-walk',
  },
  {
    id: 'medication',
    title: 'Podávání léků',
    description: 'Pravidelné podávání léků podle pokynů majitele a veterináře.',
    price: 60,
    unit: 'per-day',
  },
  {
    id: 'own-food',
    title: 'Vlastní krmení',
    description: 'Podávání vámi dodaného krmiva podle zavedeného režimu.',
    price: 0,
    unit: 'per-stay',
  },
  {
    id: 'photos',
    title: 'Fotografie z pobytu',
    description: 'Pravidelné fotky vašeho psa z běžného dne v hotelu.',
    price: 200,
    unit: 'per-stay',
  },
  {
    id: 'activity',
    title: 'Individuální aktivita',
    description: 'Cílený trénink, hry nebo klidný nácvik podle potřeb psa.',
    price: 250,
    unit: 'per-day',
  },
  {
    id: 'transport',
    title: 'Vyzvednutí nebo doprava',
    description: 'Doprava psa po domluvě v okolí Brna a přilehlých obcí.',
    price: 400,
    unit: 'one-off',
  },
]

export const priceItems: PriceItem[] = [
  {
    id: 'base',
    title: 'Základní cena za noc',
    description: 'Standardní pobyt jednoho psa včetně krmení a pohybu.',
    price: 490,
    unit: 'per-night',
    featured: true,
  },
  {
    id: 'additional-dog',
    title: 'Každý další pes',
    description: 'Zvýhodněná cena pro psy z jedné domácnosti.',
    price: 390,
    unit: 'per-night',
  },
  {
    id: 'individual-walk',
    title: 'Individuální procházka',
    description: 'Procházka navíc jen s vaším psem.',
    price: 150,
    unit: 'per-walk',
  },
  {
    id: 'medication',
    title: 'Podávání léků',
    description: 'Podávání léků dle pokynů.',
    price: 60,
    unit: 'per-day',
  },
  {
    id: 'photos',
    title: 'Fotografie z pobytu',
    description: 'Fotoreport z běžného dne.',
    price: 200,
    unit: 'per-stay',
  },
  {
    id: 'transport',
    title: 'Vyzvednutí nebo doprava',
    description: 'Doprava psa po domluvě.',
    price: 400,
    unit: 'one-off',
  },
]
