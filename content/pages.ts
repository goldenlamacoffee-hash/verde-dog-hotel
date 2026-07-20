import type { FeatureCard, TeamMember, TrustItem } from '@/lib/types'

export const aboutIntro = {
  eyebrow: 'O hotelu Verde',
  heading: 'Psí hotel, který vznikl z respektu k psům.',
  paragraphs: [
    'Verde je psí hotel v klidném venkovském prostředí nedaleko Brna. Vznikl z přesvědčení, že pes si i během vaší nepřítomnosti zaslouží péči, bezpečí a dostatek přírody.',
    'Nejsme veterinární klinika ani hlučná psí školka. Jsme klidné místo, kde má každý pes svůj vlastní rytmus a kde péče začíná tím, že psa nejdříve poznáme.',
  ],
}

export const aboutValues: TrustItem[] = [
  {
    title: 'Individuální přístup',
    description:
      'Respektujeme povahu, zvyky a tempo každého psa. Program nešijeme na míru skupině, ale konkrétnímu psovi.',
  },
  {
    title: 'Bezpečí na prvním místě',
    description:
      'Zabezpečené prostory, přehledný režim a stálý dohled snižují stres a riziko na minimum.',
  },
  {
    title: 'Přírodní prostředí',
    description:
      'Zeleň, čerstvý vzduch a prostor pro pohyb jsou přirozenou součástí každého dne.',
  },
]

export const teamMembers: TeamMember[] = [
  // TODO(cms): doplnit skutečné členy týmu a jejich role.
  { name: 'Jméno bude doplněno', role: 'Péče o psy' },
  { name: 'Jméno bude doplněno', role: 'Péče o psy' },
]

export const careSections: FeatureCard[] = [
  {
    title: 'Ubytování',
    description:
      'Klidné, čisté a bezpečné zázemí s vlastním místem k odpočinku pro každého psa.',
    image: '/images/hotel-interior-01.png',
    imageAlt: 'Vnitřní zázemí psího hotelu',
  },
  {
    title: 'Krmení',
    description:
      'Zachováváme zavedený krmný režim. Vlastní krmivo je vítané a doporučené.',
    image: '/images/gallery/gallery-05.png',
    imageAlt: 'Pes u misky během krmení',
  },
  {
    title: 'Procházky a pohyb',
    description:
      'Pravidelný pohyb v přírodě vyvážený s dostatkem klidu a odpočinku.',
    image: '/images/gallery/gallery-02.png',
    imageAlt: 'Pes běžící v přírodě',
  },
  {
    title: 'Podávání léků',
    description:
      'Léky podáváme přesně podle pokynů majitele a veterináře.',
    image: '/images/gallery/gallery-03.png',
    imageAlt: 'Pečovatel se stará o psa',
  },
]

export const careConditions: string[] = [
  'Platné očkování a doložený očkovací průkaz.',
  'Dobrý zdravotní stav bez přenosných onemocnění.',
  'Pravdivé informace o povaze a zvycích psa.',
  'Kontakt na majitele a nouzový kontakt po celou dobu pobytu.',
  'Kontakt na veterinárního lékaře.',
]

export const careBring: string[] = [
  'Vlastní krmivo s pokyny k dávkování.',
  'Případné léky s přesným rozpisem.',
  'Oblíbenou hračku nebo deku pro pocit domova.',
  'Očkovací průkaz.',
]
