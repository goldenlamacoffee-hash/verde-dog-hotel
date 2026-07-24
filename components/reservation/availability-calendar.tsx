'use client'

/**
 * AvailabilityCalendar
 *
 * A custom month-grid calendar for the Step 1 date picker in the VERDE
 * reservation flow. Fetches per-night occupancy from /api/availability/month
 * (one request per month navigation) and colour-codes each day cell.
 *
 * Colour states (ordered by urgency):
 *   - Loading / unknown → neutral (no extra colour)
 *   - Past             → muted / strikethrough, not selectable
 *   - Fully booked     → red, aria-disabled, not selectable as arrival
 *   - 1 spot left      → orange (nearly full)
 *   - ≤50% free        → amber
 *   - Free             → green
 *   - Selected arrival → primary (dark green bg), white text
 *   - In range         → light green tint
 *   - Selected dept    → primary (dark green bg), white text
 *
 * Selection rules (matches create_reservation RPC logic):
 *   - Arrival date counts as an occupied night.
 *   - Departure date does NOT count — guest leaves before the next night.
 *   - A fully-booked night anywhere in [arrival, departure) blocks the stay.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayOccupancy {
  date: string   // 'YYYY-MM-DD'
  booked: number
  maxDogs: number
  free: number
}

type OccupancyMap = Record<string, DayOccupancy>  // keyed by 'YYYY-MM-DD'

export interface AvailabilityCalendarProps {
  arrival: string     // 'YYYY-MM-DD' or ''
  departure: string   // 'YYYY-MM-DD' or ''
  onArrivalChange: (date: string) => void
  onDepartureChange: (date: string) => void
  /** Called when both dates are valid (arrival < departure) */
  onRangeChange?: (arrival: string, departure: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WEEKDAYS_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'] // Mon-first

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/** Returns the 1-based day-of-week in Mon=0 … Sun=6 convention. */
function dayOfWeek(iso: string): number {
  const d = new Date(iso + 'T00:00:00')
  return (d.getDay() + 6) % 7  // JS Sun=0 → Mon=0
}

/** Returns how many nights are in [arrival, departure). */
function nightsBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

type DayStatus = 'free' | 'partial' | 'scarce' | 'full' | 'unknown'

function getDayStatus(occ: DayOccupancy | undefined): DayStatus {
  if (!occ) return 'unknown'
  if (occ.free <= 0) return 'full'
  if (occ.free === 1) return 'scarce'
  if (occ.free <= occ.maxDogs / 2) return 'partial'
  return 'free'
}

/** Czech month name, Nominative */
const MONTH_NAMES_CS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
]

// ─── Cache ────────────────────────────────────────────────────────────────────
// Simple in-memory cache so navigating back to a month doesn't re-fetch.
const occupancyCache: Record<string, OccupancyMap> = {}

async function fetchMonth(year: number, month: number): Promise<OccupancyMap> {
  const key = `${year}-${month}`
  if (occupancyCache[key]) return occupancyCache[key]

  const res = await fetch(`/api/availability/month?year=${year}&month=${month}`)
  if (!res.ok) return {}

  const json = await res.json() as { days?: DayOccupancy[] }
  const map: OccupancyMap = {}
  for (const d of json.days ?? []) {
    map[d.date] = d
  }
  occupancyCache[key] = map
  return map
}

// ─── Day cell style helpers ───────────────────────────────────────────────────

