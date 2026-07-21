/**
 * Public data helpers — try to read from Supabase, fall back to static content.
 * All functions are safe to call from Server Components.
 */

import type { FaqItem, PriceItem, Testimonial } from '@/lib/types'
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

// ─── Testimonials ─────────────────────────────────────────────────────────────

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
