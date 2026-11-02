/**
 * Declarative description of the "Nastavení webu" CMS.
 * Pure data (no React) so it can be used from server and client components.
 *
 * Every page section is edited through the same schema-driven form; sections
 * that are not described here fall back to a schema inferred from their content,
 * so no existing DB data is ever hidden from the editor.
 */

export type ScalarFieldType = 'text' | 'textarea'

export type FieldDef =
  | { type: 'text'; key: string; label: string; hint?: string; half?: boolean }
  | { type: 'textarea'; key: string; label: string; hint?: string; rows?: number }
  | { type: 'image'; key: string; label: string; altKey?: string }
  | {
      type: 'list'
      key: string
      label: string
      itemLabel: string
      addLabel: string
      multiline?: boolean
      hint?: string
    }
  | {
      type: 'cards'
      key: string
      label: string
      itemLabel: string
      addLabel: string
      /** Key whose value is used as the card title in the collapsed header. */
      titleKey?: string
      fields: FieldDef[]
      hint?: string
    }
  | { type: 'object'; key: string; label: string; fields: FieldDef[] }
  | {
      type: 'flatCards'
      prefix: string
      count: number
      label: string
      itemLabel: string
      fields: FieldDef[]
    }

export interface SectionDef {
  key: string
  label: string
  description: string
  fields?: FieldDef[]
}

export interface PageDef {
  slug: string
  dbPage: string
  label: string
  description: string
  /** Public route, `/` for home. */
  href: string
  sections: SectionDef[]
}

// ─── Reusable field groups ───────────────────────────────────────────────────

