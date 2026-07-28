/**
 * GET /api/availability?arrival=YYYY-MM-DD&departure=YYYY-MM-DD
 *
 * Returns the minimum free spots across every night of the requested stay.
 * Uses the shared capacity engine (get_nightly_occupancy RPC) so the number
 * is authoritative and consistent with the admin dashboard and the
 * create_reservation RPC capacity check.
 *
 * Response:
 *   200  { available: true,  spotsLeft: N }
 *   200  { available: false, spotsLeft: 0, reason: "..." }
 *   400  { error: "..." }          — bad date params
 *   500  { error: "..." }          — DB / RPC failure
 */

import { NextResponse } from 'next/server'
import { getOccupancyForRange } from '@/lib/capacity'
import { buildDayStateMap } from '@/lib/availability-months'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const arrival   = searchParams.get('arrival')
  const departure = searchParams.get('departure')

  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!arrival || !departure || !dateRe.test(arrival) || !dateRe.test(departure)) {
    return NextResponse.json({ error: 'Parametry arrival a departure jsou povinné (YYYY-MM-DD).' }, { status: 400 })
  }
  if (arrival >= departure) {
    return NextResponse.json({ error: 'Datum odjezdu musí být po datu příjezdu.' }, { status: 400 })
  }

  // ── Day-state gate (FAIL-CLOSED) ─────────────────────────────────────────
  // Any unreleased or closed night blocks the stay.
  // 409 = intentionally unavailable. 503 = availability tables unreadable.
  try {
    const stateMap = await buildDayStateMap(arrival, departure)
    for (const [date, state] of stateMap) {
      if (state === 'unreleased') {
        return NextResponse.json(
          {
            available: false,
            spotsLeft: 0,
            dayState: 'unreleased',
            reason: 'Termíny pro zvolený měsíc zatím nebyly zveřejněny.',
          },
          { status: 409 },
        )
      }
      if (state === 'closed') {
        return NextResponse.json(
          {
            available: false,
            spotsLeft: 0,
            dayState: 'closed',
            reason: 'Hotel ve zvoleném termínu nepřijímá nové pobyty.',
          },
          { status: 409 },
        )
      }
    }
  } catch (err) {
    // FAIL-CLOSED: availability tables unreadable → 503
    console.error('[verde] buildDayStateMap failed in /api/availability:', err)
    return NextResponse.json(
      {
        available: false,
        spotsLeft: 0,
        code: 'AVAILABILITY_CHECK_FAILED',
        reason: 'Dostupnost termínu se nyní nepodařilo ověřit. Zkuste to prosím znovu.',
      },
      { status: 503 },
    )
  }

  const rows = await getOccupancyForRange(arrival, departure)

  if ('error' in rows) {
    return NextResponse.json(
      { error: 'Nepodařilo se ověřit dostupnost. Zkuste to prosím znovu.' },
      { status: 500 }
    )
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Žádná data pro zadaný termín.' }, { status: 500 })
  }

  // The tightest night determines how many dogs can be accepted for the full stay
  let minFree = Infinity
  for (const row of rows) {
    if (row.free < minFree) minFree = row.free
  }
  const spotsLeft = Math.max(0, minFree)

  return NextResponse.json({
    available: spotsLeft > 0,
    spotsLeft,
  })
}
