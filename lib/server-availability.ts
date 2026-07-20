/**
 * Server-side availability engine.
 *
 * Checks whether a given [checkIn, checkOut) window has capacity for the
 * requested number of dogs by:
 *   1. Reading the global max from site_settings.capacity
 *   2. Counting dogs already booked in overlapping active reservations
 *   3. Applying capacity_overrides for each date in the window
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'

/** Active reservation statuses that count against capacity */
const ACTIVE_STATUSES = ['pending', 'confirmed', 'checked_in'] as const

export interface AvailabilityResult {
  available: boolean
  spotsLeft: number
  /** Human-readable reason when unavailable */
  reason?: string
}

/**
 * Returns all dates in [start, end) as ISO date strings (no inclusive end —
 * the last night is the night before check-out).
 */
function datesInRange(checkIn: string, checkOut: string): string[] {
  const dates: string[] = []
  const cur = new Date(checkIn)
  const end = new Date(checkOut)
  while (cur < end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export async function checkAvailability(
  checkIn: string,
  checkOut: string,
  dogsRequested: number,
  excludeReservationId?: string,
): Promise<AvailabilityResult> {
  const supabase = createServiceRoleClient()

  // 1. Global capacity from site_settings
  let globalMax = 6 // safe default
  try {
    const { data: setting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'capacity')
      .single()
    if (setting?.value && typeof setting.value === 'object') {
      const cap = setting.value as Record<string, unknown>
      const parsed = Number(cap.maxDogs ?? cap.max_dogs ?? cap.boxes)
      if (!isNaN(parsed) && parsed > 0) globalMax = parsed
    }
  } catch {
    // fall through to default
  }

  const nights = datesInRange(checkIn, checkOut)
  if (nights.length === 0) {
    return { available: false, spotsLeft: 0, reason: 'Neplatné datum pobytu.' }
  }

  // 2. capacity_overrides — check for fully blocked dates
  try {
    const { data: overrides } = await supabase
      .from('capacity_overrides')
      .select('date, type, max_dogs_override')
      .in('date', nights)

    if (overrides?.length) {
      for (const override of overrides) {
        if (override.type === 'blocked') {
          return {
            available: false,
            spotsLeft: 0,
            reason: `Datum ${override.date} je uzavřeno (blokace).`,
          }
        }
        // If there's a per-day cap override, use the minimum across all days
        if (
          override.type === 'limited' &&
          override.max_dogs_override !== null &&
          override.max_dogs_override < globalMax
        ) {
          globalMax = override.max_dogs_override
        }
      }
    }
  } catch {
    // capacity_overrides may not have a 'type' column yet — ignore errors
  }

  // 3. Count dogs in overlapping active reservations
  // Overlapping means: check_in < checkOut AND check_out > checkIn
  let query = supabase
    .from('reservations')
    .select('id')
    .in('status', ACTIVE_STATUSES as unknown as string[])
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)

  if (excludeReservationId) {
    query = query.neq('id', excludeReservationId)
  }

  const { data: overlapping, error } = await query

  if (error) {
    // If we can't check, fail safe by allowing — the DB insert will be the
    // final arbiter; we don't want a query error to block all bookings.
    console.error('[verde] availability check failed:', error.message)
    return { available: true, spotsLeft: globalMax }
  }

  // Sum dogs from each overlapping reservation via reservation_dogs
  let bookedDogs = 0
  if (overlapping && overlapping.length > 0) {
    const ids = overlapping.map((r) => r.id)
    const { data: dogRows } = await supabase
      .from('reservation_dogs')
      .select('reservation_id')
      .in('reservation_id', ids)

    bookedDogs = dogRows?.length ?? 0
  }

  // Find worst-case (most-booked) night — use total booked as conservative max
  const spotsLeft = globalMax - bookedDogs

  if (spotsLeft < dogsRequested) {
    return {
      available: false,
      spotsLeft: Math.max(0, spotsLeft),
      reason:
        spotsLeft <= 0
          ? 'V požadovaném termínu není volná kapacita.'
          : `V požadovaném termínu zbývá pouze ${spotsLeft} místo/míst (požadováno ${dogsRequested}).`,
    }
  }

  return { available: true, spotsLeft }
}
