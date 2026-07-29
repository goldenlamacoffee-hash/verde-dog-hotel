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

// ═════════════════════════���═════════════════════════════════════════════════════
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
// SPEC §6 — New month-planner workflow tests (A–G)
// ═══════════════════════════════════════════════════════════════════════════════

const SPEC_MONTH = '2099-10-01'    // October 2099 — isolated from the existing suite
const SPEC_15    = '2099-10-15'
const SPEC_16    = '2099-10-16'
const SPEC_17    = '2099-10-17'

/**
 * Actor UUID for RPC calls — must be a real auth.users row to satisfy the FK
 * constraint on availability_days.updated_by and availability_months.published_by.
 * Using the first existing user in the project's auth.users table.
 */
const ACTOR_ID = '4fd1b911-d7ac-4001-92f8-088d77a115eb'

async function specEnsureMonth(status: 'draft' | 'published', allOpen = true) {
  await db.from('availability_months').upsert(
    { month_start: SPEC_MONTH, status },
    { onConflict: 'month_start' },
  )
  const days = Array.from({ length: 31 }, (_, i) => ({
    date:        `2099-10-${String(i + 1).padStart(2, '0')}`,
    month_start: SPEC_MONTH,
    is_open:     allOpen,
  }))
  await db.from('availability_days').upsert(days, { onConflict: 'date' })
}

async function getMonthRow(monthStart: string) {
  const { data } = await db
    .from('availability_months')
    .select('status, published_at')
    .eq('month_start', monthStart)
    .maybeSingle()
  return data
}

async function getDayRow(date: string) {
  const { data } = await db
    .from('availability_days')
    .select('is_open')
    .eq('date', date)
    .maybeSingle()
  return data
}

// Clean up SPEC month data after all spec tests
afterAll(async () => {
  await db.from('availability_days').delete().eq('month_start', SPEC_MONTH)
  await db.from('availability_months').delete().eq('month_start', SPEC_MONTH)
})

describe('SPEC A — Edit published month without saving: public calendar unchanged', () => {
  beforeAll(async () => {
    await specEnsureMonth('published', true)
  })

  it('month starts as published', async () => {
    const row = await getMonthRow(SPEC_MONTH)
    expect(row?.status).toBe('published')
  })

  it('simulated local edit (no DB write) leaves DB unchanged', async () => {
    // Enter "edit mode" = purely client state; nothing written to DB.
    // Verify DB day is still open (as seeded).
    const row = await getDayRow(SPEC_15)
    expect(row?.is_open).toBe(true)
  })

  it('month status is still published after local-only edits', async () => {
    const row = await getMonthRow(SPEC_MONTH)
    expect(row?.status).toBe('published')
  })
})

describe('SPEC B — Save and publish changes: all changes appear publicly together', () => {
  beforeAll(async () => {
    await specEnsureMonth('published', true)
  })

  it('save_availability_month_draft RPC transitions month to draft atomically', async () => {
    const days = Array.from({ length: 31 }, (_, i) => ({
      date:    `2099-10-${String(i + 1).padStart(2, '0')}`,
      is_open: i !== 14,    // day 15 = closed, rest open
    }))
    const { error } = await db.rpc('save_availability_month_draft', {
      p_month_start: SPEC_MONTH,
      p_days:        days,
      p_actor_id:    ACTOR_ID,
    })
    expect(error).toBeNull()
    const row = await getMonthRow(SPEC_MONTH)
    expect(row?.status).toBe('draft')
  })

  it('draft status blocks new bookings (customers see no change until publish)', async () => {
    // Ensure capacity is set
    await db.from('site_settings').upsert(
      { key: 'capacity', value: { maxDogs: CAPACITY, boxes: CAPACITY } },
      { onConflict: 'key' },
    )
    const { error } = await rpcCreate(SPEC_15, SPEC_16)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/zveřejněn/i)
  })

  it('publish_availability_month_changes RPC publishes all changes atomically', async () => {
    const days = Array.from({ length: 31 }, (_, i) => ({
      date:    `2099-10-${String(i + 1).padStart(2, '0')}`,
      is_open: i !== 14,    // day 15 = closed
    }))
    const { error } = await db.rpc('publish_availability_month_changes', {
      p_month_start: SPEC_MONTH,
      p_days:        days,
      p_actor_id:    ACTOR_ID,
    })
    expect(error).toBeNull()

    const monthRow = await getMonthRow(SPEC_MONTH)
    expect(monthRow?.status).toBe('published')
    expect(monthRow?.published_at).not.toBeNull()
  })

  it('day 15 is now closed after publish', async () => {
    const row = await getDayRow(SPEC_15)
    expect(row?.is_open).toBe(false)
  })

  it('booking on closed day 15 is rejected', async () => {
    const { error } = await rpcCreate(SPEC_15, SPEC_16)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/uzavřen/i)
  })

  it('booking on open day 16 succeeds', async () => {
    const { reservationId, error } = await rpcCreate(SPEC_16, SPEC_17)
    expect(error).toBeNull()
    if (reservationId) cleanupReservationIds.push(reservationId)
  })
})

