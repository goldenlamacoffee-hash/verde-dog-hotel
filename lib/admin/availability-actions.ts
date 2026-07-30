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
 * KEY DESIGN:
 *   - Individual day-cell clicks are LOCAL ONLY (no DB per-click).
 *   - Full month state is persisted atomically via saveAvailabilityMonthDraft
 *     or publishAvailabilityMonthChanges (single RPC = single transaction).
 *   - Public /rezervace is ONLY revalidated after a successful publish.
 *   - A draft save revalidates the admin planner only.
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

// ─── Shared result type ───────────────────────────────────────────────────────

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

// ─── Revalidation helpers ─────────────────────────────────────────────────────

/** Revalidates admin planner only — used after draft saves. */
function revalidateAdminOnly() {
  revalidatePath('/admin/kapacita')
  revalidatePath('/api/availability/month', 'page')
}

/** Revalidates both admin and public booking — used after publish only. */
function revalidateAvailability() {
  revalidatePath('/admin/kapacita')
  revalidatePath('/api/availability', 'page')
  revalidatePath('/api/availability/month', 'page')
  revalidatePath('/rezervace')
}

// ─── ensureMonthExists ────────────────────────────────────────────────────────

/**
 * Idempotently creates a month row (status='draft') + all day rows (is_open=false)
 * if the month does not already exist.
 * New months start fully closed so the admin must deliberately open dates
 * before publishing — avoids accidentally publishing all-open months.
 * Returns the month record and all day rows.
 */
export async function ensureMonthExists(
  monthStart: string,
): Promise<ActionResult<{ month: MonthRecord; days: DayRecord[] }>> {
  const auth = await requireCapacityAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  const admin = createServiceRoleClient()

  const existing = await getMonthStatus(monthStart)
  if (!existing) {
    const { error: mErr } = await admin.from('availability_months').insert({
      month_start: monthStart,
      status:      'draft',
    })
    if (mErr) return { ok: false, error: `Nepodařilo se vytvořit měsíc: ${mErr.message}` }

    const d     = new Date(monthStart + 'T00:00:00Z')
    const year  = d.getUTCFullYear()
    const month = d.getUTCMonth()
    const numDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const days = Array.from({ length: numDays }, (_, i) => {
      const date = new Date(Date.UTC(year, month, i + 1)).toISOString().split('T')[0]
      return { date, month_start: monthStart, is_open: false, updated_by: auth.id }
    })
    const { error: dErr } = await admin.from('availability_days').insert(days)
    if (dErr) return { ok: false, error: `Nepodařilo se vytvořit dny: ${dErr.message}` }
  }

  const [monthRow, dayRows] = await Promise.all([
    admin
      .from('availability_months')
      .select('month_start, status, published_at')
      .eq('month_start', monthStart)
      .single(),
    getDaysForMonth(monthStart),
  ])

  const record: MonthRecord = {
    monthStart:  monthRow.data?.month_start ?? monthStart,
    status:      monthRow.data?.status ?? 'draft',
    publishedAt: monthRow.data?.published_at ?? null,
  }

  return { ok: true, data: { month: record, days: dayRows } }
}

// ─── saveAvailabilityMonthDraft ───────────────────────────────────────────────

/**
 * Atomically persists the complete month state as a draft (status stays 'draft').
 * Calls the save_availability_month_draft RPC which runs in one transaction:
 *   - validates all dates belong to p_month_start
 *   - upserts availability_months (status='draft')
 *   - upserts all availability_days rows
 *   - writes one audit_log entry
 *
 * Public /rezervace is NOT revalidated — customers see the last published version.
 * Only the admin planner cache is cleared.
 */
export async function saveAvailabilityMonthDraft(
  monthStart: string,
  days: Array<{ date: string; is_open: boolean }>,
): Promise<ActionResult> {
  const auth = await requireCapacityAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  if (!days.length) return { ok: false, error: 'Žádné dny k uložení.' }

  const admin = createServiceRoleClient()
  const { error } = await admin.rpc('save_availability_month_draft', {
    p_month_start: monthStart,
    p_days:        days,
    p_actor_id:    auth.id,
  })

  if (error) {
    return { ok: false, error: `Uložení konceptu se nezdařilo: ${error.message}` }
  }

  revalidateAdminOnly()
  return { ok: true }
}

// ─── publishAvailabilityMonthChanges ─────────────────────────────────────────

/**
 * Atomically saves the complete month state AND sets status='published'.
 * Calls the publish_availability_month_changes RPC which runs in one transaction:
 *   - validates all dates belong to p_month_start
 *   - upserts availability_months (status='published', published_at, published_by)
 *   - upserts all availability_days rows
 *   - writes one audit_log entry with changed-day count
 *
 * Public /rezervace IS revalidated after a successful commit.
 * All changes become publicly visible atomically.
 */
