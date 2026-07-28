'use client'

/**
 * MonthPlanner — admin UI for controlling per-day availability.
 *
 * Receives initial data from the parent RSC (kapacita page) for the currently
 * viewed month. Month navigation reloads the page via router.push so the RSC
 * can re-fetch fresh data.
 *
 * Mutations call server actions directly; optimistic local state keeps the UI
 * snappy while the server persists the change.
 */

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight,
  Globe, EyeOff,
  CheckSquare, XSquare,
  Loader2, AlertTriangle, CheckCircle2,
  CalendarCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  publishMonth,
  unpublishMonth,
  setDayOpen,
  setAllDaysInMonth,
  setWeekdayDays,
} from '@/lib/admin/availability-actions'
import type { MonthRecord, DayRecord } from '@/lib/availability-months'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthPlannerProps {
  /** Currently displayed month — 'YYYY-MM-01' */
  monthStart:    string
  initialMonth:  MonthRecord | null
  initialDays:   DayRecord[]
  /** Whether the NEXT calendar month is already published */
  nextPublished: boolean
}

// ─── Date/locale helpers ──────────────────────────────────────────────────────

const MONTH_NAMES_CS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
]
const WEEKDAY_LABELS_CS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']
const WEEKDAY_LABELS_FULL_CS = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota']

function toMonthStartStr(monthStart: string): string {
  return monthStart.slice(0, 7) + '-01'
}

function addCalMonths(monthStart: string, delta: number): string {
  const d = new Date(monthStart + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + delta)
  return d.toISOString().split('T')[0].slice(0, 7) + '-01'
}

