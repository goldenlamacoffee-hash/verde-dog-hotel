/**
 * Server-side pricing engine for VERDE reservations.
 * Pulls base rates from the `services` DB table and applies `pricing_rules`
 * modifiers. Returns the same Estimate shape the client uses so the API
 * can store the authoritative price without the UI needing to change.
 */
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { nightsBetween } from '@/lib/format'
import { BOOKING_RULES } from '@/lib/booking-types'
import type { Estimate, EstimateLine } from '@/lib/reservation'

// ─── Fallback constants (used when DB is unavailable) ─────────────────────────
const FALLBACK_BASE_PER_NIGHT = 490
const FALLBACK_ADDITIONAL_DOG_PER_NIGHT = 390

interface ServiceRow {
  id: string
  slug: string
  title: string
  price: number
  unit: string
  standard: boolean
  active: boolean
}

interface PricingRuleRow {
  rule_type: string
  date_from: string | null
  date_to: string | null
  min_nights: number | null
  max_nights: number | null
  dog_count_min: number | null
  modifier_type: string  // 'percent_off' | 'fixed_off' | 'override'
  modifier_value: number
  active: boolean
  sort_order: number
}

/**
 * Compute the authoritative server-side estimate for a reservation.
 * @param arrival  ISO date string "YYYY-MM-DD"
 * @param departure ISO date string "YYYY-MM-DD"
 * @param dogCount number of dogs (≥ 1)
 * @param selectedServiceIds array of service UUIDs the customer chose
 */
export async function computeServerEstimate(
  arrival: string,
  departure: string,
  dogCount: number,
  selectedServiceIds: string[],
): Promise<Estimate> {
  const nights = nightsBetween(arrival, departure)
  const dogs = Math.max(1, dogCount)
  const lines: EstimateLine[] = []

  // ── Fetch all active services in one query ──────────────────────────────────
  let allServices: ServiceRow[] = []
  let basePerNight = FALLBACK_BASE_PER_NIGHT
  let additionalDogPerNight = FALLBACK_ADDITIONAL_DOG_PER_NIGHT
  let rules: PricingRuleRow[] = []

  try {
    const supabase = createServiceRoleClient()

    const [{ data: svcData }, { data: ruleData }] = await Promise.all([
      supabase
        .from('services')
        .select('id, slug, title, price, unit, standard, active')
        .eq('active', true),
      supabase
        .from('pricing_rules')
        .select('rule_type, date_from, date_to, min_nights, max_nights, dog_count_min, modifier_type, modifier_value, active, sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
    ])

    if (svcData) allServices = svcData as ServiceRow[]
    if (ruleData) rules = ruleData as PricingRuleRow[]

    // Find base overnight service
    const baseSvc = allServices.find((s) => s.slug === 'overnight-stay' || s.slug === 'pobyt-pres-noc')
    if (baseSvc && baseSvc.price > 0) basePerNight = baseSvc.price

    // Find additional-dog service
    const addDogSvc = allServices.find((s) => s.slug === 'additional-dog' || s.slug === 'dalsi-pes')
    if (addDogSvc && addDogSvc.price > 0) additionalDogPerNight = addDogSvc.price
  } catch {
    // DB unavailable — continue with fallback constants
  }

  // ── Base accommodation lines ────────────────────────────────────────────────
  if (nights > 0) {
    lines.push({
      id: 'base',
      label: 'Standardní pobyt — 1. pes',
      detail: `${nights} × ${basePerNight} Kč`,
      amount: nights * basePerNight,
    })

    if (dogs > 1) {
      const extra = dogs - 1
      lines.push({
        id: 'additional-dogs',
        label: `Další psi (${extra})`,
        detail: `${extra} × ${nights} × ${additionalDogPerNight} Kč`,
        amount: extra * nights * additionalDogPerNight,
      })
    }
  }

  // ── Add-on services ─────────────────────────────────────────────────────────
  for (const serviceId of selectedServiceIds) {
    const svc = allServices.find((s) => s.id === serviceId)
    if (!svc || svc.standard || svc.price === 0) continue

    let quantity = 1
    let detail = ''
    const unit = svc.unit ?? ''

    if (unit === 'per-night' || unit === 'per-day' || unit === 'night' || unit === 'day') {
      quantity = Math.max(nights, 1)
      detail = `${quantity} × ${svc.price} Kč`
    } else {
      detail = `${svc.price} Kč`
    }

    lines.push({
      id: svc.id,
      label: svc.title,
      detail,
      amount: quantity * svc.price,
    })
  }

  // ── Apply pricing_rules modifiers ───────────────────────────────────────────
  const arrDate = new Date(arrival)
  const depDate = new Date(departure)

  for (const rule of rules) {
    // Date range check
    if (rule.date_from && new Date(rule.date_from) > depDate) continue
    if (rule.date_to   && new Date(rule.date_to)   < arrDate) continue
    // Min/max nights check
    if (rule.min_nights != null && nights < rule.min_nights) continue
    if (rule.max_nights != null && nights > rule.max_nights) continue
    // Dog count check
    if (rule.dog_count_min != null && dogs < rule.dog_count_min) continue

    const accommodationTotal = lines
      .filter((l) => l.id === 'base' || l.id === 'additional-dogs')
      .reduce((s, l) => s + l.amount, 0)

    if (rule.modifier_type === 'percent_off') {
      const discount = Math.round((accommodationTotal * rule.modifier_value) / 100)
      if (discount > 0) {
        lines.push({
          id: `rule-${rule.rule_type}`,
          label: `Sleva — ${rule.rule_type}`,
          detail: `-${rule.modifier_value}%`,
          amount: -discount,
        })
      }
    } else if (rule.modifier_type === 'fixed_off') {
      lines.push({
        id: `rule-${rule.rule_type}`,
        label: `Sleva — ${rule.rule_type}`,
        detail: `-${rule.modifier_value} Kč`,
        amount: -rule.modifier_value,
      })
    }
  }

  const total = Math.max(0, lines.reduce((sum, l) => sum + l.amount, 0))
  const deposit = Math.round((total * BOOKING_RULES.depositRate) / 10) * 10

  return { nights, dogCount: dogs, lines, total, deposit }
}
