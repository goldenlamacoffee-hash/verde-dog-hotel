/**
 * Public data helpers — try to read from Supabase, fall back to static content.
 * All functions are safe to call from Server Components.
 */

import type { FaqItem, PriceItem, Testimonial } from '@/lib/types'
import { faqItems as staticFaq } from '@/content/faq'
import { priceItems as staticPrices } from '@/content/services'
import { testimonials as staticTestimonials } from '@/content/home'

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