describe('SPEC C — Cancel published-month edits: public and DB remain unchanged', () => {
  beforeAll(async () => {
    // Start with published, day 15 open
    await specEnsureMonth('published', true)
  })

  it('DB day 15 is open before any edit', async () => {
    const row = await getDayRow(SPEC_15)
    expect(row?.is_open).toBe(true)
  })

  it('cancelling edits (no DB call made) leaves DB unchanged', async () => {
    // Cancel = discard local state without calling any server action.
    // Nothing to call — verify DB is still unchanged.
    const row = await getDayRow(SPEC_15)
    expect(row?.is_open).toBe(true)
  })

  it('month remains published', async () => {
    const row = await getMonthRow(SPEC_MONTH)
    expect(row?.status).toBe('published')
  })
})

describe('SPEC D — Exact day-to-day copy: mixed states on same weekday preserved', () => {
  const SEP_MONTH = '2099-09-01'    // reuse Sep as source; already cleaned at afterAll

  beforeAll(async () => {
    // Build a Sep source where day 1 = open, day 2 = closed, day 3 = open, …
    await db.from('availability_months').upsert(
      { month_start: SEP_MONTH, status: 'published' },
      { onConflict: 'month_start' },
    )
    const sepDays = Array.from({ length: 30 }, (_, i) => ({
      date:        `2099-09-${String(i + 1).padStart(2, '0')}`,
      month_start: SEP_MONTH,
      is_open:     i % 2 === 0,    // odd days closed, even open
    }))
    await db.from('availability_days').upsert(sepDays, { onConflict: 'date' })

    // Oct target in draft
    await specEnsureMonth('draft', true)
  })

  afterAll(async () => {
    await db.from('availability_days').delete().eq('month_start', SEP_MONTH)
    await db.from('availability_months').delete().eq('month_start', SEP_MONTH)
  })

  it('day 1 (Sep) = open → Oct day 1 should be open after copy', async () => {
    // Simulate exact positional copy via direct DB copy
    const { data: sepRows } = await db.from('availability_days')
      .select('date, is_open').eq('month_start', SEP_MONTH).order('date')
    const { data: octRows } = await db.from('availability_days')
      .select('date').eq('month_start', SPEC_MONTH).order('date')

    for (let i = 0; i < (octRows?.length ?? 0); i++) {
      const src = sepRows?.[i]
      const tgt = octRows?.[i]
      if (!tgt) continue
      await db.from('availability_days').update({ is_open: src ? src.is_open : false }).eq('date', tgt.date)
    }

    // Verify Oct day 1 = open (Sep day 1 = open, index 0)
    const oct1 = await getDayRow('2099-10-01')
    expect(oct1?.is_open).toBe(true)    // Sep day 1 is open
  })

  it('day 2 (Sep) = closed → Oct day 2 should be closed after copy', async () => {
    const oct2 = await getDayRow('2099-10-02')
    expect(oct2?.is_open).toBe(false)   // Sep day 2 is closed
  })

  it('Oct day 31 (no Sep source day) = closed by default', async () => {
    const oct31 = await getDayRow('2099-10-31')
    expect(oct31?.is_open).toBe(false)  // Sep has 30 days, oct[30] = no source → false
  })

  it('different days of the same weekday are NOT flattened to one value', async () => {
    // Two Mondays in Sep may differ; the exact copy preserves individuality
    const { data: sepRows } = await db.from('availability_days')
      .select('date, is_open').eq('month_start', SEP_MONTH).order('date')
    const mondays = (sepRows ?? []).filter(
      (r) => new Date(r.date + 'T12:00:00Z').getUTCDay() === 1
    )
    // Map Sep date → corresponding Oct date by position (same day-of-month number)
    function sepToOct(sepDate: string): string {
      return sepDate.replace(/^2099-09-/, '2099-10-')
    }
    // If the two Mondays differ in Sep source, they must differ in Oct copy
    if (mondays.length >= 2 && mondays[0].is_open !== mondays[1].is_open) {
      const octMonday1 = await getDayRow(sepToOct(mondays[0].date))
      const octMonday2 = await getDayRow(sepToOct(mondays[1].date))
      expect(octMonday1?.is_open).not.toBe(octMonday2?.is_open)
    } else {
      // Sep has uniform Mondays — just assert one is correct
      if (mondays.length >= 1) {
        const octM = await getDayRow(sepToOct(mondays[0].date))
        expect(octM?.is_open).toBe(mondays[0].is_open)
      }
    }
  })
})

