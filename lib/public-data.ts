/**
 * Public data helpers — try to read from Supabase, fall back to static content.
 * All functions are safe to call from Server Components.
 */

import type { CalendarAppearance, ContactSettingsValue, FaqItem, GalleryImage, PriceItem, Testimonial } from '@/lib/types'
import { CALENDAR_APPEARANCE_DEFAULTS } from '@/lib/types'
import { faqItems as staticFaq } from '@/content/faq'
import { priceItems as staticPrices } from '@/content/services'
import { testimonials as staticTestimonials } from '@/content/home'

// ─── Page Sections (CMS) ──────────────────────────────────────────────────────

/**
 * Fetch a single page section content object from the DB.
 * Returns null if not found — callers should fall back to static defaults.
 */
export async function getPublicPageSection<T extends Record<string, unknown>>(
  page: string,
  sectionKey: string
): Promise<T | null> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data } = await supabase
      .from('page_sections')
      .select('content')
      .eq('page', page)
      .eq('section_key', sectionKey)
      .eq('active', true)
      .single()
    if (data?.content) return data.content as T
  } catch {
    // fall through to null
  }
  return null
}

/**
 * Fetch all active sections for a page, keyed by section_key.
 */
export async function getPublicPageSections(page: string): Promise<Record<string, Record<string, unknown>>> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data } = await supabase
      .from('page_sections')
      .select('section_key, content')
      .eq('page', page)
      .eq('active', true)
      .order('sort_order')
    if (data && data.length > 0) {
      return Object.fromEntries(data.map((s: any) => [s.section_key, s.content]))
    }
  } catch {
    // fall through
  }
  return {}
}

// ─── Site Settings ────────────────────────────────────────────────────────────

/**
 * Fetch a single site_settings row by key.
 * Returns null when the table is unreachable or the key doesn't exist.
 */
export async function getPublicSiteSetting<T extends Record<string, unknown>>(
  key: string,
): Promise<T | null> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .single()
    if (data?.value) return data.value as T
  } catch {
    // fall through
  }
  return null
}

// ─── Calendar appearance ──────────────────────────────────────────────────────

/** Validate a single value is a CSS hex color. */
function isValidHex(v: unknown): v is string {
  return typeof v === 'string' && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v)
}

/**
 * Fetch calendar color settings from site_settings, validating each value.
 * Falls back to VERDE defaults for any missing or invalid keys.
 */
export async function getPublicCalendarAppearance(): Promise<CalendarAppearance> {
  const db = await getPublicSiteSetting<Record<string, unknown>>('availabilityCalendarAppearance')
  if (!db) return { ...CALENDAR_APPEARANCE_DEFAULTS }

  const result = { ...CALENDAR_APPEARANCE_DEFAULTS }
  for (const key of Object.keys(CALENDAR_APPEARANCE_DEFAULTS) as (keyof CalendarAppearance)[]) {
    if (isValidHex(db[key])) {
      result[key] = db[key] as string
    }
  }
  return result
}

// ─── Maximum stay ─────────────────────────────────────────────────────────────

/**
 * Returns the configured maximum stay length (occupied nights), or null when
 * no maximum is set.
 *
 * Stored under site_settings key `maximumStayNights` as `{ nights: number }`.
 * null / missing / 0 → no maximum.
 * Positive integer    → maximum allowed occupied nights.
 */
export async function getPublicMaximumStayNights(): Promise<number | null> {
  const raw = await getPublicSiteSetting<Record<string, unknown>>('maximumStayNights')
  if (!raw) return null
  const nights = raw.nights
  if (typeof nights === 'number' && Number.isInteger(nights) && nights >= 1) {
    return nights
  }
  return null
}

// ─── Contact settings ─────────────────────────────────────────────────────────

/**
 * Fetch the `contact` site_setting row and merge it over the static fallback.
 *
 * Returns a fully-resolved ContactSettingsValue — callers never need to handle
 * the null-DB case themselves. The static values in content/site.ts are used
 * only when no DB row exists yet or the DB is unreachable.
 *
 * Key names are the same ones the admin editor writes: phone, email, address,
 * web, facebook, instagram, openingHours.
 */
