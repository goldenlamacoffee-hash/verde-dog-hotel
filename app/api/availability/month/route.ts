/**
 * GET /api/availability/month?year=YYYY&month=M
 *
 * Returns per-day occupancy for every night in the requested calendar month.
 * "night" here means the dog sleeps at the hotel, so it covers dates
 * [first day of month … last day of month] using the same RPC as the
 * booking engine — arrival_date is the first occupied night and
 * departure_date is NOT counted.
 *
 * We over-fetch by ±1 day so the calendar can accurately colour the
 * last day of the previous month (when shown in the leading blank cells).
 *
 * Response 200:
 *   { days: { date: string; booked: number; maxDogs: number; free: number }[] }
 * Response 400: { error: string }
 * Response 500: { error: string }
 */

import { NextResponse } from 'next/server'
import { getOccupancyForRange } from '@/lib/capacity'
import { buildDayStateMap, getMonthStatus, toMonthStart } from '@/lib/availability-months'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const yearStr  = searchParams.get('year')
  const monthStr = searchParams.get('month')

  const year  = Number(yearStr)
  const month = Number(monthStr) // 1-based (January = 1)

  if (!yearStr || !monthStr || isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'Parametry year (YYYY) a month (1-12) jsou povinné.' },
      { status: 400 },
    )
  }

  // First day of month → last day of month + 1 (exclusive upper bound for
  // get_nightly_occupancy which uses [p_from, p_to))
  const pad = (n: number) => String(n).padStart(2, '0')
  const from = `${year}-${pad(month)}-01`
  const lastDay = new Date(year, month, 0).getDate() // 0th day of next month = last day of this month
  const to   = `${year}-${pad(month)}-${pad(lastDay + 1 > lastDay ? lastDay : lastDay)}`
  // to = first day of *next* month so the range is [from, to)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear  = month === 12 ? year + 1 : year
  const toExclusive = `${nextYear}-${pad(nextMonth)}-01`

  const [rows, stateMap, publicationStatus] = await Promise.all([
    getOccupancyForRange(from, toExclusive),
    buildDayStateMap(from, toExclusive),
    getMonthStatus(toMonthStart(from)),
  ])

  if ('error' in rows) {
    return NextResponse.json(
      { error: 'Nepodařilo se načíst obsazenost. Zkuste to prosím znovu.' },
      { status: 500 },
    )
  }

  const days = rows.map((r) => ({
    ...r,
    state: stateMap.get(r.date) ?? 'unreleased',
  }))

  return NextResponse.json({ days, publicationStatus })
}
