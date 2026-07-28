/**
 * lib/availability-months.ts
 *
 * Server-only utilities for reading availability_months and availability_days.
 * All functions use the service-role client and are safe to call from
 * API routes, RSCs, and server actions.
 *
 * Intentionally read-only here — all mutations live in
 * lib/admin/availability-actions.ts so they carry permission checks.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { MonthStatus, DayState } from '@/lib/types'

// ─── Shape types ──────────────────────────────────────────────────────────────

export interface MonthRecord {
  monthStart:  string          // 'YYYY-MM-01'
  status:      MonthStatus
  publishedAt: string | null
}

export interface DayRecord {
  date:       string           // 'YYYY-MM-DD'
  monthStart: string
  isOpen:     boolean
}

// ─── Month queries ─────────────────────────────────────────────────────────────

/** Returns the publication status of one month, or null if the row doesn't exist. */
export async function getMonthStatus(monthStart: string): Promise<MonthStatus | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('availability_months')
    .select('status')
    .eq('month_start', monthStart)
    .maybeSingle()
  return (data?.status as MonthStatus) ?? null
}

/**
 * Returns all month records where month_start is in [fromMonthStart, toMonthStart]
 * (both inclusive).
 */
export async function getMonthsInRange(
  fromMonthStart: string,
  toMonthStart:   string,
): Promise<MonthRecord[]> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('availability_months')
    .select('month_start, status, published_at')
    .gte('month_start', fromMonthStart)
    .lte('month_start', toMonthStart)
    .order('month_start')
  return (data ?? []).map((r) => ({
    monthStart:  r.month_start,
    status:      r.status as MonthStatus,
    publishedAt: r.published_at,
  }))
}

// ─── Day queries ───────────────────────────────────────────────────────────────

/** Returns all day records for one month. */
export async function getDaysForMonth(monthStart: string): Promise<DayRecord[]> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('availability_days')
    .select('date, month_start, is_open')
    .eq('month_start', monthStart)
    .order('date')
  return (data ?? []).map((r) => ({
    date:       r.date,
    monthStart: r.month_start,
    isOpen:     r.is_open,
  }))
}

/**
 * Returns day records for dates in [from, to) (to is exclusive).
 * Useful for a range that spans multiple months.
 */
export async function getDaysForRange(from: string, to: string): Promise<DayRecord[]> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('availability_days')
    .select('date, month_start, is_open')
    .gte('date', from)
    .lt('date', to)
    .order('date')
  return (data ?? []).map((r) => ({
    date:       r.date,
    monthStart: r.month_start,
    isOpen:     r.is_open,
  }))
}

// ─── Derived state helpers ────────────────────────────────────────────────────

/**
 * Derives the public-facing DayState for a single date.
 *
 *   monthStatus === null || 'draft'  →  'unreleased'
 *   monthStatus === 'published' && !dayRecord.isOpen  →  'closed'
 *   monthStatus === 'published' && dayRecord.isOpen   →  'open'
 */
export function deriveDayState(
  monthStatus: MonthStatus | null,
  dayRecord:   DayRecord | undefined,
): DayState {
  if (!monthStatus || monthStatus === 'draft') return 'unreleased'
  if (!dayRecord || !dayRecord.isOpen)         return 'closed'
  return 'open'
}

/**
 * Given a Date-range [from, to), builds a map of date → DayState.
 * Fetches months + days in one round-trip each (two queries total).
 *
 * Used by the month API route and the capacity checker.
 */
export async function buildDayStateMap(
  from: string,
  to:   string,
): Promise<Map<string, DayState>> {
  // Collect all unique month starts in the range
  const monthStartSet = new Set<string>()
  let cursor = new Date(from)
  const end  = new Date(to)
  while (cursor < end) {
    monthStartSet.add(toMonthStart(cursor.toISOString().split('T')[0]))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  const monthStarts = [...monthStartSet].sort()

  // Fetch months + days in parallel
  const [months, days] = await Promise.all([
    getMonthsInRange(monthStarts[0], monthStarts[monthStarts.length - 1]),
    getDaysForRange(from, to),
  ])

  const monthStatusMap = new Map<string, MonthStatus>(
    months.map((m) => [m.monthStart, m.status]),
  )
  const dayRecordMap = new Map<string, DayRecord>(
    days.map((d) => [d.date, d]),
  )

  // Build result map
  const stateMap = new Map<string, DayState>()
  cursor = new Date(from)
  while (cursor < end) {
    const dateStr    = cursor.toISOString().split('T')[0]
    const mStart     = toMonthStart(dateStr)
    const mStatus    = monthStatusMap.get(mStart) ?? null
    const dayRec     = dayRecordMap.get(dateStr)
    stateMap.set(dateStr, deriveDayState(mStatus, dayRec))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return stateMap
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns 'YYYY-MM-01' for any date string in that month. */
export function toMonthStart(dateStr: string): string {
  return dateStr.slice(0, 7) + '-01'
}

/** Returns 'YYYY-MM-01' for the current UTC month. */
export function currentMonthStart(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
}

/**
 * Returns the first day of the next calendar month.
 * e.g. '2026-07-01' → '2026-08-01'
 */
export function nextMonthStart(monthStart: string): string {
  const d = new Date(monthStart + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d.toISOString().split('T')[0]
}

/** Returns whether a date string is the first of its month. */
export function isMonthStart(dateStr: string): boolean {
  return dateStr.endsWith('-01')
}
