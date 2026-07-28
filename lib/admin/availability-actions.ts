'use server'

/**
 * lib/admin/availability-actions.ts
 *
 * Server actions for managing the availability calendar.
 * All mutations require the caller to be at minimum 'admin' or 'owner'
 * (checked via getAdminProfile — same pattern as user-actions.ts).
 *
 * Allowed roles for capacity management: owner, admin, reception
 * (see canManageCapacity in lib/auth/roles.ts).
 *
 * After every successful mutation:
 *  - revalidatePath is called for both the admin planner page and the
 *    public API routes so the calendar reflects changes immediately.
 *  - An audit_log entry is written (action='UPDATE', event in new_data).
 */

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getAdminProfile, canManageCapacity } from '@/lib/auth/roles'
import {
  getMonthStatus,
  getDaysForMonth,
  toMonthStart,
  nextMonthStart,
  type MonthRecord,
  type DayRecord,
} from '@/lib/availability-months'

// ─── Shared result type (mirrors user-actions pattern) ───────────────────────

export interface ActionResult<T = undefined> {
  ok: boolean
  error?: string
  data?: T
}

// ─── Permission guard ─────────────────────────────────────────────────────────

async function requireCapacityAdmin(): Promise<
  { ok: true; id: string; name: string | null } | { ok: false; error: string }
> {
  const caller = await getAdminProfile()
  if (!caller) return { ok: false, error: 'Nepřihlášen.' }
  if (!canManageCapacity(caller.role)) {
    return { ok: false, error: 'Nemáte oprávnění spravovat dostupnost.' }
  }
  return { ok: true, id: caller.id, name: caller.full_name }
}

// ─── Audit helper ─────────────────────────────────────────────────────────────

async function auditAvailability(
  actorId: string,
  event:   string,
  meta:    Record<string, unknown> = {},
) {
  const admin = createServiceRoleClient()
  await admin.from('audit_log').insert({
    table_name: 'availability_months',
    record_id:  actorId,
    action:     'UPDATE',
    new_data:   { event, actor_id: actorId, ...meta },
    changed_by: actorId,
  })
}

// ─── Revalidation helper ──────────────────────────────────────────────────────

function revalidateAvailability() {
  revalidatePath('/admin/kapacita')
  revalidatePath('/api/availability', 'page')
  revalidatePath('/api/availability/month', 'page')
  revalidatePath('/rezervace')
}

// ─── ensureMonthExists ────────────────────────────────────────────────────────

/**
 * Idempotently creates a month row (status='draft') + all day rows (is_open=true)
 * if the month does not already exist.
 * Returns the month record.
 *
 * Called implicitly before any month mutation to avoid FK errors.
 */
export async function ensureMonthExists(
  monthStart: string,
): Promise<ActionResult<{ month: MonthRecord; days: DayRecord[] }>> {
  const auth = await requireCapacityAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  const admin = createServiceRoleClient()

  // ── 1. Upsert month row (do nothing if already exists) ───────────────────
  const existing = await getMonthStatus(monthStart)
  if (!existing) {
    const { error: mErr } = await admin.from('availability_months').insert({
      month_start: monthStart,
      status:      'draft',
    })
    if (mErr) return { ok: false, error: `Nepodařilo se vytvořit měsíc: ${mErr.message}` }

    // ── 2. Fill all days as open ────────────────────────────────────────────
    const d     = new Date(monthStart + 'T00:00:00Z')
    const year  = d.getUTCFullYear()
    const month = d.getUTCMonth()
    const numDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const days = Array.from({ length: numDays }, (_, i) => {
      const date = new Date(Date.UTC(year, month, i + 1)).toISOString().split('T')[0]
      return { date, month_start: monthStart, is_open: true, updated_by: auth.id }
    })
    const { error: dErr } = await admin.from('availability_days').insert(days)
    if (dErr) return { ok: false, error: `Nepodařilo se vytvořit dny: ${dErr.message}` }
  }

  // Fetch current state to return
  const [monthRow, dayRows] = await Promise.all([
    admin.from('availability_months').select('month_start, status, published_at').eq('month_start', monthStart).single(),
    getDaysForMonth(monthStart),
  ])

  const record: MonthRecord = {
    monthStart:  monthRow.data?.month_start ?? monthStart,
    status:      monthRow.data?.status ?? 'draft',
    publishedAt: monthRow.data?.published_at ?? null,
  }

  return { ok: true, data: { month: record, days: dayRows } }
}

