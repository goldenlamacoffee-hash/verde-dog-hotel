/**
 * Typed content layer for VERDE.
 *
 * All public content is defined against these types so it can later be
 * replaced by a database-backed CMS without touching the components.
 */

export interface NavItem {
  label: string
  href: string
}

export interface ContactDetails {
  phone: string
  phoneHref: string
  email: string
  web: string
  addressLines: string[]
  region: string
  openingHours: { days: string; hours: string }[]
  instagram?: string
  facebook?: string
  company: {
    name: string
    ico?: string
    dic?: string
  }
}

export interface SiteSettings {
  name: string
  tagline: string
  slogan: string
  defaultTitle: string
  defaultDescription: string
  contact: ContactDetails
  legalLinks: NavItem[]
}

export interface Pillar {
  /** lucide icon name resolved in the component */
  icon: 'tree' | 'paw' | 'house' | 'heart' | 'leaf'
  title: string
  description: string
}

export interface FeatureCard {
  title: string
  description: string
  image: string
  imageAlt: string
  detailsHref?: string
}

export interface RoutineStep {
  time: string
  title: string
  description: string
}

export interface TrustItem {
  title: string
  description: string
}

export interface Testimonial {
  /** demo/CMS content until real reviews are supplied */
  quote: string
  author: string
  context: string
}

export interface GalleryImage {
  src: string
  alt: string
  category: 'hotel' | 'exterier' | 'psi' | 'pece'
  width: number
  height: number
}

export interface FaqItem {
  question: string
  answer: string
  category: string
}

export type ServiceUnit = 'per-stay' | 'per-night' | 'per-walk' | 'per-day' | 'one-off'

export interface ServiceOption {
  id: string
  title: string
  description: string
  price: number
  unit: ServiceUnit
  /** included by default in a standard stay */
  standard?: boolean
}

export interface PriceItem {
  id: string
  title: string
  description: string
  price: number
  unit: ServiceUnit
  featured?: boolean
}

export interface TeamMember {
  name: string
  role: string
}

// ─── Calendar appearance ──────────────────────────────────────────────────────

/**
 * Stored under site_settings key `availabilityCalendarAppearance`.
 * All values must be valid CSS hex colors (#RRGGBB or #RGB).
 */
export interface CalendarAppearance {
  availableBackground: string
  availableText:       string
  limitedBackground:   string
  limitedText:         string
  lastBackground:      string
  lastText:            string
  fullBackground:      string
  fullText:            string
  selectedBackground:  string
  selectedText:        string
  rangeBackground:     string
  todayBorder:         string
}

/** VERDE brand defaults — used as fallback when CMS value is missing/invalid. */
export const CALENDAR_APPEARANCE_DEFAULTS: CalendarAppearance = {
  availableBackground: '#E6F4EA',
  availableText:       '#14532D',
  limitedBackground:   '#FFF1B8',
  limitedText:         '#7A4B00',
  lastBackground:      '#FFD7B5',
  lastText:            '#8A2C0D',
  fullBackground:      '#FADDDD',
  fullText:            '#991B1B',
  selectedBackground:  '#174C2D',
  selectedText:        '#FFFFFF',
  rangeBackground:     '#D5E9DA',
  todayBorder:         '#315E41',
}

/**
 * Canonical shape of the `contact` row in site_settings.
 * Used by: admin save action, admin editor, public-data helper,
 * /kontakt page, and SiteFooter — one definition, no drift.
 *
 * Key names match exactly what the admin editor saves to the DB.
 */
export interface ContactSettingsValue {
  phone?: string
  email?: string
  address?: string
  web?: string
  facebook?: string
  instagram?: string
  /** Serialised opening hours array saved by the admin editor. */
  openingHours?: { days: string; hours: string }[]
}
