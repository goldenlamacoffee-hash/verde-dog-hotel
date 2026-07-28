/**
 * Integration tests A–I for the availability / reservation system.
 *
 * These run against the LIVE Supabase project using the service-role key.
 * All test data uses a far-future month (TEST_MONTH = 2099-09) to avoid
 * touching production records. A global afterAll cleanup removes every row.
 *
 * Run:
 *   pnpm exec vitest run --reporter=verbose __tests__/availability-integration.test.ts
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// ─── Supabase service-role client ────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Test constants ───────────────────────────────────────────────────────────

/** Month used for all tests — far future to avoid production data collisions. */
const TEST_MONTH = '2099-09-01'
const DATE_14    = '2099-09-14'
const DATE_15    = '2099-09-15'
const DATE_16    = '2099-09-16'
const DATE_20    = '2099-09-20'
const DATE_21    = '2099-09-21'

const CAPACITY = 4

const cleanupReservationIds: string[] = []
const cleanupCustomerEmails: string[] = []
let   originalMonthStatus: string | null = null

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Counter so every call gets a unique test email. */
let _counter = 0

/**
 * Call the real create_reservation RPC.
 * Returns { reservationId, error } — reservationId is null on error.
 */
async function rpcCreate(
  arrival:    string,
  departure:  string,
  dogCount = 1,
): Promise<{ reservationId: string | null; error: { message: string; code?: string } | null }> {
  const email = `verde-test-${Date.now()}-${++_counter}@verde-test.invalid`
  cleanupCustomerEmails.push(email)

  const dogs = Array.from({ length: dogCount }, (_, i) => ({
    name: `Testovací pes ${i + 1}`,
  }))

  const { data, error } = await db.rpc('create_reservation', {
    p_arrival:       arrival,
    p_departure:     departure,
    p_dog_count:     dogCount,
    p_first_name:    'Test',
    p_last_name:     'Verde',
    p_email:         email,
    p_phone:         '+420777000000',
    p_customer_note: 'Automated integration test',
    p_dogs:          dogs,
    p_service_ids:   [],
    p_consents: {
      truthfulness:            true,
      stayConditions:          true,
      cancellationConditions:  true,
      personalData:            true,
      marketing:               false,
    },
    p_ip_address: '127.0.0.1',
    p_user_agent: 'vitest',
  })

  if (error) return { reservationId: null, error: { message: error.message, code: (error as { code?: string }).code } }

  const reservationId = (data as { reservation_id: string }).reservation_id ?? null
  return { reservationId, error: null }
}

async function setMonthStatus(monthStart: string, status: 'draft' | 'published') {
  const { error } = await db
    .from('availability_months')
    .upsert({ month_start: monthStart, status }, { onConflict: 'month_start' })
  if (error) throw new Error(`setMonthStatus failed: ${error.message}`)
}

async function ensureDaysForMonth(monthStart: string, isOpen = true) {
  const days = Array.from({ length: 30 }, (_, i) => ({
    date:        `2099-09-${String(i + 1).padStart(2, '0')}`,
    month_start: monthStart,
    is_open:     isOpen,
  }))
  const { error } = await db
    .from('availability_days')
    .upsert(days, { onConflict: 'date' })
  if (error) throw new Error(`ensureDaysForMonth failed: ${error.message}`)
}

async function setDayOpen(date: string, isOpen: boolean) {
  const { error } = await db.from('availability_days').update({ is_open: isOpen }).eq('date', date)
  if (error) throw new Error(`setDayOpen(${date}, ${isOpen}) failed: ${error.message}`)
}

/** Count dogs booked for a specific night (via reservation_dogs join). */
async function bookedDogsForNight(date: string): Promise<number> {
  const { data } = await db
    .from('reservations')
    .select('reservation_dogs(dog_id)')
    .lte('arrival_date', date)
    .gt('departure_date', date)
    .not('status', 'in', '(cancelled,rejected,checked_out)')
  return (data ?? []).reduce((s, r) => s + ((r.reservation_dogs as unknown[])?.length ?? 0), 0)
}

