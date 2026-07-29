'use client'

/**
 * AvailabilityCalendar — compact dual-month date-range picker
 *
 * Desktop: two calendars side by side (current + next month), shared navigation.
 * Mobile: two calendars stacked vertically.
 *
 * Availability is communicated via:
 *   1. Full-cell colored backgrounds (CMS-configurable)
 *   2. Non-color secondary indicator text ( free count / × )
 *   3. aria-label with Czech plain-language description
 *
 * Availability status rules:
 *   full    → CMS fullBackground/fullText, "×" indicator, disabled as arrival
 *   scarce  → CMS lastBackground/lastText,  "1" indicator
 *   partial → CMS limitedBackground/limitedText, count indicator
 *   free    → CMS availableBackground/availableText, no secondary indicator
 *
 * Selection rules (identical to create_reservation RPC):
 *   - Arrival is an occupied night.
 *   - Departure is NOT occupied — guest leaves before that night.
 *   - A fully-booked night in [arrival, departure) blocks the range.
 *   - A fully-booked departure date itself is allowed.
 *
 * API: GET /api/availability/month?year=YYYY&month=M
 *   → { days: { date, booked, maxDogs, free }[] }
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarAppearance, DayState } from '@/lib/types'
import { CALENDAR_APPEARANCE_DEFAULTS } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayOccupancy {
  date:    string
  booked:  number
  maxDogs: number
  free:    number
  /** Day state from availability_months/availability_days tables. */
  state?: DayState
}

type OccupancyMap = Record<string, DayOccupancy>

export interface AvailabilityCalendarProps {
  arrival: string
  departure: string
  onArrivalChange: (date: string) => void
  onDepartureChange: (date: string) => void
  onRangeChange?: (arrival: string, departure: string) => void
  /** CMS-configured colors — falls back to VERDE defaults when omitted. */
  appearance?: CalendarAppearance
  /**
   * Optional maximum stay length from CMS (occupied nights).
   * null = no maximum. Positive integer = departure dates producing more nights
   * than this value are disabled and cannot be selected.
   */
  maximumStayNights?: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAYS_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

const MONTH_NAMES_CS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
]

const MONTH_NAMES_GENITIVE_CS = [
  'ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dayOfWeek(iso: string): number {
  const d = new Date(iso + 'T00:00:00')
  return (d.getDay() + 6) % 7
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  let m = month - 1 + delta
  let y = year + Math.floor(m / 12)
  m = ((m % 12) + 12) % 12
  return { year: y, month: m + 1 }
}

type DayStatus = 'free' | 'partial' | 'scarce' | 'full' | 'unknown' | 'closed' | 'unreleased'

function getDayStatus(occ: DayOccupancy | undefined): DayStatus {
  if (!occ) return 'unknown'
  // Day-state gates take priority over occupancy counts
  if (occ.state === 'unreleased') return 'unreleased'
  if (occ.state === 'closed')     return 'closed'
  if (occ.free <= 0) return 'full'
  if (occ.free === 1) return 'scarce'
  if (occ.free <= occ.maxDogs / 2) return 'partial'
  return 'free'
}

function nightsBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function pluralNoc(n: number): string {
  if (n === 1) return 'noc'
  if (n >= 2 && n <= 4) return 'noci'
  return 'nocí'
}

function formatDateLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()}. ${MONTH_NAMES_GENITIVE_CS[d.getMonth()]} ${d.getFullYear()}`
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()}. ${MONTH_NAMES_GENITIVE_CS[d.getMonth()]}.`
}

/** First fully-booked night in [from, to) or null. */
function findBlockingNight(from: string, to: string, occ: OccupancyMap): string | null {
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (cur < end) {
    const iso = cur.toISOString().split('T')[0]
    if (occ[iso]?.free <= 0) return iso
    cur.setDate(cur.getDate() + 1)
  }
  return null
}

/**
 * Full accessible aria-label for a day button.
 * Spec examples:
 *   "25. července 2026, volno, 4 místa"
 *   "26. července 2026, zbývají 2 místa"
 *   "27. července 2026, poslední volné místo"
 *   "28. července 2026, plně obsazeno"
 */
