import type { NavItem, SiteSettings } from '@/lib/types'

export const navigation: NavItem[] = [
  { label: 'Domů', href: '/' },
  { label: 'O hotelu', href: '/o-hotelu' },
  { label: 'Péče a ubytování', href: '/pece-a-ubytovani' },
  { label: 'Ceník', href: '/cenik' },
  { label: 'Galerie', href: '/galerie' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Kontakt', href: '/kontakt' },
]

export const siteSettings: SiteSettings = {
  name: 'VERDE',
  tagline: 'Psí hotel v srdci přírody',
  slogan: 'Kde jsou psi jako doma',
  defaultTitle: 'VERDE | Psí hotel v srdci přírody',
  defaultDescription:
    'Individuální péče, bezpečné zázemí a pobyt v přírodě pro vašeho psa.',
  contact: {
    // TODO(cms): editable placeholders — treat as demo until confirmed.
    phone: '+420 777 123 456',
    phoneHref: 'tel:+420777123456',
    email: 'info@verdehotel.cz',
    web: 'www.verdehotel.cz',
    addressLines: ['Adresa bude doplněna'],
    region: 'Brno – venkov',
    openingHours: [
      { days: 'Příjezdy a odjezdy', hours: 'po domluvě' },
      { days: 'Telefonicky', hours: '9:00 – 18:00' },
    ],
    instagram: '#',
    facebook: '#',
    company: {
      name: 'VERDE',
    },
  },
  legalLinks: [
    { label: 'Obchodní podmínky', href: '/podminky/obchodni' },
    { label: 'Podmínky pobytu', href: '/podminky/pobyt' },
    { label: 'Storno podmínky', href: '/podminky/storno' },
    { label: 'Ochrana osobních údajů', href: '/podminky/osobni-udaje' },
    { label: 'Cookies', href: '/podminky/cookies' },
  ],
}