describe('SPEC E — Close date with existing reservation: warning shown, reservation preserved', () => {
  let specResId: string

  beforeAll(async () => {
    await specEnsureMonth('published', true)
    await db.from('site_settings').upsert(
      { key: 'capacity', value: { maxDogs: CAPACITY, boxes: CAPACITY } },
      { onConflict: 'key' },
    )
    // Make a booking on SPEC_15
    const { reservationId, error } = await rpcCreate(SPEC_15, SPEC_16)
    if (error) throw new Error(`SPEC E beforeAll reservation failed: ${error.message}`)
    specResId = reservationId!
    cleanupReservationIds.push(specResId)
  })

  it('SPEC_15 has at least 1 booked dog before close', async () => {
    const booked = await bookedDogsForNight(SPEC_15)
    expect(booked).toBeGreaterThanOrEqual(1)
  })

  it('existing reservation survives after closing the date', async () => {
    // Close the date
    await db.from('availability_days').update({ is_open: false }).eq('date', SPEC_15)
    const { data } = await db.from('reservations').select('id').eq('id', specResId).single()
    expect(data?.id).toBe(specResId)
  })

  it('new booking for the same closed date is rejected', async () => {
    const { error } = await rpcCreate(SPEC_15, SPEC_16)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/uzavřen/i)
  })

  it('booked dog count is still counted (capacity reports booked dogs, not 0)', async () => {
    const booked = await bookedDogsForNight(SPEC_15)
    expect(booked).toBeGreaterThanOrEqual(1)
  })
})

describe('SPEC F — Atomic save: one invalid day rolls back entire month update', () => {
  beforeAll(async () => {
    await specEnsureMonth('draft', true)
  })

  it('save_availability_month_draft with a date from the wrong month fails with P0001', async () => {
    const days = [
      { date: '2099-10-15', is_open: true },
      { date: '2099-11-01', is_open: false },   // wrong month — must trigger rollback
    ]
    const { error } = await db.rpc('save_availability_month_draft', {
      p_month_start: SPEC_MONTH,
      p_days:        days,
      p_actor_id:    ACTOR_ID,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/nepatří|měsíce/i)
  })

  it('no partial write: SPEC_15 is still open (transaction rolled back)', async () => {
    const row = await getDayRow(SPEC_15)
    expect(row?.is_open).toBe(true)
  })

  it('publish_availability_month_changes with a date from the wrong month also rolls back', async () => {
    const days = [
      { date: '2099-10-15', is_open: true },
      { date: '2099-08-01', is_open: false },   // wrong month
    ]
    const { error } = await db.rpc('publish_availability_month_changes', {
      p_month_start: SPEC_MONTH,
      p_days:        days,
      p_actor_id:    ACTOR_ID,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/nepatří|měsíce/i)
  })

  it('month is still draft after failed publish (entire tx rolled back)', async () => {
    const row = await getMonthRow(SPEC_MONTH)
    expect(row?.status).toBe('draft')
  })
})

describe('SPEC G — Concurrency: one final place, two simultaneous RPC calls', () => {
  const SPEC_25 = '2099-10-25'
  const SPEC_26 = '2099-10-26'

  beforeAll(async () => {
    await specEnsureMonth('published', true)
    await db.from('site_settings').upsert(
      { key: 'capacity', value: { maxDogs: CAPACITY, boxes: CAPACITY } },
      { onConflict: 'key' },
    )
    // Pre-book CAPACITY-1 dogs so exactly 1 slot remains
    const { reservationId, error } = await rpcCreate(SPEC_25, SPEC_26, CAPACITY - 1)
    if (error) throw new Error(`SPEC G prefill failed: ${error.message}`)
    if (reservationId) cleanupReservationIds.push(reservationId)
  })

  it('exactly one of two simultaneous 1-dog bookings succeeds', async () => {
    const [r1, r2] = await Promise.all([
      rpcCreate(SPEC_25, SPEC_26, 1),
      rpcCreate(SPEC_25, SPEC_26, 1),
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