function getDayAriaLabel(
  dateStr:    string,
  occ:        DayOccupancy | undefined,
  isValidDep: boolean,
  isArrival:  boolean,
  isDeparture: boolean,
): string {
  const d    = new Date(dateStr + 'T00:00:00')
  const base = `${d.getDate()}. ${MONTH_NAMES_GENITIVE_CS[d.getMonth()]} ${d.getFullYear()}`
  if (isArrival)   return `${base}, datum příjezdu`
  if (isDeparture) return `${base}, datum odjezdu`
  if (isValidDep)  return `${base}, plně obsazeno – lze zvolit jako odjezd`
  if (!occ) return base
  // Day-state descriptions
  if (occ.state === 'unreleased') return `${base}, datum zatím není k rezervaci uvolněno`
  if (occ.state === 'closed')     return `${base}, datum dočasně nedostupné`
  if (occ.free <= 0) return `${base}, plně obsazeno`
  if (occ.free === 1) return `${base}, poslední volné místo`
  if (occ.free <= occ.maxDogs / 2) return `${base}, zbývají ${occ.free} místa`
  return `${base}, volno, ${occ.free} míst`
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const occupancyCache: Record<string, OccupancyMap> = {}

async function fetchMonth(year: number, month: number): Promise<OccupancyMap> {
  const key = `${year}-${month}`
  if (occupancyCache[key]) return occupancyCache[key]
  const res = await fetch(`/api/availability/month?year=${year}&month=${month}`)
  if (!res.ok) return {}
  const json = await res.json() as { days?: DayOccupancy[] }
  const map: OccupancyMap = {}
  for (const d of json.days ?? []) map[d.date] = d
  occupancyCache[key] = map
  return map
}

// ─── Date field display ───────────────────────────────────────────────────────

interface DateFieldProps {
  label: string
  value: string
  placeholder: string
  active: boolean
  onClick: () => void
}

function DateField({ label, value, placeholder, active, onClick }: DateFieldProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-1 flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-green focus-visible:ring-offset-1',
        active
          ? 'border-verde-green bg-verde-deep/5 shadow-sm dark:bg-verde-deep/20'
          : 'border-border bg-card hover:border-verde-green/40 hover:bg-verde-ivory/30 dark:hover:bg-verde-charcoal/20',
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-verde-stone">
        {label}
      </span>
      {value ? (
        <span className="text-sm font-medium text-verde-deep">{formatDateLong(value)}</span>
      ) : (
        <span className="text-sm text-verde-stone/70">{placeholder}</span>
      )}
    </button>
  )
}

// ─── Single month grid ────────────────────────────────────────────────────────

interface MonthGridProps {
  year: number
  month: number
  today: string
  arrival: string
  departure: string
  hoverDate: string | null
  selectingDeparture: boolean
  occupancy: OccupancyMap
  blockingNight: string | null
  appearance: CalendarAppearance
  /** Optional CMS maximum stay length — dates exceeding it are disabled. */
  maximumStayNights: number | null
  onDayClick: (dateStr: string) => void
  onDayHover: (dateStr: string | null) => void
}