// ─── publishMonth ─────────────────────────────────────────────────────────────

/**
 * Sets a month's status to 'published' and records published_at + published_by.
 * Ensures the month row exists first.
 */
export async function publishMonth(
  monthStart: string,
): Promise<ActionResult> {
  const auth = await requireCapacityAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  // Ensure the month row exists before updating it
  const ensure = await ensureMonthExists(monthStart)
  if (!ensure.ok) return { ok: false, error: ensure.error }

  const admin = createServiceRoleClient()
  const { error } = await admin.from('availability_months').update({
    status:       'published',
    published_at: new Date().toISOString(),
    published_by: auth.id,
    updated_at:   new Date().toISOString(),
  }).eq('month_start', monthStart)

  if (error) return { ok: false, error: `Nepodařilo se zveřejnit měsíc: ${error.message}` }

  await auditAvailability(auth.id, 'month_published', { month_start: monthStart })
  revalidateAvailability()
  return { ok: true }
}

// ─── unpublishMonth ───────────────────────────────────────────────────────────

/**
 * Sets a month's status back to 'draft'.
 * The public calendar will treat it as unreleased.
 */
export async function unpublishMonth(
  monthStart: string,
): Promise<ActionResult> {
  const auth = await requireCapacityAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  const admin = createServiceRoleClient()
  const { error } = await admin.from('availability_months').update({
    status:     'draft',
    updated_at: new Date().toISOString(),
  }).eq('month_start', monthStart)

  if (error) return { ok: false, error: `Nepodařilo se stáhnout měsíc: ${error.message}` }

  await auditAvailability(auth.id, 'month_unpublished', { month_start: monthStart })
  revalidateAvailability()
  return { ok: true }
}

// ─── setDayOpen ───────────────────────────────────────────────────────────────

/**
 * Toggles a single day open or closed.
 * The day must already exist (created by ensureMonthExists).
 */
export async function setDayOpen(
  date:   string,
  isOpen: boolean,
): Promise<ActionResult> {
  const auth = await requireCapacityAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  const admin = createServiceRoleClient()
  const { error } = await admin.from('availability_days').update({
    is_open:    isOpen,
    updated_by: auth.id,
    updated_at: new Date().toISOString(),
  }).eq('date', date)

  if (error) return { ok: false, error: `Nepodařilo se nastavit den: ${error.message}` }

  await auditAvailability(auth.id, 'day_toggled', { date, is_open: isOpen })
  revalidateAvailability()
  return { ok: true }
}

// ─── setDaysOpen ──────────────────────────────────────────────────────────────

/**
 * Batch-sets multiple days to the same open/closed state in a single update.
 * Used by bulk actions (open all, close all, set by weekday).
 */
export async function setDaysOpen(
  dates:  string[],
  isOpen: boolean,
): Promise<ActionResult> {
  if (!dates.length) return { ok: true }

  const auth = await requireCapacityAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  const admin = createServiceRoleClient()
  const now   = new Date().toISOString()

  // Batch update using in() filter — single query regardless of date count
  const { error } = await admin.from('availability_days').update({
    is_open:    isOpen,
    updated_by: auth.id,
    updated_at: now,
  }).in('date', dates)

  if (error) return { ok: false, error: `Hromadná aktualizace se nezdařila: ${error.message}` }

  await auditAvailability(auth.id, 'days_batch_toggled', {
    count:   dates.length,
    is_open: isOpen,
    first:   dates[0],
    last:    dates[dates.length - 1],
  })
  revalidateAvailability()
  return { ok: true }
}

