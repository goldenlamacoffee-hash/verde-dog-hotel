import type { PriceItem, ServiceOption } from '@/lib/types'

/**
 * Service definitions keyed by the slug stored in the `services` DB table.
 * IDs here MUST match the `slug` column — the API route resolves slugs to
 * UUIDs before calling the create_reservation RPC.
 *
 * DB slugs: overnight-stay, daycare, individual-walk, morning-walk,
 *           afternoon-walk, bath, nail-trim, transport, vet-visit
 */
export const services: ServiceOption[] = [
  {
    id: 'overnight-stay',
    title: 'Noční pobyt',
    description:
      'Ubytování ve vlastním klidném zázemí, krmení, každodenní pohyb a základní péče.',
    price: 490,
    unit: 'per-night',
    standard: true,
  },
  {
    id: 'daycare',
    title: 'Denní hlídání',
    description: 'Celodenní péče o vašeho psa v průběhu pracovního dne.',
    price: 350,
    unit: 'per-day',
  },
  {
    id: 'individual-walk',
    title: 'Individuální procházka',
    description: 'Delší procházka jen s vaším psem nad rámec běžného programu.',
    price: 150,
    unit: 'per-walk',
  },
  {
    id: 'morning-walk',
    title: 'Ranní procházka',
    description: 'Ranní vycházka před začátkem dne.',
    price: 100,
    unit: 'per-walk',
  },
  {
    id: 'afternoon-walk',
    title: 'Odpolední procházka',
    description: 'Odpolední procházka s individuální pozorností.',
    price: 100,
    unit: 'per-walk',
  },
  {
    id: 'bath',
    title: 'Koupání a sušení',
    description: 'Profesionální koupel a sušení pro svěžího a upraveného psa.',
    price: 300,
    unit: 'per-stay',
  },
  {
    id: 'nail-trim',
    title: 'Stříhání drápků',
    description: 'Bezpečné a šetrné zastřižení drápků zkušenou osobou.',
    price: 120,
    unit: 'per-stay',
  },
  {
    id: 'transport',
    title: 'Svoz / odvoz',
    description: 'Doprava psa po domluvě v okolí Brna a přilehlých obcí.',
    price: 400,
    unit: 'one-off',
  },
  {
    id: 'vet-visit',
    title: 'Veterinární výjezd',
    description: 'Doprovod k veterináři a asistence při vyšetření v případě potřeby.',
    price: 500,
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
    id: 'daycare',
    title: 'Denní hlídání',
    description: 'Celodenní péče o vašeho psa.',
    price: 350,
    unit: 'per-day',
  },
  {
    id: 'individual-walk',
    title: 'Individuální procházka',
    description: 'Procházka navíc jen s vaším psem.',
    price: 150,
    unit: 'per-walk',
  },
  {
    id: 'bath',
    title: 'Koupání a sušení',
    description: 'Profesionální koupel a sušení.',
    price: 300,
    unit: 'per-stay',
  },
  {
    id: 'nail-trim',
    title: 'Stříhání drápků',
    description: 'Šetrné zastřižení drápků.',
    price: 120,
    unit: 'per-stay',
  },
  {
    id: 'transport',
    title: 'Svoz / odvoz',
    description: 'Doprava psa po domluvě.',
    price: 400,
    unit: 'one-off',
  },
  {
    id: 'vet-visit',
    title: 'Veterinární výjezd',
    description: 'Doprovod k veterináři při potřebě.',
    price: 500,
    unit: 'one-off',
  },
]