function MonthGrid({
  year, month, today,
  arrival, departure, hoverDate,
  selectingDeparture, occupancy, blockingNight,
  appearance,
  maximumStayNights,
  onDayClick, onDayHover,
}: MonthGridProps) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstWd     = dayOfWeek(toISO(year, month, 1))
  const rangeEnd    = departure || (selectingDeparture && hoverDate && hoverDate > arrival ? hoverDate : null)

  return (
    <div className="min-w-0 flex-1">
      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS_CS.map((d) => (
          <div key={d} className="py-0.5 text-center text-[10px] font-medium uppercase tracking-wider text-verde-stone">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {/* Leading blanks */}
        {Array.from({ length: firstWd }).map((_, i) => (
          <div key={`b-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateStr  = toISO(year, month, day)
          const occ      = occupancy[dateStr]
          const status   = getDayStatus(occ)
          const isPast   = dateStr < today
          const isToday  = dateStr === today
          const isArrival    = dateStr === arrival
          const isDeparture  = dateStr === departure
          const isFull       = status === 'full'

          // A fully-booked date is selectable as departure only
          const isValidDeparture =
            selectingDeparture && dateStr > arrival && isFull

          // Maximum stay: if a maximum is configured and we're selecting
          // departure, disable any date that would produce more nights than
          // the limit (departure - arrival, in days). The arrival date itself
          // is never affected.
          const exceedsMaxStay = Boolean(
            maximumStayNights !== null &&
            maximumStayNights >= 1 &&
            arrival &&
            dateStr > arrival &&
            nightsBetween(arrival, dateStr) > maximumStayNights
          )

          const isClosed     = status === 'closed'
          const isUnreleased = status === 'unreleased'
          const isDisabled   = isPast || (isFull && !isValidDeparture) || exceedsMaxStay || isClosed || isUnreleased

          const isHoverDep =
            selectingDeparture && hoverDate === dateStr && dateStr > arrival && !departure

          const isInRange = Boolean(
            arrival && rangeEnd && dateStr > arrival && dateStr < rangeEnd
          )

          const isRangeStart = isArrival && rangeEnd !== null && rangeEnd > arrival
          const isRangeEnd   = (isDeparture || isHoverDep) && arrival !== '' && rangeEnd !== null && rangeEnd > arrival

          const isBlocked = Boolean(blockingNight && isInRange && occ?.free <= 0)

          const ariaLabel = getDayAriaLabel(dateStr, occ, isValidDeparture, isArrival, isDeparture)

          // ── Determine cell colors ──
          // Priority: selected > range > status
          let cellBg: string
          let cellText: string
          let cellBorder: string

          if (isArrival || isDeparture || isHoverDep) {
            cellBg     = appearance.selectedBackground
            cellText   = appearance.selectedText
            cellBorder = 'transparent'
          } else if (isInRange) {
            cellBg     = isBlocked ? '#FADDDD' : appearance.rangeBackground
            cellText   = isBlocked ? '#991B1B' : appearance.availableText
            cellBorder = 'transparent'
          } else if (isPast) {
            cellBg     = 'transparent'
            cellText   = ''    // handled by Tailwind class
            cellBorder = 'transparent'
          } else {
            switch (status) {
              case 'full':
                cellBg     = appearance.fullBackground
                cellText   = appearance.fullText
                cellBorder = appearance.fullText + '33' // 20% alpha border
                break
              case 'scarce':
                cellBg     = appearance.lastBackground
                cellText   = appearance.lastText
                cellBorder = appearance.lastText + '33'
                break
              case 'partial':
                cellBg     = appearance.limitedBackground
                cellText   = appearance.limitedText
                cellBorder = appearance.limitedText + '33'
                break
              case 'free':
                cellBg     = appearance.availableBackground
                cellText   = appearance.availableText
                cellBorder = appearance.availableText + '22'
                break
              case 'closed':
                cellBg     = appearance.closedBackground
                cellText   = appearance.closedText
                cellBorder = appearance.closedText + '33'
                break
              case 'unreleased':
                cellBg     = appearance.unreleasedBackground
                cellText   = appearance.unreleasedText
                cellBorder = 'transparent'
                break
              default:
                // unknown — no data yet
                cellBg     = 'transparent'
                cellText   = ''
                cellBorder = 'transparent'
            }
          }

          // ── Non-color secondary indicator ──
          // Shown below the day number when the cell is not selected/range
          let indicator: string | null = null
          if (!isPast && !isArrival && !isDeparture && !isInRange && !isHoverDep) {
            if (status === 'full' || status === 'closed') {
              indicator = '×'
            } else if (status === 'scarce') {
              indicator = '1'
            } else if (status === 'partial' && occ) {
              indicator = String(occ.free)
            }
            // 'free', 'unreleased' have no secondary indicator
          }

          // Today's cell gets a colored outline ring
          const todayRing = isToday && !isArrival && !isDeparture

          return (
            <div
              key={dateStr}
              className={cn(
                'px-px',
                // Range strip — rounded at ends
                isInRange && 'px-0',
                isRangeStart && 'rounded-l-lg',
                isRangeEnd   && 'rounded-r-lg',
              )}
            >
              <button
                type="button"
                disabled={isDisabled}
                aria-label={ariaLabel}
                aria-pressed={isArrival || isDeparture || undefined}
                aria-disabled={isDisabled || undefined}
                onMouseEnter={() => !isPast && onDayHover(dateStr)}
                onMouseLeave={() => onDayHover(null)}
                onClick={() => onDayClick(dateStr)}
                style={
                  cellText
                    ? {
                        backgroundColor: cellBg,
                        color:           cellText,
                        borderColor:     todayRing ? appearance.todayBorder : cellBorder,
                      }
                    : undefined
                }
                className={cn(
                  // Base: compact rounded cell — 40×40px touch target, flex column
                  'relative mx-auto flex w-full flex-col items-center justify-center rounded-lg',
                  'min-h-[40px] min-w-[36px]',
                  'text-[12px] font-semibold leading-none transition-colors duration-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-green focus-visible:ring-offset-1',
                  // Border
                  'border',
                  todayRing ? 'border-2' : 'border',

                  // Past dates — no background color, just muted text
                  isPast && 'cursor-not-allowed border-transparent text-verde-stone/30 line-through',

                  // Unknown state (no occupancy data yet) — neutral
                  !isPast && status === 'unknown' && 'border-transparent bg-card/50 text-verde-stone/50',

                  // Full as valid departure — slightly desaturated, hoverable
                  isValidDeparture && !isDisabled && 'cursor-pointer hover:opacity-80',

                  // Disabled full (not valid departure) — reduced opacity + no pointer
                  isFull && isDisabled && 'cursor-not-allowed opacity-70',

                  // Hover states for selectable cells
                  !isPast && !isDisabled && !isArrival && !isDeparture && 'hover:opacity-90',
                )}
              >
                {/* Day number */}
                <span className="block leading-tight">{day}</span>

                {/* Non-color secondary indicator */}
                {indicator !== null && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'block text-[9px] font-bold leading-none',
                      indicator === '×' ? 'mt-px' : 'mt-0.5',
                    )}
                  >
                    {indicator}
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function CalendarLegend({ appearance }: { appearance: CalendarAppearance }) {
  const items = [
    {
      label: 'Volno',
      bg: appearance.availableBackground,
      text: appearance.availableText,
      indicator: null,
    },
    {
      label: 'Zbývají místa',
      bg: appearance.limitedBackground,
      text: appearance.limitedText,
      indicator: '2',
    },
    {
      label: 'Poslední místo',
      bg: appearance.lastBackground,
      text: appearance.lastText,
      indicator: '1',
    },
    {
      label: 'Plně obsazeno',
      bg: appearance.fullBackground,
      text: appearance.fullText,
      indicator: '×',
    },
    {
      label: 'Dočasně nedostupné',
      bg: appearance.closedBackground,
      text: appearance.closedText,
      indicator: null,
    },
    {
      label: 'Neuvolněno k rezervaci',
      bg: appearance.unreleasedBackground,
      text: appearance.unreleasedText,
      indicator: null,
    },
  ]

  return (
    <div
      role="list"
      aria-label="Legenda dostupnosti"
      className="grid grid-cols-2 gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-4 sm:gap-y-2"
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2" role="listitem">
          {/* Mini sample cell — 28×28px on mobile, slightly larger on sm+ */}
          <span
            aria-hidden="true"
            className="inline-flex size-7 shrink-0 flex-col items-center justify-center rounded-md border text-[9px] font-bold leading-none sm:size-8 sm:rounded-lg sm:text-[10px]"
            style={{
              backgroundColor: item.bg,
              color: item.text,
              borderColor: item.text + '33',
            }}
          >
            <span>24</span>
            {item.indicator && <span className="text-[7px] sm:text-[8px]">{item.indicator}</span>}
          </span>
          <span className="text-xs text-verde-stone">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AvailabilityCalendar({
  arrival,
  departure,
  onArrivalChange,
  onDepartureChange,
  onRangeChange,
  appearance: appearanceProp,
  maximumStayNights = null,
}: AvailabilityCalendarProps) {
  const appearance = appearanceProp ?? CALENDAR_APPEARANCE_DEFAULTS

  const today = todayISO()
  const todayYear  = parseInt(today.slice(0, 4))
  const todayMonth = parseInt(today.slice(5, 7))

  const initDate = arrival || today
  const [leftYear,  setLeftYear]  = useState(() => parseInt(initDate.slice(0, 4)))
  const [leftMonth, setLeftMonth] = useState(() => parseInt(initDate.slice(5, 7)))

  const right = addMonths(leftYear, leftMonth, 1)

  const [occupancy, setOccupancy] = useState<OccupancyMap>({})
  const [loading, setLoading]     = useState(false)

  const selectingDeparture = Boolean(arrival && !departure)

  const [activeField, setActiveField] = useState<'arrival' | 'departure'>(
    () => (arrival && !departure ? 'departure' : 'arrival')
  )

  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const isMounted = useRef(true)
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false } }, [])

  useEffect(() => {
    setLoading(true)
    const r = addMonths(leftYear, leftMonth, 1)
    Promise.all([
      fetchMonth(leftYear, leftMonth),
      fetchMonth(r.year, r.month),
    ]).then(([m1, m2]) => {
      if (!isMounted.current) return
      setOccupancy({ ...m1, ...m2 })
      setLoading(false)
    })
    const rr = addMonths(leftYear, leftMonth, 2)
    fetchMonth(rr.year, rr.month)
  }, [leftYear, leftMonth])

  useEffect(() => {
    if (!arrival) setActiveField('arrival')
    else if (!departure) setActiveField('departure')
  }, [arrival, departure])

  function prevMonth() {
    const prev = addMonths(leftYear, leftMonth, -1)
    setLeftYear(prev.year)
    setLeftMonth(prev.month)
  }
  function nextMonth() {
    const next = addMonths(leftYear, leftMonth, 1)
    setLeftYear(next.year)
    setLeftMonth(next.month)
  }
  const isPrevDisabled =
    leftYear < todayYear || (leftYear === todayYear && leftMonth <= todayMonth)

  const blockingNight = (arrival && departure && arrival < departure)
    ? findBlockingNight(arrival, departure, occupancy)
    : null

  const handleDayClick = useCallback((dateStr: string) => {
    if (dateStr < today) return
    const status  = getDayStatus(occupancy[dateStr])
    const isFull  = status === 'full'

    if (activeField === 'arrival' || (!arrival || (arrival && departure))) {
      if (isFull) return
      onArrivalChange(dateStr)
      onDepartureChange('')
      setActiveField('departure')
    } else {
      if (dateStr <= arrival) {
        if (!isFull) {
          onArrivalChange(dateStr)
          onDepartureChange('')
          setActiveField('departure')
        }
        return
      }
      const blocking = findBlockingNight(arrival, dateStr, occupancy)
      onDepartureChange(dateStr)
      if (blocking === null && onRangeChange) onRangeChange(arrival, dateStr)
      setActiveField('arrival')
    }
  }, [activeField, arrival, departure, occupancy, onArrivalChange, onDepartureChange, onRangeChange, today])

  function handleFieldClick(field: 'arrival' | 'departure') {
    setActiveField(field)
    if (field === 'arrival') {
      onArrivalChange('')
      onDepartureChange('')
    } else if (field === 'departure') {
      onDepartureChange('')
    }
  }

  const nights = arrival && departure ? nightsBetween(arrival, departure) : 0

  const sharedGridProps = {
    today,
    arrival,
    departure,
    hoverDate,
    selectingDeparture,
    occupancy,
    blockingNight,
    appearance,
    maximumStayNights,
    onDayClick: handleDayClick,
    onDayHover: setHoverDate,
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Date fields row ── */}
      <div className="flex gap-3">
        <DateField
          label="Datum příjezdu"
          value={arrival}
          placeholder="Vyberte příjezd"
          active={activeField === 'arrival'}
          onClick={() => handleFieldClick('arrival')}
        />
        <DateField
          label="Datum odjezdu"
          value={departure}
          placeholder="Vyberte odjezd"
          active={activeField === 'departure' && Boolean(arrival)}
          onClick={() => handleFieldClick('departure')}
        />
      </div>

      {/* ── Range / hint strip ── */}
      {/* Maximum-stay limit banner — shown below date fields when configured */}
      {maximumStayNights !== null && maximumStayNights >= 1 && (
        <p className="text-xs text-verde-stone px-0.5" aria-live="polite">
          Maximální délka pobytu je{' '}
          <span className="font-semibold text-verde-deep">{maximumStayNights} {pluralNoc(maximumStayNights)}</span>.
        </p>
      )}
      <div className="flex min-h-[28px] items-center justify-between gap-2 px-0.5">
        {blockingNight ? (
          <p className="text-xs font-medium text-destructive" role="alert">
            Zvolený pobyt není dostupný po celý termín.
          </p>
        ) : arrival && departure && !blockingNight && maximumStayNights !== null && nights > maximumStayNights ? (
          <p className="text-xs font-medium text-destructive" role="alert">
            Maximální délka pobytu je {maximumStayNights} {pluralNoc(maximumStayNights)}.
          </p>
        ) : arrival && departure && !blockingNight ? (
          <p className="flex items-center gap-1.5 text-xs text-verde-moss">
            <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
            {nights} {pluralNoc(nights)} · {formatDateShort(arrival)} – {formatDateShort(departure)}
          </p>
        ) : !arrival ? (
          <p className="text-xs text-verde-stone">Vyberte datum příjezdu.</p>
        ) : (
          <p className="text-xs text-verde-stone">Nyní vyberte datum odjezdu.</p>
        )}

        {loading && (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-verde-stone" aria-label="Načítám obsazenost" />
        )}
      </div>

      {/* ── Calendar panels ── */}
      <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
        {/* Shared navigation header */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            disabled={isPrevDisabled}
            aria-label="Předchozí měsíc"
            className={cn(
              'flex size-7 items-center justify-center rounded-lg border border-border text-verde-deep transition-colors',
              isPrevDisabled
                ? 'cursor-not-allowed opacity-30'
                : 'hover:bg-verde-ivory hover:border-verde-green/40 dark:hover:bg-verde-charcoal/40',
            )}
          >
            <ChevronLeft className="size-3.5" />
          </button>

          <div className="flex flex-1 justify-around px-2 text-sm font-semibold text-verde-deep">
            <span>{MONTH_NAMES_CS[leftMonth - 1]} {leftYear}</span>
            <span className="hidden sm:inline">{MONTH_NAMES_CS[right.month - 1]} {right.year}</span>
          </div>

          <button
            type="button"
            onClick={nextMonth}
            aria-label="Následující měsíc"
            className="flex size-7 items-center justify-center rounded-lg border border-border text-verde-deep transition-colors hover:bg-verde-ivory hover:border-verde-green/40 dark:hover:bg-verde-charcoal/40"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        {/* Two grids side by side (mobile: stacked) */}
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-4">
          <MonthGrid year={leftYear} month={leftMonth} {...sharedGridProps} />
          {/* Mobile: show right month label since header only shows left */}
          <div className="sm:hidden">
            <p className="mb-2 text-center text-sm font-semibold text-verde-deep">
              {MONTH_NAMES_CS[right.month - 1]} {right.year}
            </p>
          </div>
          <div className="hidden w-px self-stretch bg-border sm:block" aria-hidden="true" />
          <MonthGrid year={right.year} month={right.month} {...sharedGridProps} />
        </div>
      </div>

      {/* ── Legend ── */}
      <CalendarLegend appearance={appearance} />

    </div>
  )
}
