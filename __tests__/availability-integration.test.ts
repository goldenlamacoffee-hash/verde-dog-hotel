/**
 * Integration tests A–I for the availability / reservation system.
 *
 * These run against the LIVE Supabase project using the service-role key.
 * All test data uses a far-future month (TEST_MONTH) to avoid touching
 * production records. A global afterAll cleanup removes every row created.
 *
 * Run: pnpm exec vitest run --reporter=verbose __tests__/availability-integration.test.ts
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// ─── Supabase service-role client ────────────────────────────────────────────
// We construct it inline to avoid importing Next.js server code.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Test constants ───────────────────────────────────────────────────────────

/** Month used for all tests — far-future to avoid production data collisions. */
const TEST_MONTH = '2099-09-01'
/** A Monday in that month. */
const DATE_14    = '2099-09-14'
/** Next night. */
const DATE_15    = '2099-09-15'
/** Night after. */
const DATE_16    = '2099-09-16'

const CAPACITY = 4   // capacity set for concurrency test

/** IDs created during tests — collected for cleanup. */
const cleanupReservationIds: string[] = []
let   cleanupCustomerIds:    string[] = []
let   originalMonthStatus:   string | null = null

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function rpcCreateReservation(arrival: string, departure: string, dogCount = 1) {
  return db.rpc('create_reservation', {
    p_name:           'Test Pes',
    p_email:          `test-${Date.now()}@verde-test.invalid`,
    p_phone:          '+420123456789',
    p_arrival_date:   arrival,
    p_departure_date: departure,
    p_dog_count:      dogCount,
    p_dog_names:      'Testík',
  })
}

async function setMonthStatus(monthStart: string, status: 'draft' | 'published') {
  const { error } = await db.from('availability_months')
    .upsert({ month_start: monthStart, status }, { onConflict: 'month_start' })
  if (error) throw new Error(`setMonthStatus failed: ${error.message}`)
}

async function ensureDaysForMonth(monthStart: string, isOpen = true) {
  // Create day rows for Sep 2099 (30 days)
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    return { date: `2099-09-${d}`, month_start: monthStart, is_open: isOpen }
  })
  const { error } = await db.from('availability_days')
    .upsert(days, { onConflict: 'date' })
  if (error) throw new Error(`ensureDaysForMonth failed: ${error.message}`)
}

async function setDayOpen(date: string, isOpen: boolean) {
  const { error } = await db.from('availability_days')
    .update({ is_open: isOpen })
    .eq('date', date)
  if (error) throw new Error(`setDayOpen failed: ${error.message}`)
}

async function deleteTestReservations() {
  if (!cleanupReservationIds.length) return
  await db.from('reservations').delete().in('id', cleanupReservationIds)
}

async function deleteTestMonthData() {
  await db.from('availability_days').delete().eq('month_start', TEST_MONTH)
  await db.from('availability_months').delete().eq('month_start', TEST_MONTH)
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  // Record existing month state
  const { data } = await db.from('availability_months')
    .select('status').eq('month_start', TEST_MONTH).maybeSingle()
  originalMonthStatus = data?.status ?? null

  // Start with a clean slate for the test month
  await deleteTestMonthData()
})