const heading = (withEyebrow = true): FieldDef[] => [
  ...(withEyebrow ? [{ type: 'text', key: 'eyebrow', label: 'Nadpis nad titulkem', hint: 'Krátký popisek nad hlavním nadpisem.' } as FieldDef] : []),
  { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
  { type: 'textarea', key: 'description', label: 'Popis', rows: 3 },
]

const titleDescriptionCards = (
  key: string,
  label: string,
  itemLabel: string,
  addLabel: string,
): FieldDef => ({
  type: 'cards',
  key,
  label,
  itemLabel,
  addLabel,
  titleKey: 'title',
  fields: [
    { type: 'text', key: 'title', label: 'Název' },
    { type: 'textarea', key: 'description', label: 'Popis', rows: 3 },
  ],
})

const accommodationCards: FieldDef = {
  type: 'flatCards',
  prefix: 'card',
  count: 3,
  label: 'Informační karty',
  itemLabel: 'Karta',
  fields: [
    { type: 'image', key: 'image', label: 'Fotografie', altKey: 'image_alt' },
    { type: 'text', key: 'title', label: 'Název' },
    { type: 'textarea', key: 'description', label: 'Popis', rows: 3 },
    { type: 'text', key: 'cta_label', label: 'Text odkazu', half: true },
    { type: 'text', key: 'cta_href', label: 'Adresa odkazu', half: true },
  ],
}

// ─── Pages ───────────────────────────────────────────────────────────────────

export const PAGES: PageDef[] = [
  {
    slug: 'home',
    dbPage: 'home',
    label: 'Domů',
    description: 'Úvodní stránka webu',
    href: '/',
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        description: 'Úvodní banner s hlavním sdělením a tlačítky',
        fields: [
          { type: 'text', key: 'badge', label: 'Štítek' },
          { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
          { type: 'text', key: 'subheadline', label: 'Podnadpis' },
          { type: 'textarea', key: 'description', label: 'Popis', rows: 3 },
          { type: 'text', key: 'cta_primary', label: 'Hlavní tlačítko', half: true },
          { type: 'text', key: 'cta_secondary', label: 'Vedlejší tlačítko', half: true },
          { type: 'image', key: 'image_url', label: 'Úvodní fotografie' },
        ],
      },
      {
        key: 'pillars',
        label: 'Pilíře',
        description: 'Čtyři důvody, proč si vybrat Verde',
        fields: [
          { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
          titleDescriptionCards('items', 'Pilíře', 'Pilíř', 'Přidat pilíř'),
        ],
      },
      {
        key: 'intro',
        label: 'Intro',
        description: 'Představení hotelu s fotografií a výčtem předností',
        fields: [
          { type: 'text', key: 'subheadline', label: 'Nadpis nad titulkem' },
          { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
          { type: 'textarea', key: 'description', label: 'Popis', rows: 4 },
          { type: 'image', key: 'image_url', label: 'Fotografie' },
          {
            type: 'cards',
            key: 'features',
            label: 'Přednosti',
            itemLabel: 'Přednost',
            addLabel: 'Přidat přednost',
            titleKey: 'text',
            fields: [{ type: 'text', key: 'text', label: 'Text' }],
          },
        ],
      },
      {
        key: 'accommodation',
        label: 'Ubytování',
        description: 'Krátké představení ubytování a informační karty',
        fields: [
          { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
          { type: 'textarea', key: 'description', label: 'Popis', rows: 3 },
          { type: 'list', key: 'features', label: 'Výčet vlastností', itemLabel: 'Vlastnost', addLabel: 'Přidat vlastnost' },
          accommodationCards,
        ],
      },
      {
        key: 'routine',
        label: 'Denní program',
        description: 'Jak vypadá den ve Verde, hodinu po hodině',
        fields: [
          { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
          { type: 'textarea', key: 'description', label: 'Popis', rows: 3 },
          {
            type: 'cards',
            key: 'schedule',
            label: 'Harmonogram dne',
            itemLabel: 'Položka',
            addLabel: 'Přidat položku',
            titleKey: 'title',
            fields: [
              { type: 'text', key: 'time', label: 'Čas', half: true },
              { type: 'text', key: 'title', label: 'Činnost', half: true },
            ],
          },
        ],
      },
      {
        key: 'trust',
        label: 'Důvěra',
        description: 'Proč nám můžete svěřit svého psa',
        fields: [
          ...heading(),
          titleDescriptionCards('items', 'Body důvěry', 'Bod', 'Přidat bod'),
        ],
      },
      {
        key: 'cta',
        label: 'CTA',
        description: 'Závěrečná výzva k rezervaci',
        fields: [
          { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
          { type: 'textarea', key: 'description', label: 'Popis', rows: 3 },
          { type: 'text', key: 'cta_primary', label: 'Hlavní tlačítko', half: true },
          { type: 'text', key: 'cta_secondary', label: 'Vedlejší tlačítko', half: true },
        ],
      },
    ],
  },
  {
    slug: 'pece-a-ubytovani',
    dbPage: 'pece-a-ubytovani',
    label: 'Péče a ubytování',
    description: 'Ubytování, denní péče, krmení a podmínky pobytu',
    href: '/pece-a-ubytovani',
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        description: 'Úvodní banner stránky',
        fields: [...heading(), { type: 'image', key: 'image_url', label: 'Úvodní fotografie' }],
      },
      {
        key: 'accommodation_detail',
        label: 'Ubytování – detail',
        description: 'Podrobné představení ubytování a informační karty',
        fields: [
          ...heading(),
          { type: 'list', key: 'features', label: 'Výčet vlastností', itemLabel: 'Vlastnost', addLabel: 'Přidat vlastnost' },
          accommodationCards,
        ],
      },
      {
        key: 'care_detail',
        label: 'Péče – detail',
        description: 'Denní program a péče o psy',
        fields: [
          ...heading(),
          {
            type: 'cards',
            key: 'schedule',
            label: 'Harmonogram dne',
            itemLabel: 'Položka',
            addLabel: 'Přidat položku',
            titleKey: 'activity',
            fields: [
              { type: 'text', key: 'time', label: 'Čas', half: true },
              { type: 'text', key: 'activity', label: 'Činnost', half: true },
            ],
          },
        ],
      },
      {
        key: 'feeding',
        label: 'Krmení',
        description: 'Jak krmíme a jak se řídíme vašimi pokyny',
        fields: [
          ...heading(),
          { type: 'list', key: 'notes', label: 'Poznámky ke krmení', itemLabel: 'Poznámka', addLabel: 'Přidat poznámku' },
        ],
      },
      {
        key: 'services_intro',
        label: 'Služby – úvod',
        description: 'Úvod k tomu, co je součástí pobytu',
        fields: heading(),
      },
      {
        key: 'requirements',
        label: 'Co s sebou',
        description: 'Podmínky pobytu a věci, které potřebujeme',
        fields: [
          { type: 'text', key: 'eyebrow', label: 'Nadpis nad titulkem' },
          { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
          titleDescriptionCards('items', 'Požadavky', 'Požadavek', 'Přidat požadavek'),
        ],
      },
      {
        key: 'cta',
        label: 'CTA',
        description: 'Výzva k rezervaci',
        fields: [
          { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
          { type: 'textarea', key: 'description', label: 'Popis', rows: 3 },
          { type: 'text', key: 'cta_primary', label: 'Hlavní tlačítko', half: true },
          { type: 'text', key: 'cta_secondary', label: 'Vedlejší tlačítko', half: true },
        ],
      },
    ],
  },
  {
    slug: 'o-hotelu',
    dbPage: 'o-hotelu',
    label: 'O hotelu',
    description: 'Příběh, tým, hodnoty a principy péče',
    href: '/o-hotelu',
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        description: 'Úvodní banner stránky',
        fields: heading(),
      },
      {
        key: 'story',
        label: 'Náš příběh',
        description: 'Příběh vzniku Verde s fotografií',
        fields: [
          { type: 'text', key: 'eyebrow', label: 'Nadpis nad titulkem' },
          { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
          { type: 'list', key: 'paragraphs', label: 'Odstavce', itemLabel: 'Odstavec', addLabel: 'Přidat odstavec', multiline: true },
          { type: 'image', key: 'image_url', label: 'Fotografie', altKey: 'image_alt' },
        ],
      },
      {
        key: 'team',
        label: 'Náš tým',
        description: 'Lidé, kteří se o psy starají',
        fields: [
          ...heading(),
          {
            type: 'cards',
            key: 'members',
            label: 'Členové týmu',
            itemLabel: 'Člen týmu',
            addLabel: 'Přidat člena týmu',
            titleKey: 'name',
            fields: [
              { type: 'text', key: 'name', label: 'Jméno', half: true },
              { type: 'text', key: 'role', label: 'Role', half: true },
              { type: 'textarea', key: 'bio', label: 'Krátké představení', rows: 3 },
            ],
          },
        ],
      },
      {
        key: 'values',
        label: 'Hodnoty',
        description: 'Co nás odlišuje',
        fields: [
          { type: 'text', key: 'eyebrow', label: 'Nadpis nad titulkem' },
          { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
          titleDescriptionCards('items', 'Hodnoty', 'Hodnota', 'Přidat hodnotu'),
        ],
      },
      {
        key: 'principles',
        label: 'Pět principů',
        description: 'Principy naší péče o psy',
        fields: [
          { type: 'text', key: 'eyebrow', label: 'Nadpis nad titulkem' },
          { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
          titleDescriptionCards('items', 'Principy', 'Princip', 'Přidat princip'),
        ],
      },
      {
        key: 'cta',
        label: 'CTA',
        description: 'Výzva k rezervaci',
        fields: [
          { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
          { type: 'textarea', key: 'description', label: 'Popis', rows: 3 },
          { type: 'text', key: 'cta_primary', label: 'Hlavní tlačítko', half: true },
          { type: 'text', key: 'cta_secondary', label: 'Vedlejší tlačítko', half: true },
        ],
      },
    ],
  },
  {
    slug: 'cenik',
    dbPage: 'cenik',
    label: 'Ceník',
    description: 'Texty ceníku. Služby a ceny se spravují v modulu Služby & Ceník.',
    href: '/cenik',
    sections: [
      { key: 'hero', label: 'Hero', description: 'Úvodní banner stránky', fields: heading() },
      {
        key: 'note',
        label: 'Podmínky a zvýhodnění',
        description: 'Co je v ceně, záloha, slevy a storno podmínky',
        fields: [
          { type: 'list', key: 'included', label: 'Co je v ceně', itemLabel: 'Položka', addLabel: 'Přidat položku' },
          { type: 'textarea', key: 'deposit_info', label: 'Záloha', rows: 2 },
          { type: 'textarea', key: 'long_stay_discount', label: 'Sleva za dlouhý pobyt', rows: 2 },
          { type: 'textarea', key: 'multi_dog_discount', label: 'Sleva pro více psů', rows: 2 },
          { type: 'textarea', key: 'cancellation_policy', label: 'Storno podmínky', rows: 2 },
        ],
      },
    ],
  },
  {
    slug: 'kontakt',
    dbPage: 'kontakt',
    label: 'Kontakt',
    description: 'Texty kontaktní stránky. Kontaktní údaje se upravují v globálních prvcích.',
    href: '/kontakt',
    sections: [
      { key: 'hero', label: 'Hero', description: 'Úvodní banner stránky', fields: heading() },
      {
        key: 'location',
        label: 'Lokalita',
        description: 'Jak nás najdete, parkování a doprava',
        fields: [
          { type: 'text', key: 'headline', label: 'Hlavní nadpis' },
          { type: 'textarea', key: 'address_note', label: 'Poznámka k adrese', rows: 2 },
          { type: 'text', key: 'parking', label: 'Parkování' },
          { type: 'text', key: 'public_transport', label: 'Veřejná doprava' },
        ],
      },
    ],
  },
]

/** Pages that exist in the CMS but are not part of the main sidebar structure. */
export const EXTRA_PAGES: PageDef[] = [
  {
    slug: 'faq',
    dbPage: 'faq',
    label: 'FAQ',
    description: 'Úvodní text stránky Časté dotazy',
    href: '/faq',
    sections: [{ key: 'hero', label: 'Hero', description: 'Úvodní banner stránky', fields: heading() }],
  },
  {
    slug: 'galerie',
    dbPage: 'galerie',
    label: 'Galerie',
    description: 'Úvodní text stránky Galerie',
    href: '/galerie',
    sections: [{ key: 'hero', label: 'Hero', description: 'Úvodní banner stránky', fields: heading() }],
  },
  {
    slug: 'rezervace',
    dbPage: 'rezervace',
    label: 'Rezervace',
    description: 'Úvodní text rezervačního formuláře',
    href: '/rezervace',
    sections: [{ key: 'hero', label: 'Hero', description: 'Úvodní banner stránky', fields: heading() }],
  },
  {
    slug: 'podminky',
    dbPage: 'podminky',
    label: 'Podmínky',
    description: 'Obchodní podmínky a ochrana osobních údajů',
    href: '/obchodni-podminky',
    sections: [
      { key: 'vseobecne-obchodni-podminky', label: 'Všeobecné obchodní podmínky', description: 'Právní text obchodních podmínek' },
      { key: 'ochrana-osobnich-udaju', label: 'Ochrana osobních údajů', description: 'Právní text o zpracování osobních údajů' },
    ],
  },
]

export const ALL_PAGES: PageDef[] = [...PAGES, ...EXTRA_PAGES]

export function getPageBySlug(slug: string) {
  return ALL_PAGES.find(p => p.slug === slug)
}

// ─── Global screens ──────────────────────────────────────────────────────────

const linkFields: FieldDef[] = [
  { type: 'text', key: 'label', label: 'Text odkazu', half: true },
  { type: 'text', key: 'href', label: 'Adresa odkazu', half: true },
]

export const HEADER_SECTION: SectionDef = {
  key: 'header',
  label: 'Hlavička a navigace',
  description: 'Hlavní menu a tlačítko v hlavičce webu',
  fields: [
    {
      type: 'cards',
      key: 'nav',
      label: 'Položky menu',
      itemLabel: 'Odkaz',
      addLabel: 'Přidat odkaz',
      titleKey: 'label',
      fields: linkFields,
    },
    { type: 'object', key: 'cta', label: 'Tlačítko v hlavičce', fields: linkFields },
  ],
}

export const FOOTER_SECTION: SectionDef = {
  key: 'footer',
  label: 'Patička',
  description: 'Slogan, popis a odkazy v patičce webu',
  fields: [
    { type: 'text', key: 'tagline', label: 'Slogan' },
    { type: 'textarea', key: 'description', label: 'Krátký popis', rows: 3 },
    {
      type: 'cards',
      key: 'links_info',
      label: 'Odkazy – navigace',
      itemLabel: 'Odkaz',
      addLabel: 'Přidat odkaz',
      titleKey: 'label',
      fields: linkFields,
    },
    {
      type: 'cards',
      key: 'links_services',
      label: 'Odkazy – služby',
      itemLabel: 'Odkaz',
      addLabel: 'Přidat odkaz',
      titleKey: 'label',
      fields: linkFields,
    },
  ],
}

export interface GlobalScreen {
  slug: string
  label: string
  description: string
}

export const GLOBAL_SCREENS: GlobalScreen[] = [
  { slug: 'header', label: 'Hlavička a navigace', description: 'Menu a tlačítko v hlavičce' },
  { slug: 'footer', label: 'Patička', description: 'Slogan a odkazy v patičce' },
  { slug: 'seo', label: 'SEO', description: 'Titulek a popis pro vyhledávače' },
  { slug: 'brand', label: 'Brand', description: 'Loga a sdílený obrázek' },
  { slug: 'kontaktni-udaje', label: 'Kontaktní údaje', description: 'Telefon, adresa, otevírací doba a lokalita' },
  { slug: 'provoz', label: 'Provoz a kapacita', description: 'Maximální počet psů a boxů' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Keys whose first image-like value is used as a section card thumbnail. */
const THUMBNAIL_KEYS = ['image_url', 'card_0_image', 'image', 'locationImageUrl']

export function sectionThumbnail(content: Record<string, unknown>): string | null {
  for (const key of THUMBNAIL_KEYS) {
    const v = content[key]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}

const KEY_LABELS: Record<string, string> = {
  title: 'Název',
  headline: 'Hlavní nadpis',
  description: 'Popis',
  eyebrow: 'Nadpis nad titulkem',
  body: 'Text',
  heading: 'Nadpis',
  text: 'Text',
  label: 'Text odkazu',
  href: 'Adresa odkazu',
  name: 'Jméno',
  role: 'Role',
  time: 'Čas',
  effective_date: 'Datum účinnosti',
  sections: 'Oddíly',
}

function humanize(key: string) {
  return KEY_LABELS[key] ?? key.replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase())
}

const LONG_TEXT_KEYS = /(description|body|bio|text|paragraph|note|policy|info)/i
const HIDDEN_KEYS = new Set(['icon'])

/**
 * Infers an editing schema from existing JSON content. Used for sections that
 * have no hand-written definition, so every stored field stays editable.
 */
export function inferFields(content: Record<string, unknown>): FieldDef[] {
  const fields: FieldDef[] = []
  for (const [key, value] of Object.entries(content)) {
    if (HIDDEN_KEYS.has(key)) continue
    const label = humanize(key)
    if (typeof value === 'string') {
      if (/^https?:\/\/.+\.(png|jpe?g|webp|avif|gif|svg)(\?.*)?$/i.test(value) || /(image|logo)/i.test(key)) {
        fields.push({ type: 'image', key, label })
      } else if (value.length > 90 || value.includes('\n') || LONG_TEXT_KEYS.test(key)) {
        fields.push({ type: 'textarea', key, label, rows: value.length > 300 ? 8 : 3 })
      } else {
        fields.push({ type: 'text', key, label })
      }
    } else if (Array.isArray(value)) {
      if (value.every(v => typeof v === 'string')) {
        fields.push({ type: 'list', key, label, itemLabel: 'Položka', addLabel: 'Přidat položku', multiline: value.some(v => String(v).length > 90) })
      } else {
        const first = value.find(v => v && typeof v === 'object') as Record<string, unknown> | undefined
        fields.push({
          type: 'cards',
          key,
          label,
          itemLabel: 'Položka',
          addLabel: 'Přidat položku',
          titleKey: first ? ['title', 'heading', 'name', 'label', 'text'].find(k => k in first) : undefined,
          fields: first ? inferFields(first) : [],
        })
      }
    } else if (value && typeof value === 'object') {
      fields.push({ type: 'object', key, label, fields: inferFields(value as Record<string, unknown>) })
    } else if (typeof value === 'number') {
      fields.push({ type: 'text', key, label })
    }
  }
  return fields
}
