/**
 * lib/capacity.ts
 *
 * Shared capacity utilities for Verde.
 * All functions use the service-role Supabase client so they can be called
 * from API routes, server actions, and RSCs without RLS interference.
 *
 * Single source of truth for:
 *  - active reservation statuses that count toward occupancy
 *  - per-night occupancy queries (fail-closed on error)
 *  - global max from site_settings
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'

// ─── Status constants ──────────────────────────────────────────────────────────

/** Statuses that are ALWAYS counted as occupying a spot. */
export const ALWAYS_ACTIVE_STATUSES = [
  'awaiting_deposit',
  'confirmed',
  'checked_in',
] as const

/** Statuses counted only when count_pending_requests setting is true. */
export const PENDING_STATUSES = [
  'inquiry',
  'request_submitted',
  'under_review',
] as const

export type ActiveStatus =
  | (typeof ALWAYS_ACTIVE_STATUSES)[number]
  | (typeof PENDING_STATUSES)[number]

// ─── Settings helpers ──────────────────────────────────────────────────────────

/** Returns global max dogs from site_settings. Falls back to 6 on any error. */
export async function getGlobalMaxDogs(): Promise<number> {
  try {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'capacity')
      .single()
    if (data?.value && typeof data.value === 'object') {
      const cap = data.value as Record<string, unknown>
      const parsed = Number(cap.maxDogs ?? cap.max_dogs ?? cap.boxes)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
  } catch {
    // fall through
  }
  return 6
}

/** Returns whether inquiry-type statuses should be counted. Defaults false. */
export async function getCountPendingRequests(): Promise<boolean> {
  try {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'count_pending_requests')
      .single()
    // value is stored as a JSON boolean or the string 'true'/'false'
    const raw = data?.value
    if (raw === true || raw === 'true') return true
    if (typeof raw === 'object' && raw !== null) return false
  } catch {
    // fall through
  }
  return false
}

/** Returns the statuses that count toward capacity. Reads the setting once. */
export async function getActiveStatuses(): Promise<string[]> {
  const countPending = await getCountPendingRequests()
  const statuses: string[] = [...ALWAYS_ACTIVE_STATUSES]
  if (countPending) statuses.push(...PENDING_STATUSES)
  return statuses
}

// ─── Per-night occupancy ───────────────────────────────────────────────────────

export interface NightOccupancy {
  date: string     // ISO date e.g. '2025-08-10'
  booked: number   // dogs confirmed for that night
  maxDogs: number  // effective cap (after overrides)
  free: number     // maxDogs - booked (clamped ≥ 0)
}

export interface OccupancyError {
  error: true
  message: string
}

/**
 * Returns per-night occupancy for every night in [from, to).
 * Uses the DB `get_nightly_occupancy` RPC so logic stays in Postgres.
 * On RPC error returns OccupancyError (fail-closed).
 */
export async function getOccupancyForRange(
  from: string,
  to: string,
): Promise<NightOccupancy[] | OccupancyError> {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase.rpc('get_nightly_occupancy', {
      p_from: from,
      p_to: to,
    })
    if (error) {
      console.error('[verde] get_nightly_occupancy RPC error:', error.message)
      return { error: true, message: error.message }
    }
    // RPC returns jsonb — Supabase client parses it to JS
    const rows = (Array.isArray(data) ? data : JSON.parse(data as unknown as string)) as Array<{
      date: string
      booked: number
      max_dogs: number
      free: number
    }>
    return rows.map((r) => ({
      date:    r.date,
      booked:  r.booked,
      maxDogs: r.max_dogs,
      free:    r.free,
    }))
  } catch (err) {
    console.error('[verde] getOccupancyForRange exception:', err)
    return { error: true, message: String(err) }
  }
}

/**
 * Returns occupancy for a single night (arrival_date <= night < departure_date).
 * Fail-closed: returns { booked: 0, maxDogs: 6, free: 6, error } on DB error
 * so callers can distinguish "unknown" from "confirmed available".
 */
export async function getOccupancyForDate(
  date: string,
): Promise<NightOccupancy & { queryFailed?: boolean }> {
  const tomorrow = new Date(date)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const result = await getOccupancyForRange(date, tomorrowStr)
  if ('error' in result) {
    return { date, booked: 0, maxDogs: 6, free: 6, queryFailed: true }
  }
  return result[0] ?? { date, booked: 0, maxDogs: 6, free: 6 }
}

// ─── Availability check (used by pre-flight UI, not the booking RPC) ─────────

export interface AvailabilityResult {
  available: boolean
  spotsLeft: number
  reason?: string
}

/**
 * Checks whether [checkIn, checkOut) has capacity for dogsRequested on
 * EVERY night. Uses per-night loop via get_nightly_occupancy RPC.
 * Fail-closed: any DB error returns available=false.
 */
export async function checkRangeAvailability(
  checkIn: string,
  checkOut: string,
  dogsRequested: number,
): Promise<AvailabilityResult> {
  if (checkIn >= checkOut) {
    return { available: false, spotsLeft: 0, reason: 'Neplatné datum pobytu.' }
  }

  const rows = await getOccupancyForRange(checkIn, checkOut)

  if ('error' in rows) {
    return {
      available: false,
      spotsLeft: 0,
      reason: 'Nepodařilo se ověřit dostupnost. Zkuste to prosím znovu.',
    }
  }

  // Find the tightest night
  let minFree = Infinity
  let blockingDate = ''
  for (const row of rows) {
    if (row.free < minFree) {
      minFree = row.free
      blockingDate = row.date
    }
  }

  if (minFree < dogsRequested) {
    return {
      available: false,
      spotsLeft: Math.max(0, minFree),
      reason:
        minFree <= 0
          ? `Na datum ${blockingDate} není volná kapacita.`
          : `Na datum ${blockingDate} zbývá pouze ${minFree} místo/míst (požadováno ${dogsRequested}).`,
    }
  }

  return { available: true, spotsLeft: minFree }
}