export async function publishAvailabilityMonthChanges(
  monthStart: string,
  days: Array<{ date: string; is_open: boolean }>,
): Promise<ActionResult> {
  const auth = await requireCapacityAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  if (!days.length) return { ok: false, error: 'Žádné dny k zveřejnění.' }

  const admin = createServiceRoleClient()
  const { error } = await admin.rpc('publish_availability_month_changes', {
    p_month_start: monthStart,
    p_days:        days,
    p_actor_id:    auth.id,
  })

  if (error) {
    return { ok: false, error: `Zveřejnění se nezdařilo: ${error.message}` }
  }

  revalidateAvailability()
  return { ok: true }
}

// ─── publishMonth (legacy — status-only flip) ─────────────────────────────────

/**
 * Sets a month's status to 'published' without touching day rows.
 * Kept for the existing "Zveřejnit" button on a fully-saved draft.
 * New code should prefer publishAvailabilityMonthChanges.
 */
export async function publishMonth(
  monthStart: string,
): Promise<ActionResult> {
  const auth = await requireCapacityAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

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
 * The public calendar will treat it as unreleased immediately.
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

// ─── copyPreviousMonthExact ───────────────────────────────────────────────────

/**
 * Copies the open/closed state of the previous calendar month into local
 * (client) state via EXACT day-to-day mapping:
 *
 *   source day 1  → target day 1
 *   source day 2  → target day 2
 *   ...
 *   source day N  → target day N
 *
 * For a LONGER destination month (more days than source):
 *   extra destination days default to CLOSED.
 *
 * For a SHORTER destination month (fewer days than source):
 *   source days beyond destination length are ignored.
 *
 * Returns the mapped day array. The caller must store it locally and
 * save via saveAvailabilityMonthDraft or publishAvailabilityMonthChanges.
 * Nothing is written to the database here.
 */
export async function copyPreviousMonthExact(
  targetMonthStart: string,
): Promise<ActionResult<Array<{ date: string; is_open: boolean }>>> {
  const auth = await requireCapacityAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  const [year, mon] = targetMonthStart.split('-').map(Number)
  const prevDate = new Date(Date.UTC(year, mon - 2, 1))
  const prevMonthStart = prevDate.toISOString().split('T')[0]

  const [sourceDays, targetDays] = await Promise.all([
    getDaysForMonth(prevMonthStart),
    getDaysForMonth(targetMonthStart),
  ])

  if (!sourceDays.length) {
    return {
      ok: false,
      error: `Předchozí měsíc (${prevMonthStart}) neobsahuje žádné záznamy. Nejdříve ho vyplňte.`,
    }
  }
  if (!targetDays.length) {
    return {
      ok: false,
      error: 'Cílový měsíc nebyl inicializován. Uložte ho nejdříve jako koncept.',
    }
  }

  // Exact positional copy: source[i] → target[i] (1-indexed day-of-month)
  const result = targetDays.map((targetDay, i) => {
    const sourceDay = sourceDays[i]          // undefined if source shorter
    return {
      date:    targetDay.date,
      is_open: sourceDay ? sourceDay.isOpen : false,   // extra days → closed
    }
  })

  await auditAvailability(auth.id, 'month_copied_exact', {
    source: prevMonthStart,
    target: targetMonthStart,
    days:   result.length,
  })

  return { ok: true, data: result }
}

// ─── copyPreviousMonthWeekdayPattern (separate action, no silent substitution) ─

/**
 * Copies the WEEKDAY PATTERN of the previous calendar month (Mon→open/closed,
 * Tue→open/closed, …) into local state. Each target day gets the is_open value
 * of the same weekday from the source.
 *
 * The last occurrence of each weekday in the source month is used. For a weekday
 * that does not appear in the source, the target day defaults to open.
 *
 * Returns the mapped day array for local state — nothing is written to the DB.
 */
export async function copyPreviousMonthWeekdayPattern(
  targetMonthStart: string,
): Promise<ActionResult<Array<{ date: string; is_open: boolean }>>> {
  const auth = await requireCapacityAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  const [year, mon] = targetMonthStart.split('-').map(Number)
  const prevDate = new Date(Date.UTC(year, mon - 2, 1))
  const prevMonthStart = prevDate.toISOString().split('T')[0]

  const [sourceDays, targetDays] = await Promise.all([
    getDaysForMonth(prevMonthStart),
    getDaysForMonth(targetMonthStart),
  ])

  if (!sourceDays.length) {
    return {
      ok: false,
      error: `Předchozí měsíc (${prevMonthStart}) neobsahuje žádné záznamy.`,
    }
  }
  if (!targetDays.length) {
    return {
      ok: false,
      error: 'Cílový měsíc nebyl inicializován.',
    }
  }

  // Build weekday → is_open from source (last occurrence wins)
  const weekdayMap = new Map<number, boolean>()
  for (const d of sourceDays) {
    const wd = new Date(d.date + 'T00:00:00Z').getUTCDay()
    weekdayMap.set(wd, d.isOpen)
  }

  const result = targetDays.map((d) => {
    const wd = new Date(d.date + 'T00:00:00Z').getUTCDay()
    return { date: d.date, is_open: weekdayMap.get(wd) ?? true }
  })

  await auditAvailability(auth.id, 'month_copied_weekday', {
    source: prevMonthStart,
    target: targetMonthStart,
    days:   result.length,
  })

  return { ok: true, data: result }
}

// ─── getOccupancyForDate ──────────────────────────────────────────────────────

/**
 * Returns the number of booked dogs and the effective capacity for a single date.
 * Used by the confirmation dialog when closing a date that has existing bookings.
 */
export async function getOccupancyForDate(
  date: string,
): Promise<ActionResult<{ booked: number; capacity: number }>> {
  const auth = await requireCapacityAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  const admin = createServiceRoleClient()

  const [bookedResult, capacityResult] = await Promise.all([
    // Count dogs from active/pending reservations covering this night
    admin.rpc('get_booked_dogs_for_date', { p_date: date }).single(),
    admin.from('site_settings').select('value').eq('key', 'capacity').single(),
  ])

  if (bookedResult.error) {
    // Fall back to a direct query if the RPC doesn't exist yet
    const { data: resData } = await admin
      .from('reservations')
      .select('id')
      .lte('arrival_date', date)
      .gt('departure_date', date)
      .not('status', 'in', '(cancelled,rejected,checked_out)')

    const ids = (resData ?? []).map((r) => r.id)
    let booked = 0
    if (ids.length) {
      const { data: dogData } = await admin
        .from('reservation_dogs')
        .select('dog_id')
        .in('reservation_id', ids)
      booked = dogData?.length ?? 0
    }

    const cap = capacityResult.data?.value
    const capacity =
      typeof cap === 'object' && cap !== null && 'maxDogs' in cap
        ? Number((cap as { maxDogs: number }).maxDogs)
        : 4

    return { ok: true, data: { booked, capacity } }
  }

  const booked = (bookedResult.data as { count: number } | null)?.count ?? 0
  const cap = capacityResult.data?.value
  const capacity =
    typeof cap === 'object' && cap !== null && 'maxDogs' in cap
      ? Number((cap as { maxDogs: number }).maxDogs)
      : 4

  return { ok: true, data: { booked, capacity } }
}

// ─── getMonthPlannerData ──────────────────────────────────────────────────────

/**
 * Returns everything the MonthPlanner component needs in a single server call:
 *  - month record (status, publishedAt)
 *  - all day records for the month
 *  - whether the next month has been published (for the reminder banner)
 */
export async function getMonthPlannerData(monthStart: string): Promise<{
  month:         MonthRecord | null
  days:          DayRecord[]
  nextPublished: boolean
}> {
  const admin = createServiceRoleClient()
  const nextStart = nextMonthStart(monthStart)

  const [monthRow, days, nextMonthRow] = await Promise.all([
    admin
      .from('availability_months')
      .select('month_start, status, published_at')
      .eq('month_start', monthStart)
      .maybeSingle(),
    getDaysForMonth(monthStart),
    admin
      .from('availability_months')
      .select('status')
      .eq('month_start', nextStart)
      .maybeSingle(),
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

export async function getUnpublishedFutureMonths(lookaheadMonths = 3): Promise<{
  count: number
  months: string[]
}> {
  const admin = createServiceRoleClient()

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

// ─── Legacy per-day mutations (kept for backwards-compat if still called) ────

/**
 * @deprecated Individual cell mutations are now local-only.
 * Use saveAvailabilityMonthDraft / publishAvailabilityMonthChanges instead.
 */
export async function setDayOpen(
  date:       string,
  isOpen:     boolean,
  monthStart: string,
): Promise<ActionResult> {
  return saveAvailabilityMonthDraft(monthStart, [{ date, is_open: isOpen }])
}

export async function setDaysOpen(
  dates:      string[],
  isOpen:     boolean,
  monthStart: string,
): Promise<ActionResult> {
  return saveAvailabilityMonthDraft(
    monthStart,
    dates.map((date) => ({ date, is_open: isOpen })),
  )
}

export async function setAllDaysInMonth(
  monthStart: string,
  isOpen:     boolean,
): Promise<ActionResult> {
  const ensure = await ensureMonthExists(monthStart)
  if (!ensure.ok) return { ok: false, error: ensure.error }
  const dates = (ensure.data?.days ?? []).map((d) => d.date)
  return setDaysOpen(dates, isOpen, monthStart)
}

export async function setWeekdayDays(
  monthStart: string,
  weekday:    0 | 1 | 2 | 3 | 4 | 5 | 6,
  isOpen:     boolean,
): Promise<ActionResult> {
  const ensure = await ensureMonthExists(monthStart)
  if (!ensure.ok) return { ok: false, error: ensure.error }
  const dates = (ensure.data?.days ?? [])
    .filter((d) => new Date(d.date + 'T00:00:00Z').getUTCDay() === weekday)
    .map((d) => d.date)
  return setDaysOpen(dates, isOpen, monthStart)
}