function monthLabel(monthStart: string): string {
  const d = new Date(monthStart + 'T00:00:00Z')
  return `${MONTH_NAMES_CS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function getUTCDayOfWeek(iso: string): number {
  return new Date(iso + 'T12:00:00Z').getUTCDay() // 0=Sun
}

// Monday-first: 0=Mon … 6=Sun
function mondayFirst(utcDay: number): number {
  return (utcDay + 6) % 7
}

function currentMonthStart(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function nextMonthStartStr(ms: string): string {
  return addCalMonths(ms, 1)
}

// ─── Feedback strip ───────────────────────────────────────────────────────────

function Feedback({ error, success }: { error: string | null; success: string | null }) {
  if (!error && !success) return null
  if (error) return (
    <p
      role="alert"
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
      style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
    >
      <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
      {error}
    </p>
  )
  return (
    <p
      role="status"
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
      style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}
    >
      <CheckCircle2 className="size-3 shrink-0" aria-hidden="true" />
      {success}
    </p>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MonthPlanner({
  monthStart,
  initialMonth,
  initialDays,
  nextPublished,
}: MonthPlannerProps) {
  const router = useRouter()

  // Local optimistic state for days
  const [days, setDays] = useState<DayRecord[]>(initialDays)
  const [month, setMonth] = useState<MonthRecord | null>(initialMonth)

  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const today = currentMonthStart()
  const isPastMonth = monthStart < today

  function clearFeedback() { setError(null); setSuccess(null) }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function navigate(delta: number) {
    const next = addCalMonths(monthStart, delta)
    router.push(`/admin/kapacita?month=${next.slice(0, 7)}`)
  }

  // ── Optimistic day toggle ───────────────────────────────────────────────────

  const toggleDay = useCallback((date: string, isOpen: boolean) => {
    clearFeedback()
    // Optimistic update
    setDays((prev) =>
      prev.map((d) => d.date === date ? { ...d, isOpen } : d)
    )
    startTransition(async () => {
      const res = await setDayOpen(date, isOpen)
      if (!res.ok) {
        // Revert on failure
        setDays((prev) =>
          prev.map((d) => d.date === date ? { ...d, isOpen: !isOpen } : d)
        )
        setError(res.error ?? 'Chyba při ukládání dne.')
      }
    })
  }, [])

  // ── Bulk actions ────────────────────────────────────────────────────────────

  function handleBulkAll(isOpen: boolean) {
    clearFeedback()
    setDays((prev) => prev.map((d) => ({ ...d, isOpen })))
    startTransition(async () => {
      const res = await setAllDaysInMonth(monthStart, isOpen)
      if (!res.ok) {
        router.refresh()
        setError(res.error ?? 'Hromadná akce se nezdařila.')
      } else {
        setSuccess(isOpen ? 'Všechny dny otevřeny.' : 'Všechny dny zavřeny.')
      }
    })
  }

  function handleWeekday(wd: 0 | 1 | 2 | 3 | 4 | 5 | 6, isOpen: boolean) {
    clearFeedback()
    setDays((prev) =>
      prev.map((d) =>
        getUTCDayOfWeek(d.date) === wd ? { ...d, isOpen } : d
      )
    )
    startTransition(async () => {
      const res = await setWeekdayDays(monthStart, wd, isOpen)
      if (!res.ok) {
        router.refresh()
        setError(res.error ?? 'Akce pro den v týdnu se nezdařila.')
      } else {
        setSuccess(`${WEEKDAY_LABELS_FULL_CS[wd]}: hotovo.`)
      }
    })
  }

  // ── Publish / Unpublish ────────────────────────────────────────────────────

  function handlePublish() {
    clearFeedback()
    startTransition(async () => {
      const res = await publishMonth(monthStart)
      if (!res.ok) {
        setError(res.error ?? 'Nepodařilo se zveřejnit měsíc.')
      } else {
        setMonth((prev) => prev
          ? { ...prev, status: 'published', publishedAt: new Date().toISOString() }
          : { monthStart, status: 'published', publishedAt: new Date().toISOString() }
        )
        setSuccess('Měsíc byl zveřejněn. Zákazníci nyní vidí dostupnost.')
      }
    })
  }

  function handleUnpublish() {
    clearFeedback()
    startTransition(async () => {
      const res = await unpublishMonth(monthStart)
      if (!res.ok) {
        setError(res.error ?? 'Nepodařilo se stáhnout měsíc.')
      } else {
        setMonth((prev) => prev
          ? { ...prev, status: 'draft' }
          : { monthStart, status: 'draft', publishedAt: null }
        )
        setSuccess('Měsíc byl stažen. Zákazníci ho nyní nevidí.')
      }
    })
  }

  // ── Calendar grid build ────────────────────────────────────────────────────

  const d0    = new Date(monthStart + 'T00:00:00Z')
  const year  = d0.getUTCFullYear()
  const month0 = d0.getUTCMonth()
  const numDays = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  const firstWd = mondayFirst(getUTCDayOfWeek(monthStart)) // 0=Mon offset

  const dayMap = new Map<string, DayRecord>(days.map((d) => [d.date, d]))

  const isPublished = month?.status === 'published'
  const nextMonth   = nextMonthStartStr(monthStart)

  // ── Weekday stats — count open days per weekday ─────────────────────────────
  const weekdayOpen  = new Array(7).fill(0) as number[]
  const weekdayTotal = new Array(7).fill(0) as number[]
  for (const day of days) {
    const wd = getUTCDayOfWeek(day.date) // 0=Sun
    weekdayTotal[wd]++
    if (day.isOpen) weekdayOpen[wd]++
  }

  return (
    <div className="space-y-4">

      {/* ── Reminder: next month not published ─────────────────────────────── */}
      {!nextPublished && !isPastMonth && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl px-4 py-3"
          style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="text-sm">
            <span className="font-semibold">Připomínka:</span>{' '}
            Měsíc <span className="font-semibold">{monthLabel(nextMonth)}</span> ještě nebyl
            zveřejněn. Zákazníci ho zatím nemohou rezervovat.{' '}
            <button
              type="button"
              onClick={() => router.push(`/admin/kapacita?month=${nextMonth.slice(0, 7)}`)}
              className="underline underline-offset-2 hover:opacity-70"
            >
              Přejít na {monthLabel(nextMonth)}
            </button>
          </div>
        </div>
      )}

      {/* ── Month header ───────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
        style={{ background: 'var(--admin-card-bg)', border: '1px solid var(--admin-card-border)' }}
      >
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={pending}
            aria-label="Předchozí měsíc"
            className="flex size-8 items-center justify-center rounded-lg border transition-colors hover:opacity-70 disabled:opacity-40"
            style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-text)' }}
          >
            <ChevronLeft className="size-4" />
          </button>

          <span className="min-w-[160px] text-center text-base font-semibold" style={{ color: 'var(--admin-text)' }}>
            {monthLabel(monthStart)}
          </span>

          <button
            type="button"
            onClick={() => navigate(1)}
            disabled={pending}
            aria-label="Následující měsíc"
            className="flex size-8 items-center justify-center rounded-lg border transition-colors hover:opacity-70 disabled:opacity-40"
            style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-text)' }}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Status badge + action */}
        <div className="flex items-center gap-3">
          {/* Status pill */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={isPublished
              ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
              : { background: 'var(--admin-bg)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-card-border)' }
            }
          >
            {isPublished
              ? <><Globe className="size-3" aria-hidden="true" /> Zveřejněno</>
              : <><EyeOff className="size-3" aria-hidden="true" /> Koncept</>
            }
          </span>

          {/* Publish / Unpublish */}
          {!isPastMonth && (
            isPublished ? (
              <button
                type="button"
                onClick={handleUnpublish}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-text-muted)' }}
              >
                {pending ? <Loader2 className="size-3 animate-spin" /> : <EyeOff className="size-3" />}
                Stáhnout
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePublish}
                disabled={pending || days.length === 0}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--admin-accent)' }}
              >
                {pending ? <Loader2 className="size-3 animate-spin" /> : <Globe className="size-3" />}
                Zveřejnit
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Feedback ───────────────────────────────────────────────────────── */}
      <Feedback error={error} success={success} />

      {/* ── Bulk actions ───────────────────────────────────────────────────── */}
      {!isPastMonth && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: 'var(--admin-card-bg)', border: '1px solid var(--admin-card-border)' }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>
            Hromadně:
          </span>

          <button
            type="button"
            onClick={() => handleBulkAll(true)}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ borderColor: '#bbf7d0', color: '#16a34a', background: '#f0fdf4' }}
          >
            <CheckSquare className="size-3.5" aria-hidden="true" />
            Otevřít vše
          </button>

          <button
            type="button"
            onClick={() => handleBulkAll(false)}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ borderColor: '#fecaca', color: '#dc2626', background: '#fef2f2' }}
          >
            <XSquare className="size-3.5" aria-hidden="true" />
            Zavřít vše
          </button>

          <span className="hidden text-xs sm:block" style={{ color: 'var(--admin-card-border)' }}>|</span>

          {/* Weekday buttons — hover shows open/close choice via split button */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>Každý:</span>
            {/* Mon=1 … Sun=0 in getUTCDay, but we want Mon…Sun order */}
            {([1,2,3,4,5,6,0] as const).map((wd) => {
              const label = WEEKDAY_LABELS_CS[wd]
              const open  = weekdayOpen[wd]
              const total = weekdayTotal[wd]
              const allOpen   = open === total
              const allClosed = open === 0
              return (
                <WeekdayButton
                  key={wd}
                  label={label}
                  open={open}
                  total={total}
                  allOpen={allOpen}
                  allClosed={allClosed}
                  disabled={pending}
                  onOpen={() => handleWeekday(wd, true)}
                  onClose={() => handleWeekday(wd, false)}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* ── Calendar grid ──────────────────────────────────────────────────── */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--admin-card-bg)', border: '1px solid var(--admin-card-border)' }}
      >
        {/* Weekday headers (Mon-first) */}
        <div className="mb-2 grid grid-cols-7">
          {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map((d) => (
            <div
              key={d}
              className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--admin-text-muted)' }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Leading blanks */}
          {Array.from({ length: firstWd }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}

          {Array.from({ length: numDays }, (_, i) => {
            const dayNum = i + 1
            const iso    = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
            const rec    = dayMap.get(iso)
            const isOpen = rec?.isOpen ?? false
            const wd     = getUTCDayOfWeek(iso) // 0=Sun

            const isWeekend = wd === 0 || wd === 6
            const isTodayDate = iso === new Date().toISOString().split('T')[0]

            return (
              <DayCell
                key={iso}
                day={dayNum}
                iso={iso}
                isOpen={isOpen}
                isPastMonth={isPastMonth}
                isWeekend={isWeekend}
                isToday={isTodayDate}
                disabled={pending || isPastMonth}
                onToggle={() => toggleDay(iso, !isOpen)}
              />
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-4 border-t pt-3" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-3.5 rounded-sm" style={{ background: '#dcfce7', border: '1px solid #86efac' }} aria-hidden="true" />
            <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>Otevřeno</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-3.5 rounded-sm" style={{ background: '#fee2e2', border: '1px solid #fca5a5' }} aria-hidden="true" />
            <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>Uzavřeno</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-3.5 rounded-sm" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)' }} aria-hidden="true" />
            <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>Víkend (kliknutím přepnout)</span>
          </div>
        </div>
      </div>

      {/* ── No days note (month not initialised) ────────────────────────────── */}
      {days.length === 0 && !isPastMonth && (
        <div
          className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text-muted)' }}
        >
          <CalendarCheck className="size-4 shrink-0" aria-hidden="true" />
          Tento měsíc ještě nebyl inicializován. Klikněte na „Zveřejnit" a dny se vytvoří automaticky.
        </div>
      )}
    </div>
  )
}

// ─── DayCell ─────────────────────────────────────────────────────────────────

interface DayCellProps {
  day:         number
  iso:         string
  isOpen:      boolean
  isPastMonth: boolean
  isWeekend:   boolean
  isToday:     boolean
  disabled:    boolean
  onToggle:    () => void
}

function DayCell({
  day, iso, isOpen, isPastMonth, isWeekend, isToday, disabled, onToggle,
}: DayCellProps) {
  const label = isOpen ? `${iso}, otevřeno – kliknutím zavřít` : `${iso}, zavřeno – kliknutím otevřít`

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isOpen}
      className={cn(
        'relative flex aspect-square w-full flex-col items-center justify-center rounded-lg border text-[11px] font-semibold transition-colors duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:opacity-80',
        isToday && 'ring-2 ring-offset-1',
      )}
      style={
        isPastMonth
          ? {
              background: 'transparent',
              borderColor: 'var(--admin-card-border)',
              color: 'var(--admin-text-muted)',
              opacity: 0.4,
            }
          : isOpen
            ? {
                background: '#dcfce7',
                borderColor: '#86efac',
                color: '#166534',
                ...(isToday ? { outlineColor: '#16a34a' } : {}),
              }
            : {
                background: '#fee2e2',
                borderColor: '#fca5a5',
                color: '#991b1b',
              }
      }
    >
      <span>{day}</span>
      {isWeekend && !isPastMonth && (
        <span
          className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-normal leading-none opacity-60"
          aria-hidden="true"
        >
          {/* subtle "W" weekend marker */}
        </span>
      )}
    </button>
  )
}

// ─── WeekdayButton ────────────────────────────────────────────────────────────

interface WeekdayButtonProps {
  label:     string
  open:      number
  total:     number
  allOpen:   boolean
  allClosed: boolean
  disabled:  boolean
  onOpen:    () => void
  onClose:   () => void
}

function WeekdayButton({
  label, open, total, allOpen, allClosed, disabled, onOpen, onClose,
}: WeekdayButtonProps) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border" style={{ borderColor: 'var(--admin-card-border)' }}>
      <button
        type="button"
        disabled={disabled || allOpen}
        onClick={onOpen}
        aria-label={`Otevřít všechny ${label}`}
        title={`Otevřít všechny ${label}`}
        className="px-2 py-1 text-xs transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ color: '#16a34a', borderRight: '1px solid var(--admin-card-border)' }}
      >
        {label}
        <span className="ml-0.5 text-[9px] opacity-60">
          {open}/{total}
        </span>
      </button>
      <button
        type="button"
        disabled={disabled || allClosed}
        onClick={onClose}
        aria-label={`Zavřít všechny ${label}`}
        title={`Zavřít všechny ${label}`}
        className="px-1.5 py-1 text-xs transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ color: '#dc2626' }}
      >
        ×
      </button>
    </div>
  )
}