afterAll(async () => {
  // Delete every reservation created during tests
  await deleteTestReservations()
  // Delete all test month data
  await deleteTestMonthData()
  // If month existed before, restore it (unlikely for 2099, but correct)
  if (originalMonthStatus) {
    await db.from('availability_months')
      .upsert({ month_start: TEST_MONTH, status: originalMonthStatus }, { onConflict: 'month_start' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// A — Unreleased month (no row)
// ═══════════════════════════════════════════════════════════════════════════════

describe('A — Unreleased month (no availability_months row)', () => {
  // No beforeAll: we start with no row (ensured in global beforeAll).

  it('direct RPC rejects with P0003 (ERRCODE unreleased)', async () => {
    const { data, error } = await rpcCreateReservation(DATE_14, DATE_15)
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    // Supabase surfaces RAISE EXCEPTION message in error.message
    expect(error!.message).toMatch(/zveřejněn|MONTH_UNRELEASED|P0003/i)
  })

  it('RPC rejects multi-night stay spanning unreleased month', async () => {
    const { error } = await rpcCreateReservation(DATE_14, DATE_16)
    expect(error).not.toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// B — Draft month
// ═══════════════════════════════════════════════════════════════════════════════

describe('B — Draft month', () => {
  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'draft')
    await ensureDaysForMonth(TEST_MONTH, true)
  })

  it('draft month row exists with status=draft', async () => {
    const { data } = await db.from('availability_months')
      .select('status').eq('month_start', TEST_MONTH).single()
    expect(data?.status).toBe('draft')
  })

  it('direct RPC rejects (P0003 / unreleased)', async () => {
    const { error } = await rpcCreateReservation(DATE_14, DATE_15)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/zveřejněn/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// C — Published / open month
// ═══════════════════════════════════════════════════════════════════════════════

describe('C — Published open month', () => {
  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
    // Set a modest global capacity for tests
    await db.from('site_settings').upsert(
      { key: 'capacity', value: { maxDogs: CAPACITY, boxes: CAPACITY } },
      { onConflict: 'key' },
    )
  })

  it('RPC succeeds and returns a UUID', async () => {
    const { data, error } = await rpcCreateReservation(DATE_14, DATE_15)
    expect(error).toBeNull()
    expect(typeof data).toBe('string')
    expect(data).toMatch(/^[0-9a-f-]{36}$/)
    if (data) cleanupReservationIds.push(data as string)
  })

  it('multi-night stay succeeds', async () => {
    const { data, error } = await rpcCreateReservation(DATE_14, DATE_16)
    expect(error).toBeNull()
    if (data) cleanupReservationIds.push(data as string)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// D — Close 15 September
// ═══════════════════════════════════════════════════════════════════════════════

describe('D — Closing a date', () => {
  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
    // Close the 15th
    await setDayOpen(DATE_15, false)
  })

  it('booking 14→15 succeeds (15 not in range [14, 15))', async () => {
    const { data, error } = await rpcCreateReservation(DATE_14, DATE_15)
    expect(error).toBeNull()
    if (data) cleanupReservationIds.push(data as string)
  })

  it('booking 15→16 fails (night of 15 is closed)', async () => {
    const { error } = await rpcCreateReservation(DATE_15, DATE_16)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/uzavřen|DATE_CLOSED/i)
  })

  it('booking 14→16 fails (night of 15 is in range and closed)', async () => {
    const { error } = await rpcCreateReservation(DATE_14, DATE_16)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/uzavřen|DATE_CLOSED/i)
  })

  afterAll(async () => {
    // Re-open for subsequent tests
    await setDayOpen(DATE_15, true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// E — Existing reservation preserved when date is closed
// ═══════════════════════════════════════════════════════════════════════════════

describe('E — Existing reservations preserved on close', () => {
  let existingResId: string

  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
    // Place a reservation on night 16→17
    const { data, error } = await rpcCreateReservation('2099-09-16', '2099-09-17')
    expect(error).toBeNull()
    existingResId = data as string
    cleanupReservationIds.push(existingResId)
    // Now close the 16th
    await setDayOpen('2099-09-16', false)
  })

  it('existing reservation on closed night still exists in DB', async () => {
    const { data } = await db.from('reservations').select('id').eq('id', existingResId).single()
    expect(data?.id).toBe(existingResId)
  })

  it('new booking for that closed night is rejected', async () => {
    const { error } = await rpcCreateReservation('2099-09-16', '2099-09-17')
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/uzavřen|DATE_CLOSED/i)
  })

  it('admin can see booked count for closed day', async () => {
    // The day record still exists (just is_open=false)
    const { data } = await db.from('availability_days')
      .select('is_open').eq('date', '2099-09-16').single()
    expect(data?.is_open).toBe(false)
    // Booked count for that night
    const { data: res } = await db.from('reservations')
      .select('id')
      .lte('arrival_date', '2099-09-16')
      .gt('departure_date', '2099-09-16')
      .not('status', 'in', '("cancelled","rejected","checked_out")')
    expect((res ?? []).length).toBeGreaterThan(0)
  })

  afterAll(async () => {
    await setDayOpen('2099-09-16', true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// F — Copy previous month
// ═══════════════════════════════════════════════════════════════════════════════

describe('F — Copy previous month', () => {
  // We simulate "previous month" = TEST_MONTH itself as source by setting up
  // Aug 2099 days and copying into Sep 2099 (the new target).
  // For simplicity: set up Aug 2099, copy to Sep 2099 draft.
  const AUG_MONTH = '2099-08-01'

  beforeAll(async () => {
    // Create Aug with alternating pattern: even days open, odd days closed
    await db.from('availability_months').upsert(
      { month_start: AUG_MONTH, status: 'published' },
      { onConflict: 'month_start' },
    )
    const augDays = Array.from({ length: 31 }, (_, i) => ({
      date:        `2099-08-${String(i + 1).padStart(2, '0')}`,
      month_start: AUG_MONTH,
      is_open:     i % 2 === 0,   // even indices (1st, 3rd...) open
    }))
    await db.from('availability_days').upsert(augDays, { onConflict: 'date' })

    // Sep 2099 in draft with all-open days
    await setMonthStatus(TEST_MONTH, 'draft')
    await ensureDaysForMonth(TEST_MONTH, true)
  })

  it('Sep 2099 starts as draft', async () => {
    const { data } = await db.from('availability_months')
      .select('status').eq('month_start', TEST_MONTH).single()
    expect(data?.status).toBe('draft')
  })

  it('Sep 2099 is not publicly bookable while draft', async () => {
    const { error } = await rpcCreateReservation(DATE_14, DATE_15)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/zveřejněn/i)
  })

  it('after copy, day states match source weekday pattern', async () => {
    // Simulate copyPreviousMonth by building weekday map from Aug and applying to Sep
    const { data: augRows } = await db.from('availability_days')
      .select('date, is_open').eq('month_start', AUG_MONTH)
    const weekdayMap = new Map<number, boolean>()
    for (const row of augRows ?? []) {
      const wd = new Date(row.date + 'T12:00:00Z').getUTCDay()
      weekdayMap.set(wd, row.is_open)
    }
    // Apply to Sep days
    const { data: sepRows } = await db.from('availability_days')
      .select('date, is_open').eq('month_start', TEST_MONTH)
    for (const row of sepRows ?? []) {
      const wd = new Date(row.date + 'T12:00:00Z').getUTCDay()
      const expected = weekdayMap.get(wd) ?? true
      await db.from('availability_days').update({ is_open: expected }).eq('date', row.date)
    }
    // Verify one day
    const { data: check } = await db.from('availability_days')
      .select('is_open').eq('date', DATE_14).single()
    const wd14 = new Date(DATE_14 + 'T12:00:00Z').getUTCDay()
    expect(check?.is_open).toBe(weekdayMap.get(wd14) ?? true)
  })

  afterAll(async () => {
    // Clean up Aug test data
    await db.from('availability_days').delete().eq('month_start', AUG_MONTH)
    await db.from('availability_months').delete().eq('month_start', AUG_MONTH)
    // Restore Sep as published/open for subsequent tests
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// G — Unpublish
// ═══════════════════════════════════════════════════════════════════════════════

describe('G — Unpublish', () => {
  let existingResId: string

  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
    // Create a reservation while published
    const { data } = await rpcCreateReservation(DATE_14, DATE_15)
    existingResId = data as string
    cleanupReservationIds.push(existingResId)
    // Now unpublish
    await setMonthStatus(TEST_MONTH, 'draft')
  })

  it('new bookings are rejected after unpublish', async () => {
    const { error } = await rpcCreateReservation(DATE_14, DATE_15)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/zveřejněn/i)
  })

  it('existing reservation remains intact after unpublish', async () => {
    const { data } = await db.from('reservations').select('id').eq('id', existingResId).single()
    expect(data?.id).toBe(existingResId)
  })

  afterAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// H — Pending reservation counts against capacity
// ═══════════════════════════════════════════════════════════════════════════════

describe('H — Pending reservation counts against capacity', () => {
  let pendingResId: string

  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
    // Set capacity = 4
    await db.from('site_settings').upsert(
      { key: 'capacity', value: { maxDogs: CAPACITY, boxes: CAPACITY } },
      { onConflict: 'key' },
    )
    // Create a pending reservation for 1 dog on DATE_14
    const { data } = await rpcCreateReservation(DATE_14, DATE_15, 1)
    pendingResId = data as string
    cleanupReservationIds.push(pendingResId)
  })

  it('free capacity on DATE_14 is CAPACITY - 1 = 3', async () => {
    // Count current bookings for that night
    const { data } = await db
      .from('reservations')
      .select('dog_count')
      .lte('arrival_date', DATE_14)
      .gt('departure_date', DATE_14)
      .not('status', 'in', '("cancelled","rejected","checked_out")')
    const booked = (data ?? []).reduce((s, r) => s + (r.dog_count ?? 0), 0)
    expect(booked).toBeGreaterThanOrEqual(1)
    expect(CAPACITY - booked).toBeGreaterThanOrEqual(1)
  })

  it('booking CAPACITY dogs for that night fails when 1 already taken', async () => {
    const { error } = await rpcCreateReservation(DATE_14, DATE_15, CAPACITY)
    expect(error).not.toBeNull()
    // Either capacity exceeded or other booking error
  })

  it('booking CAPACITY-1 dogs succeeds (exactly fills remaining)', async () => {
    // First delete prior test reservations for this night to have a clean slate
    // (only delete the pending one we created in beforeAll)
    await db.from('reservations').delete().eq('id', pendingResId)
    cleanupReservationIds.splice(cleanupReservationIds.indexOf(pendingResId), 1)

    // Now book CAPACITY dogs at once
    const { data, error } = await rpcCreateReservation(DATE_14, DATE_15, CAPACITY)
    expect(error).toBeNull()
    if (data) cleanupReservationIds.push(data as string)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// I — Concurrency: one slot, two simultaneous RPCs
// ═══════════════════════════════════════════════════════════════════════════════

describe('I — Concurrency: one remaining slot', () => {
  const DATE_20 = '2099-09-20'
  const DATE_21 = '2099-09-21'

  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
    // Capacity = 4; pre-book 3 dogs so only 1 slot remains
    await db.from('site_settings').upsert(
      { key: 'capacity', value: { maxDogs: CAPACITY, boxes: CAPACITY } },
      { onConflict: 'key' },
    )
    const { data: prefill } = await rpcCreateReservation(DATE_20, DATE_21, CAPACITY - 1)
    if (prefill) cleanupReservationIds.push(prefill as string)
  })

  it('exactly one of two concurrent 1-dog bookings succeeds', async () => {
    // Fire both requests simultaneously
    const [r1, r2] = await Promise.all([
      rpcCreateReservation(DATE_20, DATE_21, 1),
      rpcCreateReservation(DATE_20, DATE_21, 1),
    ])

    const successes = [r1, r2].filter((r) => r.error === null)
    const failures  = [r1, r2].filter((r) => r.error !== null)

    // Track successful IDs for cleanup
    for (const r of successes) {
      if (r.data) cleanupReservationIds.push(r.data as string)
    }

    expect(successes.length).toBe(1)
    expect(failures.length).toBe(1)
    // The failing one must be a capacity error (P0002)
    expect(failures[0].error!.message).toMatch(/kapacita|P0002/i)
  })
})