function getDayLabel(dateStr: string, occ: DayOccupancy | undefined): string {
  const d = new Date(dateStr + 'T00:00:00')
  const label = `${d.getDate()}. ${MONTH_NAMES_CS[d.getMonth()].toLowerCase()}`
  if (!occ) return label
  if (occ.free <= 0) return `${label} – plně obsazeno`
  if (occ.free === 1) return `${label} – poslední místo`
  return `${label} – volno (${occ.free} míst)`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AvailabilityCalendar({
  arrival,
  departure,
  onArrivalChange,
  onDepartureChange,
  onRangeChange,
}: AvailabilityCalendarProps) {
  const today = todayISO()

  // Start calendar on the month containing today (or arrival if set)
  const initDate = arrival || today
  const [viewYear, setViewYear]   = useState(() => parseInt(initDate.slice(0, 4)))
  const [viewMonth, setViewMonth] = useState(() => parseInt(initDate.slice(5, 7)))
  const [occupancy, setOccupancy] = useState<OccupancyMap>({})
  const [loading, setLoading]     = useState(false)
  // Hover date for range preview while in two-date selection mode
  const [hoverDate, setHoverDate] = useState<string | null>(null)

  // Track which date we're selecting next: 'arrival' or 'departure'
  // If both are empty → selecting arrival
  // If arrival is set but departure isn't → selecting departure
  // If both are set → clicking resets arrival (restart)
  const selectingDeparture = Boolean(arrival && !departure)

  // ── Fetch occupancy when month changes ──
  const isMounted = useRef(true)
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false } }, [])

  useEffect(() => {
    setLoading(true)
    fetchMonth(viewYear, viewMonth).then((map) => {
      if (!isMounted.current) return
      setOccupancy(map)
      setLoading(false)
    })
    // Also pre-fetch next month for smooth navigation
    const nextM = viewMonth === 12 ? 1 : viewMonth + 1
    const nextY = viewMonth === 12 ? viewYear + 1 : viewYear
    fetchMonth(nextY, nextM)
  }, [viewYear, viewMonth])

  // ── Navigation ──
  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  // Prevent navigating to months entirely in the past
  const todayYear  = parseInt(today.slice(0, 4))
  const todayMonth = parseInt(today.slice(5, 7))
  const isPrevDisabled = viewYear < todayYear || (viewYear === todayYear && viewMonth <= todayMonth)

  // ── Day click ──
  const handleDayClick = useCallback((dateStr: string) => {
    const isPast = dateStr < today
    if (isPast) return

    const occ = occupancy[dateStr]
    const status = getDayStatus(occ)

    if (!arrival || (arrival && departure)) {
      // Start fresh — set arrival
      // Fully booked days can't be arrival days
      if (status === 'full') return
      onArrivalChange(dateStr)
      onDepartureChange('')
    } else {
      // Already have arrival, now picking departure
      if (dateStr <= arrival) {
        // Clicked before or on arrival → reset arrival to this date
        if (status !== 'full') {
          onArrivalChange(dateStr)
          onDepartureChange('')
        }
        return
      }
      // Validate: no fully-booked night in [arrival, dateStr)
      const blockingDate = findBlockingNight(arrival, dateStr, occupancy)
      onDepartureChange(dateStr)
      if (blockingDate === null && onRangeChange) {
        onRangeChange(arrival, dateStr)
      }
    }
  }, [arrival, departure, occupancy, onArrivalChange, onDepartureChange, onRangeChange, today])

  // ── Calendar grid ──
  const daysInMonth   = new Date(viewYear, viewMonth, 0).getDate()
  const firstWeekday  = dayOfWeek(toISO(viewYear, viewMonth, 1)) // 0=Mon

  // Determine if the selected range contains a fully-booked night
  const blockingNight = (arrival && departure && arrival < departure)
    ? findBlockingNight(arrival, departure, occupancy)
    : null

  // Range display: arrival set, hover over a potential departure
  const rangeEnd = departure || (selectingDeparture && hoverDate && hoverDate > arrival ? hoverDate : null)

  return (
    <div className="flex flex-col gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          disabled={isPrevDisabled}
          aria-label="Předchozí měsíc"
          className={cn(
            'flex size-8 items-center justify-center rounded-lg border border-border text-verde-deep transition-colors',
            isPrevDisabled
              ? 'cursor-not-allowed opacity-30'
              : 'hover:bg-verde-ivory hover:border-verde-green/40',
          )}
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex items-center gap-2 text-sm font-semibold text-verde-deep">
          {loading ? <Loader2 className="size-3.5 animate-spin text-verde-stone" /> : null}
          <span>{MONTH_NAMES_CS[viewMonth - 1]} {viewYear}</span>
        </div>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="Následující měsíc"
          className="flex size-8 items-center justify-center rounded-lg border border-border text-verde-deep transition-colors hover:bg-verde-ivory hover:border-verde-green/40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS_CS.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-verde-stone"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {/* Leading blank cells */}
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateStr = toISO(viewYear, viewMonth, day)
          const occ     = occupancy[dateStr]
          const status  = getDayStatus(occ)
          const isPast  = dateStr < today
          const isToday = dateStr === today
          const isArrival    = dateStr === arrival
          const isDeparture  = dateStr === departure
          const isInRange    = Boolean(
            arrival && rangeEnd && dateStr > arrival && dateStr < rangeEnd
          )
          const isRangeStart = isArrival
          const isRangeEnd   = isDeparture || (selectingDeparture && hoverDate === dateStr && hoverDate > arrival)
          // Whether this date is the hover-preview departure
          const isHoverDep   = selectingDeparture && hoverDate === dateStr && hoverDate > arrival && !departure

          const isFullyBooked = status === 'full'
          const isDisabled    = isPast || isFullyBooked
          const hasBlockingNight = blockingNight !== null && isInRange && (
            occupancy[dateStr]?.free === 0
          )

          const ariaLabel = getDayLabel(dateStr, occ)

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              aria-label={ariaLabel}
              aria-pressed={isArrival || isDeparture}
              aria-disabled={isDisabled}
              title={ariaLabel}
              onMouseEnter={() => setHoverDate(dateStr)}
              onMouseLeave={() => setHoverDate(null)}
              onClick={() => handleDayClick(dateStr)}
              className={cn(
                'relative flex aspect-square w-full flex-col items-center justify-center rounded-lg text-sm font-medium transition-all duration-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-green focus-visible:ring-offset-1',

                // Base / disabled / past
                isPast && 'cursor-not-allowed opacity-30 line-through text-verde-stone',

                // Availability colours (not selected, not past)
                !isPast && !isArrival && !isDeparture && !isHoverDep && (() => {
                  switch (status) {
                    case 'full':    return 'bg-red-50 text-red-600 cursor-not-allowed ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-800'
                    case 'scarce':  return 'bg-orange-50 text-orange-700 hover:bg-orange-100 ring-1 ring-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:ring-orange-800'
                    case 'partial': return 'bg-amber-50 text-amber-700 hover:bg-amber-100 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800'
                    case 'free':    return 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 ring-1 ring-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:ring-emerald-800'
                    default:        return 'bg-card text-verde-deep hover:bg-verde-ivory ring-1 ring-border'
                  }
                })(),

                // Range in-between tint (valid range)
                isInRange && !hasBlockingNight && !isArrival && !isDeparture &&
                  'bg-emerald-100/60 rounded-none ring-0 dark:bg-emerald-950/25',

                // Range in-between tint (blocked range)
                isInRange && hasBlockingNight &&
                  'bg-red-100/50 rounded-none ring-0 dark:bg-red-950/25',

                // Today ring
                isToday && !isArrival && !isDeparture &&
                  'ring-2 ring-verde-green/50',

                // Hover departure preview
                isHoverDep &&
                  'bg-verde-deep/70 text-verde-white ring-0',

                // Selected arrival / departure
                (isArrival || isDeparture) &&
                  'bg-verde-deep text-verde-white ring-0 shadow-sm z-10 scale-105',

                // Round ends of range
                isRangeStart && rangeEnd !== null && rangeEnd > arrival && 'rounded-r-none',
                isRangeEnd   && arrival !== ''    && rangeEnd !== null && rangeEnd > arrival && 'rounded-l-none',
              )}
            >
              {day}
              {/* Availability dot — tiny indicator below the number */}
              {!isPast && !isArrival && !isDeparture && (
                <span
                  className={cn(
                    'absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full',
                    status === 'full'    && 'bg-red-500',
                    status === 'scarce'  && 'bg-orange-500',
                    status === 'partial' && 'bg-amber-500',
                    status === 'free'    && 'bg-emerald-500',
                    status === 'unknown' && 'bg-transparent',
                  )}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Range warning */}
      {blockingNight && arrival && departure ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          Vybraný termín obsahuje plně obsazený den ({formatDate(blockingNight)}). Zvolte prosím jiný termín.
        </p>
      ) : null}

      {/* Selected range summary */}
      {arrival && departure && !blockingNight ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
          <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
          Příjezd {formatDate(arrival)} — Odjezd {formatDate(departure)} ({nightsBetween(arrival, departure)} {pluralNoc(nightsBetween(arrival, departure))})
        </div>
      ) : null}

      {/* Selection hint */}
      {!arrival ? (
        <p className="text-center text-xs text-verde-stone">Vyberte datum příjezdu.</p>
      ) : !departure ? (
        <p className="text-center text-xs text-verde-stone">Nyní vyberte datum odjezdu.</p>
      ) : null}

      {/* Legend */}
      <div
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-border pt-3"
        aria-label="Legenda dostupnosti"
      >
        <LegendItem color="bg-emerald-500" label="Volno" />
        <LegendItem color="bg-amber-500"   label="Zbývají místa" />
        <LegendItem color="bg-orange-500"  label="Poslední místo" />
        <LegendItem color="bg-red-500"     label="Plně obsazeno" />
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-verde-stone">
      <span className={cn('size-2.5 rounded-full shrink-0', color)} aria-hidden="true" />
      {label}
    </div>
  )
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Finds the first fully-booked night in [from, to).
 * Returns the ISO date string or null if none.
 */
function findBlockingNight(from: string, to: string, occ: OccupancyMap): string | null {
  // Walk every night in [from, to)
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to   + 'T00:00:00')
  while (cur < end) {
    const iso = cur.toISOString().split('T')[0]
    if (occ[iso] && occ[iso].free <= 0) return iso
    cur.setDate(cur.getDate() + 1)
  }
  return null
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()}. ${MONTH_NAMES_CS[d.getMonth()].toLowerCase()}.`
}

function pluralNoc(n: number): string {
  if (n === 1) return 'noc'
  if (n >= 2 && n <= 4) return 'noci'
  return 'nocí'
}
