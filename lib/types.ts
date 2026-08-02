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

// ─── Availability month / day status ─────────────────────────────────────────

/**
 * Publication state stored in `availability_months.status`.
 * - 'draft'     — month is being planned; public calendar treats it as unreleased
 * - 'published' — month is live; per-day open/closed flags are respected
 */
export type MonthStatus = 'draft' | 'published'

/**
 * Derived per-day state visible to the public calendar and the API.
 * - 'unreleased' — month is draft or not yet created; shown as greyed out / unavailable
 * - 'closed'     — month is published but the day is explicitly closed by admin
 * - 'open'       — month is published and the day is open for arrivals
 */
export type DayState = 'open' | 'closed' | 'unreleased'

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
  /** Explicitly closed day (month published, is_open = false) */
  closedBackground:    string
  closedText:          string
  /** Unreleased day (month draft or not yet created) */
  unreleasedBackground: string
  unreleasedText:       string
}

/** VERDE brand defaults — used as fallback when CMS value is missing/invalid. */
export const CALENDAR_APPEARANCE_DEFAULTS: CalendarAppearance = {
  availableBackground:  '#E6F4EA',
  availableText:        '#14532D',
  limitedBackground:    '#FFF1B8',
  limitedText:          '#7A4B00',
  lastBackground:       '#FFD7B5',
  lastText:             '#8A2C0D',
  fullBackground:       '#FADDDD',
  fullText:             '#991B1B',
  selectedBackground:   '#174C2D',
  selectedText:         '#FFFFFF',
  rangeBackground:      '#D5E9DA',
  todayBorder:          '#315E41',
  // Closed by admin (month published, day explicitly closed — not the same as fully booked)
  closedBackground:     '#F1F3F5',
  closedText:           '#667085',
  // Unreleased (month is draft or not yet created — owner has not opened these dates)
  unreleasedBackground: '#F1F3F5',
  unreleasedText:       '#98A2B3',
}

// ─── Service catalogue DB types ───────────────────────────────────────────────

/**
 * Raw row shape returned from the `service_categories` table (after migration).
 */
export interface ServiceCategoryRow {
  id: number
  name: string
  slug: string
  sort_order: number
  description: string | null
  visible_on_website: boolean
  active: boolean
  revision: number
}

/**
 * Raw row shape returned from the `services` table (after migration).
 * Includes the joined category.
 */
export interface ServiceRow {
  id: string
  title: string
  description: string | null
  price: number
  unit: string                       // DB column: night | day | stay | walk | item | hour
  slug: string | null
  standard: boolean
  active: boolean
  show_on_web: boolean
  sort_order: number
  category_id: number | null
  // new columns (phase 1)
  archived_at: string | null
  available_in_reservation: boolean
  internal_note: string | null
  custom_unit_label: string | null
  // optimistic concurrency (phase 2)
  revision: number
  // joined
  service_categories: Pick<ServiceCategoryRow, 'id' | 'name' | 'slug'> | null
}

/** Shape expected by upsertService action. */
export interface UpsertServicePayload {
  id?: string
  title: string
  description?: string
  price: number
  unit: string
  slug?: string
  standard: boolean
  active: boolean
  show_on_web: boolean
  available_in_reservation: boolean
  sort_order: number
  category_id?: number | null
  internal_note?: string
  custom_unit_label?: string
}

/** Shape expected by upsertServiceCategory action. */
export interface UpsertServiceCategoryPayload {
  id?: number
  name: string
  slug: string
  sort_order: number
  description?: string
  visible_on_website: boolean
  active: boolean
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
