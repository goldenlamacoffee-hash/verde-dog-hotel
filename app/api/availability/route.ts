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

  // ── Day-state gate — checked before occupancy ─────────────────────────────
  // Any unreleased or closed night in the range blocks the stay.
  // 409 Conflict distinguishes "intentionally unavailable" from 500 DB errors.
  try {
    const stateMap = await buildDayStateMap(arrival, departure)
    for (const [date, state] of stateMap) {
      if (state === 'unreleased') {
        return NextResponse.json(
          {
            available: false,
            spotsLeft: 0,
            dayState: 'unreleased',
            reason: `Termín ${date} zatím nebyl zveřejněn. Zkuste prosím jiný termín nebo nás kontaktujte přímo.`,
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
            reason: `Na datum ${date} je hotel uzavřen. Zkuste prosím jiný termín.`,
          },
          { status: 409 },
        )
      }
    }
  } catch {
    // Day-state check failed → fall through to occupancy check (fail-open for state)
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