export async function getPublicContactSettings(): Promise<ContactSettingsValue> {
  const { siteSettings } = await import('@/content/site')
  const { contact } = siteSettings

  // Static fallback — only used when DB is unreachable or row doesn't exist yet
  const fallback: ContactSettingsValue = {
    phone:        contact.phone,
    email:        contact.email,
    address:      contact.region,
    web:          contact.web,
    facebook:     contact.facebook,
    instagram:    contact.instagram,
    openingHours: contact.openingHours,
  }

  const db = (await getPublicSiteSetting<Record<string, unknown>>('contact')) as ContactSettingsValue | null
  if (!db) return fallback

  // Merge: DB values override fallback only when they are non-empty strings.
  // This prevents an empty admin save from wiping out the fallback.
  function pick(dbVal: string | undefined, fbVal: string | undefined) {
    return dbVal && dbVal.trim() !== '' ? dbVal : fbVal
  }

  return {
    phone:        pick(db.phone,     fallback.phone),
    email:        pick(db.email,     fallback.email),
    address:      pick(db.address,   fallback.address),
    web:          pick(db.web,       fallback.web),
    facebook:     pick(db.facebook,  fallback.facebook),
    instagram:    pick(db.instagram, fallback.instagram),
    openingHours: (db.openingHours && db.openingHours.length > 0)
      ? db.openingHours
      : fallback.openingHours,

    // Location block — no static fallback exists for these; only render
    // whatever the admin has actually filled in (see empty-state rules).
    locationTitle:        pick(db.locationTitle,        undefined),
    locationDescription:  pick(db.locationDescription,  undefined),
    addressLine1:         pick(db.addressLine1,          undefined),
    addressLine2:         pick(db.addressLine2,          undefined),
    city:                 pick(db.city,                  undefined),
    postcode:             pick(db.postcode,               undefined),
    country:              pick(db.country,                undefined),
    googleMapsUrl:        pick(db.googleMapsUrl,          undefined),
    locationImageUrl:     pick(db.locationImageUrl,       undefined),
    locationImageAlt:     pick(db.locationImageAlt,       undefined),
  }
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

export async function getPublicFaq(): Promise<FaqItem[]> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data } = await supabase
      .from('faq_items')
      .select('question, answer, category')
      .eq('active', true)
      .order('sort_order')
    if (data && data.length > 0) return data as FaqItem[]
  } catch {
    // DB unavailable or not configured — fall through to static data
  }
  return staticFaq
}

// ─── Services / Pricing ───────────────────────────────────────────────────────

const UNIT_MAP: Record<string, PriceItem['unit']> = {
  night: 'per-night', day: 'per-day', stay: 'per-stay',
  walk: 'per-walk', item: 'one-off', hour: 'per-day',
}

export async function getPublicPriceItems(): Promise<PriceItem[]> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data } = await supabase
      .from('services')
      .select('id, title, description, price, unit, standard, sort_order')
      .eq('active', true)
      .eq('show_on_web', true)
      .is('archived_at', null)
      .order('sort_order')
    if (data && data.length > 0) {
      return data.map((s: any): PriceItem => ({
        id: s.id,
        title: s.title,
        description: s.description ?? '',
        price: Number(s.price),
        unit: UNIT_MAP[s.unit] ?? 'per-stay',
        featured: !!s.standard,
      }))
    }
  } catch {
    // fall through
  }
  return staticPrices
}

// ─── Testimonials ───────────────────────────────────────────────────���─────────

// ─── Services for reservation flow ───────────────────────────────────────────

export interface ReservationService {
  /** DB UUID — passed to the API as selectedServices */
  id: string
  /** Display slug used as fallback key */
  slug: string | null
  title: string
  description: string
  price: number
  /** DB unit string: night | day | stay | walk | item | hour */
  unit: string
  /** Overrides the default unit display string when set */
  custom_unit_label: string | null
  /** If true, service is included by default (shown in "V ceně pobytu" list) */
  standard: boolean
}

/**
 * Fetch services available in the reservation flow from the DB.
 * Returns only active, non-archived services with available_in_reservation = true,
 * ordered by sort_order.
 *
 * Returns null on any DB error (fail-closed): the reservation flow must block
 * progression rather than silently fall back to stale static data.
 */
export async function getPublicServicesForReservation(): Promise<ReservationService[] | null> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('services')
      .select('id, title, description, price, unit, slug, standard, custom_unit_label')
      .eq('active', true)
      .eq('available_in_reservation', true)
      .is('archived_at', null)
      .order('sort_order')
    if (error) return null
    return (data ?? []).map((s: any): ReservationService => ({
      id: s.id,
      slug: s.slug ?? null,
      title: s.title,
      description: s.description ?? '',
      price: Number(s.price),
      unit: s.unit,
      custom_unit_label: s.custom_unit_label ?? null,
      standard: !!s.standard,
    }))
  } catch {
    return null
  }
}

// ─── Gallery ───────────────────────────────────────────────────────────────

/**
 * Fetch admin-managed gallery photos from `gallery_items`.
 *
 * Returns null when the table has no active rows (or is unreachable) so
 * callers can fall back to the static category list in content/gallery.ts
 * as well — the CMS categories are free text and don't line up with the
 * static ones, so images and categories must be swapped together.
 */
export async function getPublicGalleryImages(): Promise<GalleryImage[] | null> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data } = await supabase
      .from('gallery_items')
      .select('title, alt, src, category')
      .eq('active', true)
      .order('sort_order')
    if (data && data.length > 0) {
      return data.map((item: any): GalleryImage => ({
        src: item.src,
        alt: item.alt || item.title || '',
        category: item.category,
        width: 1200,
        height: 900,
      }))
    }
  } catch {
    // fall through
  }
  return null
}

export async function getPublicTestimonials(): Promise<Testimonial[]> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data } = await supabase
      .from('testimonials')
      .select('author, dog_name, text, rating')
      .eq('active', true)
      .eq('featured', true)
      .order('sort_order')
      .limit(6)
    if (data && data.length > 0) {
      return data.map((t: any): Testimonial => ({
        quote: t.text,
        author: t.author,
        context: t.dog_name ?? '',
      }))
    }
  } catch {
    // fall through
  }
  return staticTestimonials
}
