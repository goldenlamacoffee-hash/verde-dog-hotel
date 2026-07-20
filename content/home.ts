import type {
  FeatureCard,
  Pillar,
  RoutineStep,
  Testimonial,
  TrustItem,
} from '@/lib/types'

export const pillars: Pillar[] = [
  {
    icon: 'tree',
    title: 'Přírodní prostředí',
    description:
      'Klidné venkovské zázemí obklopené zelení, kde má pes dostatek prostoru a čerstvého vzduchu.',
  },
  {
    icon: 'paw',
    title: 'Individuální péče',
    description:
      'Poznáme povahu i zvyky vašeho psa a přizpůsobíme jim celý pobyt.',
  },
  {
    icon: 'house',
    title: 'Pohodlí a bezpečí',
    description:
      'Zabezpečené prostory, vlastní místo k odpočinku a stálý dohled.',
  },
  {
    icon: 'heart',
    title: 'Láska a respekt',
    description:
      'K psům přistupujeme trpělivě, s ohledem na jejich tempo a potřeby.',
  },
  {
    icon: 'leaf',
    title: 'Aktivní vyžití',
    description:
      'Procházky, pohyb a hry vyvážené s dostatkem klidu a odpočinku.',
  },
]

export const accommodationCards: FeatureCard[] = [
  {
    title: 'Vlastní místo k odpočinku',
    description:
      'Každý pes má svůj klidný prostor s pohodlným pelíškem, kde načerpá síly a cítí se bezpečně.',
    image: '/images/hotel-interior-01.png',
    imageAlt: 'Pes odpočívající v útulném dřevěném zázemí',
    detailsHref: '/pece-a-ubytovani',
  },
  {
    title: 'Bezpečné přírodní zázemí',
    description:
      'Oplocené venkovní prostory v přírodě umožňují pohyb i hru bez rizika a bez stresu.',
    image: '/images/hotel-exterior-01.png',
    imageAlt: 'Přírodní oplocené zázemí psího hotelu mezi stromy',
    detailsHref: '/pece-a-ubytovani',
  },
  {
    title: 'Péče přizpůsobená vašemu psovi',
    description:
      'Krmení, pohyb i odpočinek nastavujeme podle zvyklostí a potřeb konkrétního psa.',
    image: '/images/dogs-outdoor-01.png',
    imageAlt: 'Psi na procházce ve venkovním výběhu',
    detailsHref: '/pece-a-ubytovani',
  },
]

export const routine: RoutineStep[] = [
  {
    time: 'Ráno',
    title: 'Ranní péče a krmení',
    description:
      'Klidný start dne, krmení podle zavedeného režimu a kontrola pohody každého psa.',
  },
  {
    time: 'Dopoledne',
    title: 'Procházka a venkovní aktivita',
    description:
      'Pohyb v přírodě, hry a čas venku přizpůsobené kondici a temperamentu psa.',
  },
  {
    time: 'Poledne',
    title: 'Odpočinek v klidném zázemí',
    description:
      'Prostor pro spánek a regeneraci ve vlastním klidném místě bez rušení.',
  },
  {
    time: 'Odpoledne',
    title: 'Individuální program a kontakt',
    description:
      'Čas věnovaný přímo vašemu psovi — mazlení, trénink nebo klidná procházka.',
  },
  {
    time: 'Večer',
    title: 'Večerní péče a kontrola',
    description:
      'Poslední venčení, krmení a kontrola před nočním klidem.',
  },
]

export const trustItems: TrustItem[] = [
  {
    title: 'Pravidelné informace o pobytu',
    description:
      'Domluvíme se, jak a jak často vás budeme o pobytu vašeho psa informovat.',
  },
  {
    title: 'Individuální záznamy ke každému psovi',
    description:
      'Zvyky, krmení, léky i potřeby evidujeme, aby péče odpovídala každému psovi.',
  },
  {
    title: 'Jasně stanovený režim a požadavky',
    description:
      'Předem víte, co pobyt obnáší, co s sebou přivézt a jaké podmínky platí.',
  },
  {
    title: 'Ověřené kontaktní a zdravotní informace',
    description:
      'Zdravotní údaje a nouzové kontakty máme připravené pro každou situaci.',
  },
]

export const testimonials: Testimonial[] = [
  // TODO(cms): demo obsah — nahradit skutečnými recenzemi po jejich získání.
  {
    quote:
      'Ukázková reference. Zde se po spuštění zobrazí skutečná zkušenost majitele psa s pobytem ve Verde.',
    author: 'Majitel psa',
    context: 'Demo obsah',
  },
  {
    quote:
      'Ukázková reference. Prostor pro popis přístupu, komunikace a spokojenosti se službami hotelu Verde.',
    author: 'Majitelka psa',
    context: 'Demo obsah',
  },
  {
    quote:
      'Ukázková reference. Text bude nahrazen ověřeným hodnocením po prvních pobytech.',
    author: 'Klient Verde',
    context: 'Demo obsah',
  },
]