// ─── setAllDaysInMonth ────────────────────────────────────────────────────────

/**
 * Sets ALL days in a month to the same is_open state.
 * Convenience wrapper around setDaysOpen for the "Otevřít vše / Zavřít vše" buttons.
 */
export async function setAllDaysInMonth(
  monthStart: string,
  isOpen:     boolean,
): Promise<ActionResult> {
  const ensure = await ensureMonthExists(monthStart)
  if (!ensure.ok) return { ok: false, error: ensure.error }

  const dates = (ensure.data?.days ?? []).map((d) => d.date)
  return setDaysOpen(dates, isOpen)
}

// ─── setWeekdayDays ────────────────────────────────────────────────────────────

/**
 * Sets all days in a month matching a given weekday (0=Sun … 6=Sat) to is_open.
 * Used by the "Každé pondělí / úterý / …" bulk controls in the planner.
 */
export async function setWeekdayDays(
  monthStart: string,
  weekday:    0 | 1 | 2 | 3 | 4 | 5 | 6,
  isOpen:     boolean,
): Promise<ActionResult> {
  const ensure = await ensureMonthExists(monthStart)
  if (!ensure.ok) return { ok: false, error: ensure.error }

  const dates = (ensure.data?.days ?? [])
    .filter((d) => new Date(d.date + 'T12:00:00Z').getUTCDay() === weekday)
    .map((d) => d.date)

  if (!dates.length) return { ok: true }
  return setDaysOpen(dates, isOpen)
}

// ─── getMonthPlannerData ──────────────────────────────────────────────────────

/**
 * Returns everything the MonthPlanner component needs in a single server call:
 *  - month record (status, publishedAt)
 *  - all day records for the month
 *  - whether the next month has been published (for the reminder banner)
 *
 * NOT a mutation — does not call requireCapacityAdmin; the planner page's
 * own requireAdmin gating is sufficient.
 */
export async function getMonthPlannerData(monthStart: string): Promise<{
  month:          MonthRecord | null
  days:           DayRecord[]
  nextPublished:  boolean
}> {
  const admin = createServiceRoleClient()

  const nextStart = nextMonthStart(monthStart)

  const [monthRow, days, nextMonthRow] = await Promise.all([
    admin.from('availability_months').select('month_start, status, published_at').eq('month_start', monthStart).maybeSingle(),
    getDaysForMonth(monthStart),
    admin.from('availability_months').select('status').eq('month_start', nextStart).maybeSingle(),
  ])

  const month: MonthRecord | null = monthRow.data
    ? {
        monthStart:  monthRow.data.month_start,
        status:      monthRow.data.status,
        publishedAt: monthRow.data.published_at,
      }
    : null

  return {
    month,
    days,
    nextPublished: nextMonthRow.data?.status === 'published',
  }
}

// ─── getUnpublishedFutureMonths ───────────────────────────────────────────────

/**
 * Returns the count and list of months in the next N months that are not
 * yet published. Used by the dashboard reminder banner.
 */
export async function getUnpublishedFutureMonths(lookaheadMonths = 3): Promise<{
  count: number
  months: string[]   // 'YYYY-MM-01' strings
}> {
  const admin = createServiceRoleClient()

  // Build list of the next N month starts
  const starts: string[] = []
  const now = new Date()
  for (let i = 0; i < lookaheadMonths; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1))
    starts.push(d.toISOString().split('T')[0])
  }

  const { data } = await admin
    .from('availability_months')
    .select('month_start, status')
    .in('month_start', starts)

  const publishedSet = new Set(
    (data ?? []).filter((r) => r.status === 'published').map((r) => r.month_start),
  )

  const unpublished = starts.filter((s) => !publishedSet.has(s))
  return { count: unpublished.length, months: unpublished }
}