// ─── Global setup / teardown ─────────────────────────────────────────────────

beforeAll(async () => {
  const { data } = await db
    .from('availability_months')
    .select('status').eq('month_start', TEST_MONTH).maybeSingle()
  originalMonthStatus = data?.status ?? null
  // Clean slate
  await db.from('availability_days').delete().eq('month_start', TEST_MONTH)
  await db.from('availability_months').delete().eq('month_start', TEST_MONTH)
})

afterAll(async () => {
  // Delete test reservations (FK cascade removes reservation_dogs, consents, etc.)
  if (cleanupReservationIds.length) {
    await db.from('reservations').delete().in('id', cleanupReservationIds)
  }
  // Delete test customers
  if (cleanupCustomerEmails.length) {
    await db.from('customers').delete().in('email', cleanupCustomerEmails)
  }
  // Delete test month data
  await db.from('availability_days').delete().eq('month_start', TEST_MONTH)
  await db.from('availability_months').delete().eq('month_start', TEST_MONTH)
  // Restore original month status if it existed before
  if (originalMonthStatus) {
    await db.from('availability_months').upsert(
      { month_start: TEST_MONTH, status: originalMonthStatus },
      { onConflict: 'month_start' },
    )
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// A — Unreleased month (no row in availability_months)
// ═══════════════════════════════════════════════════════════════════════════════

describe('A — Unreleased month', () => {
  it('RPC rejects with message about not being published (P0003)', async () => {
    const { reservationId, error } = await rpcCreate(DATE_14, DATE_15)
    expect(reservationId).toBeNull()
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/zveřejněn/i)
  })

  it('multi-night stay across unreleased month is also rejected', async () => {
    const { error } = await rpcCreate(DATE_14, DATE_16)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/zveřejněn/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// B — Draft month blocks bookings
// ═══════════════════════════════════════════════════════════════════════════════

describe('B — Draft month', () => {
  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'draft')
    await ensureDaysForMonth(TEST_MONTH, true)
  })

  it('availability_months row has status=draft', async () => {
    const { data } = await db
      .from('availability_months').select('status').eq('month_start', TEST_MONTH).single()
    expect(data?.status).toBe('draft')
  })

  it('RPC rejects booking in draft month', async () => {
    const { error } = await rpcCreate(DATE_14, DATE_15)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/zveřejněn/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// C — Published / all-open month accepts bookings
// ═══════════════════════════════════════════════════════════════════════════════

describe('C — Published open month', () => {
  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
    await db.from('site_settings').upsert(
      { key: 'capacity', value: { maxDogs: CAPACITY, boxes: CAPACITY } },
      { onConflict: 'key' },
    )
  })

  it('RPC returns a UUID reservation_id', async () => {
    const { reservationId, error } = await rpcCreate(DATE_14, DATE_15)
    expect(error).toBeNull()
    expect(reservationId).toMatch(/^[0-9a-f-]{36}$/)
    if (reservationId) cleanupReservationIds.push(reservationId)
  })

  it('multi-night stay also succeeds', async () => {
    const { reservationId, error } = await rpcCreate(DATE_14, DATE_16)
    expect(error).toBeNull()
    if (reservationId) cleanupReservationIds.push(reservationId)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// D — Close a specific date
// ═══════════════════════════════════════════════════════════════════════════════

describe('D — Closing a date', () => {
  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
    await setDayOpen(DATE_15, false)
  })

  afterAll(async () => {
    await setDayOpen(DATE_15, true)
  })

  it('booking 14→15 succeeds (night 15 is outside [14,15))', async () => {
    const { reservationId, error } = await rpcCreate(DATE_14, DATE_15)
    expect(error).toBeNull()
    if (reservationId) cleanupReservationIds.push(reservationId)
  })

  it('booking 15→16 fails (night 15 is closed)', async () => {
    const { error } = await rpcCreate(DATE_15, DATE_16)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/uzavřen/i)
  })

  it('booking 14→16 fails (night 15 is in [14,16) and closed)', async () => {
    const { error } = await rpcCreate(DATE_14, DATE_16)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/uzavřen/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// E — Existing reservation preserved when date is later closed
// ═══════════════════════════════════════════════════════════════════════════════

describe('E — Existing reservation preserved on close', () => {
  let existingResId: string

  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
    const { reservationId, error } = await rpcCreate('2099-09-16', '2099-09-17')
    if (error) throw new Error(`E beforeAll reservation failed: ${error.message}`)
    existingResId = reservationId!
    cleanupReservationIds.push(existingResId)
    await setDayOpen('2099-09-16', false)
  })

  afterAll(async () => {
    await setDayOpen('2099-09-16', true)
  })

  it('existing reservation on closed night still exists in DB', async () => {
    const { data } = await db.from('reservations').select('id').eq('id', existingResId).single()
    expect(data?.id).toBe(existingResId)
  })

  it('new booking for same closed night is rejected', async () => {
    const { error } = await rpcCreate('2099-09-16', '2099-09-17')
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/uzavřen/i)
  })

  it('availability_days row has is_open=false', async () => {
    const { data } = await db.from('availability_days').select('is_open').eq('date', '2099-09-16').single()
    expect(data?.is_open).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// F — Copy previous month (weekday-aligned pattern)
// ═══════════════════════════════════════════════════════════════════════════════

describe('F — Copy previous month', () => {
  const AUG_MONTH = '2099-08-01'

  beforeAll(async () => {
    // Set up Aug 2099: even calendar days open, odd closed
    await db.from('availability_months').upsert(
      { month_start: AUG_MONTH, status: 'published' },
      { onConflict: 'month_start' },
    )
    const augDays = Array.from({ length: 31 }, (_, i) => ({
      date:        `2099-08-${String(i + 1).padStart(2, '0')}`,
      month_start: AUG_MONTH,
      is_open:     i % 2 === 0,
    }))
    await db.from('availability_days').upsert(augDays, { onConflict: 'date' })

    // Sep 2099 in draft with all days open
    await setMonthStatus(TEST_MONTH, 'draft')
    await ensureDaysForMonth(TEST_MONTH, true)
  })

  afterAll(async () => {
    await db.from('availability_days').delete().eq('month_start', AUG_MONTH)
    await db.from('availability_months').delete().eq('month_start', AUG_MONTH)
    // Restore Sep as published+open
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
  })

  it('draft month rejects bookings before copy', async () => {
    const { error } = await rpcCreate(DATE_14, DATE_15)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/zveřejněn/i)
  })

  it('copy applies weekday-aligned open/close pattern from Aug to Sep', async () => {
    // Build weekday→is_open from Aug
    const { data: augRows } = await db.from('availability_days')
      .select('date, is_open').eq('month_start', AUG_MONTH)
    const wdMap = new Map<number, boolean>()
    for (const row of augRows ?? []) {
      const wd = new Date(row.date + 'T12:00:00Z').getUTCDay()
      wdMap.set(wd, row.is_open)
    }
    // Apply to Sep
    const { data: sepRows } = await db.from('availability_days')
      .select('date').eq('month_start', TEST_MONTH)
    for (const row of sepRows ?? []) {
      const wd = new Date(row.date + 'T12:00:00Z').getUTCDay()
      await db.from('availability_days').update({ is_open: wdMap.get(wd) ?? true }).eq('date', row.date)
    }
    // Verify DATE_14
    const { data: check } = await db.from('availability_days')
      .select('is_open').eq('date', DATE_14).single()
    const wd14 = new Date(DATE_14 + 'T12:00:00Z').getUTCDay()
    expect(check?.is_open).toBe(wdMap.get(wd14) ?? true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// G — Unpublish: blocks new bookings, preserves existing
// ═══════════════════════════════════════════════════════════════════════════════

describe('G — Unpublish', () => {
  let existingResId: string

  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
    const { reservationId, error } = await rpcCreate(DATE_14, DATE_15)
    if (error) throw new Error(`G beforeAll reservation failed: ${error.message}`)
    existingResId = reservationId!
    cleanupReservationIds.push(existingResId)
    await setMonthStatus(TEST_MONTH, 'draft')
  })

  afterAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
  })

  it('new bookings rejected after unpublish', async () => {
    const { error } = await rpcCreate(DATE_14, DATE_15)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/zveřejněn/i)
  })

  it('existing reservation remains in DB after unpublish', async () => {
    const { data } = await db.from('reservations').select('id').eq('id', existingResId).single()
    expect(data?.id).toBe(existingResId)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// H — Dog count counts against capacity (via reservation_dogs)
// ═══════════════════════════════════════════════════════════════════════════════

describe('H — Dog count counts against capacity', () => {
  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
    await db.from('site_settings').upsert(
      { key: 'capacity', value: { maxDogs: CAPACITY, boxes: CAPACITY } },
      { onConflict: 'key' },
    )
    // Pre-book CAPACITY-1 dogs on DATE_20
    const { reservationId, error } = await rpcCreate(DATE_20, DATE_21, CAPACITY - 1)
    if (error) throw new Error(`H prefill failed: ${error.message}`)
    if (reservationId) cleanupReservationIds.push(reservationId)
  })

  it('booked dogs via reservation_dogs equals CAPACITY-1', async () => {
    const booked = await bookedDogsForNight(DATE_20)
    expect(booked).toBe(CAPACITY - 1)
  })

  it('booking CAPACITY dogs for that night fails (only 1 spot left)', async () => {
    const { error } = await rpcCreate(DATE_20, DATE_21, CAPACITY)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/kapacita|zbývá|volných/i)
  })

  it('booking 1 dog succeeds (exactly fills last slot)', async () => {
    const { reservationId, error } = await rpcCreate(DATE_20, DATE_21, 1)
    expect(error).toBeNull()
    if (reservationId) cleanupReservationIds.push(reservationId)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// I — Concurrency: advisory lock ensures exactly one succeeds
// ═══════════════════════════════════════════════════════════════════════════════

describe('I — Concurrency: one slot, two simultaneous requests', () => {
  const DATE_28 = '2099-09-28'
  const DATE_29 = '2099-09-29'

  beforeAll(async () => {
    await setMonthStatus(TEST_MONTH, 'published')
    await ensureDaysForMonth(TEST_MONTH, true)
    await db.from('site_settings').upsert(
      { key: 'capacity', value: { maxDogs: CAPACITY, boxes: CAPACITY } },
      { onConflict: 'key' },
    )
    // Pre-book CAPACITY-1 dogs so exactly 1 slot remains
    const { reservationId, error } = await rpcCreate(DATE_28, DATE_29, CAPACITY - 1)
    if (error) throw new Error(`I prefill failed: ${error.message}`)
    if (reservationId) cleanupReservationIds.push(reservationId)
  })

  it('exactly one of two simultaneous 1-dog bookings succeeds', async () => {
    const [r1, r2] = await Promise.all([
      rpcCreate(DATE_28, DATE_29, 1),
      rpcCreate(DATE_28, DATE_29, 1),
    ])

    const successes = [r1, r2].filter((r) => r.error === null)
    const failures  = [r1, r2].filter((r) => r.error !== null)

    for (const r of successes) {
      if (r.reservationId) cleanupReservationIds.push(r.reservationId)
    }

    expect(successes.length).toBe(1)
    expect(failures.length).toBe(1)
    expect(failures[0].error!.message).toMatch(/kapacita|zbývá|volných/i)
  })
})
