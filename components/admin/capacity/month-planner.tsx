'use client'

/**
 * MonthPlanner — admin UI for controlling per-day availability.
 *
 * Workflow
 * ────────
 * ALL day-cell clicks are LOCAL ONLY — nothing is written to the database
 * until the admin explicitly saves.
 *
 * Published month:
 *   - Shows "Upravit zveřejněný měsíc" button
 *   - Clicking enters edit mode: copy published state to local draft
 *   - "Změny zatím nejsou veřejné." warning shown
 *   - "Zrušit úpravy" discards local changes (restores published state)
 *   - "Uložit a zveřejnit změny" calls publishAvailabilityMonthChanges (atomic)
 *
 * Draft month:
 *   - Always in edit mode
 *   - "Uložit koncept" calls saveAvailabilityMonthDraft (atomic, no public revalidation)
 *   - "Zveřejnit měsíc" calls publishAvailabilityMonthChanges (atomic, revalidates /rezervace)
 *
 * Closing a date with active bookings shows a confirmation dialog first.
 * The dialog shows how many dogs are already booked and explains that closing
 * only blocks NEW reservations — existing ones are preserved.
 */

import { useCallback, useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight,
  Globe, EyeOff,
  CheckSquare, XSquare,
  Loader2, AlertTriangle, CheckCircle2,
  CalendarCheck, Copy, Pencil, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  saveAvailabilityMonthDraft,
  publishAvailabilityMonthChanges,
  ensureMonthExists,
  getOccupancyForDate,
  copyPreviousMonthExact,
  copyPreviousMonthWeekdayPattern,
} from '@/lib/admin/availability-actions'
import type { MonthRecord, DayRecord } from '@/lib/availability-months'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthPlannerProps {
  monthStart:    string
  initialMonth:  MonthRecord | null
  initialDays:   DayRecord[]
  nextPublished: boolean
  occupancyMap?: Record<string, number>
  capacity?:     number
}

// Local editable day state — simpler than DayRecord
interface LocalDay {
  date:   string
  isOpen: boolean
}

// ─── Locale helpers ───────────────────────────────────────────────────────────

const MONTH_NAMES_CS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
]
const WEEKDAY_LABELS_CS      = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']
const WEEKDAY_LABELS_FULL_CS = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota']

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
  return new Date(iso + 'T12:00:00Z').getUTCDay()
}

function mondayFirst(utcDay: number): number {
  return (utcDay + 6) % 7
}

function currentMonthStart(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function dayRecordsToLocal(days: DayRecord[]): LocalDay[] {
  return days.map((d) => ({ date: d.date, isOpen: d.isOpen }))
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

// ─── Confirmation dialog ──────────────────────────────────────────────────────

interface ConfirmCloseDialogProps {
  date:     string
  booked:   number
  capacity: number
  onConfirm: () => void
  onCancel:  () => void
}

function ConfirmCloseDialog({ date, booked, capacity, onConfirm, onCancel }: ConfirmCloseDialogProps) {
  const d = new Date(date + 'T00:00:00Z')
  const label = `${d.getUTCDate()}. ${MONTH_NAMES_CS[d.getUTCMonth()].toLowerCase()}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Potvrdit uzavření dne ${label}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4"
        style={{ background: 'var(--admin-card-bg)', border: '1px solid var(--admin-card-border)' }}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--admin-text)' }}>
              Na {label} jsou již rezervováni {booked} {booked === 1 ? 'pes' : booked <= 4 ? 'psi' : 'psů'}.
            </p>
            <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
              Uzavřením data zablokujete pouze nové rezervace. Existující rezervace zůstanou zachovány.
            </p>
            <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
              Nová volná kapacita: <strong>0</strong> (z celkových {capacity})
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-text-muted)' }}
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80"
            style={{ background: '#dc2626' }}
          >
            Uzavřít pro nové rezervace
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MonthPlanner({
  monthStart,
  initialMonth,
  initialDays,
  nextPublished,
  occupancyMap = {},
  capacity     = 10,
}: MonthPlannerProps) {
  const router = useRouter()

  // Published state from server
  const [publishedDays] = useState<LocalDay[]>(dayRecordsToLocal(initialDays))
  const [month, setMonth] = useState<MonthRecord | null>(initialMonth)

  // Local edit state
  const [localDays, setLocalDays] = useState<LocalDay[]>(dayRecordsToLocal(initialDays))
  const [isEditing, setIsEditing] = useState(month?.status !== 'published')

  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [pending, startTransition] = useTransition()

  // Confirmation dialog state
  const [confirmDate, setConfirmDate] = useState<string | null>(null)
  const [confirmBooked, setConfirmBooked] = useState(0)

  const today        = currentMonthStart()
  const isPastMonth  = monthStart < today
  const isPublished  = month?.status === 'published'

  function clearFeedback() { setError(null); setSuccess(null) }

  function markDirty() { setIsDirty(true) }

  // Reset local state when monthStart changes (navigation)
  useEffect(() => {
    setLocalDays(dayRecordsToLocal(initialDays))
    setMonth(initialMonth)
    setIsEditing(initialMonth?.status !== 'published')
    setIsDirty(false)
    setError(null)
    setSuccess(null)
    setConfirmDate(null)
  }, [monthStart]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ──────────────────────────────────────────────────────────────

  function navigate(delta: number) {
    if (isDirty) {
      const ok = window.confirm('Máte neuložené změny. Opravdu chcete přejít na jiný měsíc?')
      if (!ok) return
    }
    const next = addCalMonths(monthStart, delta)
    router.push(`/admin/kapacita?month=${next.slice(0, 7)}`)
  }

  // ── Enter edit mode (published month) ───────────────────────────────────────

  function enterEditMode() {
    clearFeedback()
    setLocalDays(dayRecordsToLocal(initialDays))
    setIsDirty(false)
    setIsEditing(true)
  }

  // ── Cancel edits ────────────────────────────────────────────────────────────

  function cancelEdits() {
    clearFeedback()
    setLocalDays([...publishedDays])
    setIsDirty(false)
    if (isPublished) setIsEditing(false)
  }

  // ── Day toggle ───────────────────────────────────────────────────────────────
  // Always local-only. If closing a date with bookings → show confirmation.

  const toggleDay = useCallback((date: string, isOpen: boolean) => {
    if (!isOpen) {
      // Closing: check for existing bookings
      const booked = occupancyMap[date] ?? 0
      if (booked > 0) {
        setConfirmDate(date)
        setConfirmBooked(booked)
        return
      }
    }
    clearFeedback()
    setLocalDays((prev) => prev.map((d) => d.date === date ? { ...d, isOpen } : d))
    markDirty()
  }, [occupancyMap]) // eslint-disable-line react-hooks/exhaustive-deps

  function confirmClose() {
    if (!confirmDate) return
    setLocalDays((prev) => prev.map((d) => d.date === confirmDate ? { ...d, isOpen: false } : d))
    markDirty()
    setConfirmDate(null)
  }

  // ── Bulk actions (local only) ────────────────────────────────────────────────

  function handleBulkAll(isOpen: boolean) {
    clearFeedback()
    setLocalDays((prev) => prev.map((d) => ({ ...d, isOpen })))
    markDirty()
  }

  function handleWeekday(wd: number, isOpen: boolean) {
    clearFeedback()
    setLocalDays((prev) =>
      prev.map((d) => getUTCDayOfWeek(d.date) === wd ? { ...d, isOpen } : d)
    )
    markDirty()
  }

  // ── Copy previous month — exact day-to-day ──────────────────────────────────

  function handleCopyExact() {
    clearFeedback()
    startTransition(async () => {
      const res = await copyPreviousMonthExact(monthStart)
      if (!res.ok) {
        setError(res.error ?? 'Kopírování se nezdařilo.')
        return
      }
      const mapped = res.data!
      setLocalDays((prev) =>
        prev.map((d) => {
          const src = mapped.find((m) => m.date === d.date)
          return src ? { ...d, isOpen: src.is_open } : d
        })
      )
      setSuccess('Přesné kopírování dokončeno. Zkontrolujte dny a uložte.')
      markDirty()
    })
  }

  // ── Copy previous month — weekday pattern ───────────────────────────────────

  function handleCopyWeekday() {
    clearFeedback()
    startTransition(async () => {
      const res = await copyPreviousMonthWeekdayPattern(monthStart)
      if (!res.ok) {
        setError(res.error ?? 'Kopírování vzoru se nezdařilo.')
        return
      }
      const mapped = res.data!
      setLocalDays((prev) =>
        prev.map((d) => {
          const src = mapped.find((m) => m.date === d.date)
          return src ? { ...d, isOpen: src.is_open } : d
        })
      )
      setSuccess('Vzor pracovních dnů byl použit. Zkontrolujte dny a uložte.')
      markDirty()
    })
  }

  // ── Ensure month exists (for new months) ────────────────────────────────────

  async function ensureAndInit(): Promise<LocalDay[] | null> {
    if (localDays.length > 0) return localDays
    const res = await ensureMonthExists(monthStart)
    if (!res.ok) {
      setError(res.error ?? 'Nepodařilo se inicializovat měsíc.')
      return null
    }
    const days = dayRecordsToLocal(res.data!.days)
    setLocalDays(days)
    return days
  }

  // ── Save as draft (no public revalidation) ──────────────────────────────────

  function handleSaveDraft() {
    clearFeedback()
    startTransition(async () => {
      const days = await ensureAndInit()
      if (!days) return
      const payload = days.map((d) => ({ date: d.date, is_open: d.isOpen }))
      const res = await saveAvailabilityMonthDraft(monthStart, payload)
      if (!res.ok) {
        setError(res.error ?? 'Uložení se nezdařilo.')
      } else {
        setIsDirty(false)
        setSuccess('Koncept uložen. Zákazníci zatím nemohou měsíc rezervovat.')
      }
    })
  }

  // ── Save and publish atomically ──────────────────────────────────────────────

  function handlePublishChanges() {
    clearFeedback()
    startTransition(async () => {
      const days = await ensureAndInit()
      if (!days) return
      const payload = days.map((d) => ({ date: d.date, is_open: d.isOpen }))
      const res = await publishAvailabilityMonthChanges(monthStart, payload)
      if (!res.ok) {
        setError(res.error ?? 'Zveřejnění se nezdařilo.')
      } else {
        setIsDirty(false)
        setIsEditing(false)
        setMonth((prev) => prev
          ? { ...prev, status: 'published', publishedAt: new Date().toISOString() }
          : { monthStart, status: 'published', publishedAt: new Date().toISOString() }
        )
        setSuccess('Změny byly atomicky uloženy a zveřejněny. Zákazníci vidí aktuální dostupnost.')
      }
    })
  }

  // ── Calendar grid ────────────────────────────────────────────────────────────

  const d0     = new Date(monthStart + 'T00:00:00Z')
  const year   = d0.getUTCFullYear()
  const month0 = d0.getUTCMonth()
  const numDays  = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  const firstWd  = mondayFirst(getUTCDayOfWeek(monthStart))

  const dayMap = new Map<string, LocalDay>(localDays.map((d) => [d.date, d]))

  const nextMonth = addCalMonths(monthStart, 1)

  const weekdayOpen  = new Array(7).fill(0) as number[]
  const weekdayTotal = new Array(7).fill(0) as number[]
  for (const day of localDays) {
    const wd = getUTCDayOfWeek(day.date)
    weekdayTotal[wd]++
    if (day.isOpen) weekdayOpen[wd]++
  }

  const bookedOpenDays = localDays.filter((d) => {
    const booked = occupancyMap[d.date] ?? 0
    return d.isOpen && booked > 0
  })
  const overCapacityDays = localDays.filter((d) => {
    const booked = occupancyMap[d.date] ?? 0
    return d.isOpen && booked >= capacity
  })

  const mutationsDisabled = pending || isPastMonth || !isEditing

  return (
    <>
      {/* ── Confirmation dialog ─────────────────────────────────────────────── */}
      {confirmDate && (
        <ConfirmCloseDialog
          date={confirmDate}
          booked={confirmBooked}
          capacity={capacity}
          onConfirm={confirmClose}
          onCancel={() => setConfirmDate(null)}
        />
      )}

      <div className="space-y-4">

        {/* ── Reminder: next month not published ──────────────────────────── */}
        {!nextPublished && !isPastMonth && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl px-4 py-3"
            style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="text-sm">
              <span className="font-semibold">Připomínka:</span>{' '}
              Měsíc <span className="font-semibold">{monthLabel(nextMonth)}</span> ještě nebyl zveřejněn.{' '}
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

        {/* ── Editing published month: changes-pending banner ─────────────── */}
        {isPublished && isEditing && !isPastMonth && (
          <div
            className="flex items-start gap-2.5 rounded-xl px-4 py-3"
            style={{ background: '#fefce8', border: '1px solid #fde047', color: '#713f12' }}
          >
            <Pencil className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="text-sm font-semibold">
              Změny zatím nejsou veřejné.{' '}
              <span className="font-normal">Uložte a zveřejněte je, nebo zrušte úpravy.</span>
            </p>
          </div>
        )}

        {/* ── Published, NOT editing: lock notice ─────────────────────────── */}
        {isPublished && !isEditing && !isPastMonth && (
          <div
            className="flex items-start gap-2.5 rounded-xl px-4 py-3"
            style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}
          >
            <Globe className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="text-sm">
              <span className="font-semibold">Měsíc je zveřejněn.</span>{' '}
              Zákazníci vidí aktuální dostupnost. Kliknutím na{' '}
              <span className="font-semibold">Upravit</span> zahájíte úpravy — změny jsou veřejné
              teprve po kliknutí na <span className="font-semibold">Uložit a zveřejnit</span>.
            </p>
          </div>
        )}

        {/* ── Occupancy warnings ──────────────────────────────────────────── */}
        {bookedOpenDays.length > 0 && (
          <div
            className="rounded-xl px-4 py-3 space-y-1"
            style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}
            role="alert"
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              Upozornění na obsazenost
            </p>
            {overCapacityDays.length > 0 && (
              <p className="text-xs">
                <span className="font-semibold">Plně obsazeno:</span>{' '}
                {overCapacityDays.map((d) => {
                  const dt = new Date(d.date + 'T00:00:00Z')
                  return `${dt.getUTCDate()}.${dt.getUTCMonth() + 1}.`
                }).join(', ')}{' '}
                — nelze přidat nové rezervace.
              </p>
            )}
            {bookedOpenDays.filter((d) => (occupancyMap[d.date] ?? 0) < capacity).length > 0 && (
              <p className="text-xs">
                <span className="font-semibold">Částečně obsazeno:</span>{' '}
                {bookedOpenDays
                  .filter((d) => (occupancyMap[d.date] ?? 0) < capacity)
                  .map((d) => {
                    const dt     = new Date(d.date + 'T00:00:00Z')
                    const booked = occupancyMap[d.date] ?? 0
                    return `${dt.getUTCDate()}.${dt.getUTCMonth() + 1}. (${booked}/${capacity})`
                  })
                  .join(', ')}
              </p>
            )}
            <p className="text-xs italic" style={{ color: '#b45309' }}>
              Uzavření dne s existujícími rezervacemi neruší tyto rezervace — zákazníci zůstávají.
            </p>
          </div>
        )}

        {/* ── Month header ────────────────────────────────────────────────── */}
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

          {/* Status + action buttons */}
          <div className="flex flex-wrap items-center gap-2">
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

            {!isPastMonth && (
              <>
                {/* Published, not editing → "Upravit zveřejněný měsíc" */}
                {isPublished && !isEditing && (
                  <button
                    type="button"
                    onClick={enterEditMode}
                    disabled={pending}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
                    style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-text)' }}
                  >
                    <Pencil className="size-3" aria-hidden="true" />
                    Upravit zveřejněný měsíc
                  </button>
                )}

                {/* Editing published → "Zrušit úpravy" + "Uložit a zveřejnit změny" */}
                {isPublished && isEditing && (
                  <>
                    <button
                      type="button"
                      onClick={cancelEdits}
                      disabled={pending}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
                      style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-text-muted)' }}
                    >
                      <X className="size-3" aria-hidden="true" />
                      Zrušit úpravy
                    </button>
                    <button
                      type="button"
                      onClick={handlePublishChanges}
                      disabled={pending || !isDirty}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                      style={{ background: 'var(--admin-accent)' }}
                    >
                      {pending
                        ? <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                        : <Globe className="size-3" aria-hidden="true" />
                      }
                      Uložit a zveřejnit změny
                    </button>
                  </>
                )}

                {/* Draft → "Uložit koncept" + "Zveřejnit měsíc" */}
                {!isPublished && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={pending || !isDirty}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
                      style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-text)' }}
                    >
                      {pending
                        ? <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                        : <CheckCircle2 className="size-3" aria-hidden="true" />
                      }
                      Uložit koncept
                    </button>
                    <button
                      type="button"
                      onClick={handlePublishChanges}
                      disabled={pending}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                      style={{ background: 'var(--admin-accent)' }}
                    >
                      {pending
                        ? <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                        : <Globe className="size-3" aria-hidden="true" />
                      }
                      Zveřejnit měsíc
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Feedback ────────────────────────────────────────────────────── */}
        <Feedback error={error} success={success} />

        {/* ── Bulk / copy actions ──────────────────────────────────────────── */}
        {!isPastMonth && isEditing && (
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

            {/* Exact day-to-day copy */}
            <button
              type="button"
              onClick={handleCopyExact}
              disabled={pending}
              title="Zkopíruje dny 1:1 z předchozího měsíce (1. → 1., 2. → 2., …)"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-text-muted)', background: 'var(--admin-bg)' }}
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              Kopírovat předchozí měsíc
            </button>

            {/* Weekday pattern copy (separate, explicit) */}
            <button
              type="button"
              onClick={handleCopyWeekday}
              disabled={pending}
              title="Zkopíruje vzor pracovních dnů z předchozího měsíce (Po=otevřeno → každé Po otevřeno, …)"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-text-muted)', background: 'var(--admin-bg)' }}
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <CalendarCheck className="size-3.5" aria-hidden="true" />}
              Kopírovat režim pracovních dnů
            </button>

            <span className="hidden text-xs sm:block" style={{ color: 'var(--admin-card-border)' }}>|</span>

            {/* Per-weekday toggles */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>Každý:</span>
              {([1, 2, 3, 4, 5, 6, 0] as const).map((wd) => {
                const label = WEEKDAY_LABELS_CS[wd]
                const open  = weekdayOpen[wd]
                const total = weekdayTotal[wd]
                return (
                  <WeekdayButton
                    key={wd}
                    label={label}
                    open={open}
                    total={total}
                    allOpen={open === total}
                    allClosed={open === 0}
                    disabled={pending}
                    onOpen={() => handleWeekday(wd, true)}
                    onClose={() => handleWeekday(wd, false)}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* ── Calendar grid ────────────────────────────────────────────────── */}
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
            {Array.from({ length: firstWd }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}

            {Array.from({ length: numDays }, (_, i) => {
              const dayNum = i + 1
              const iso    = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
              const rec    = dayMap.get(iso)
              const isOpen = rec?.isOpen ?? false
              const wd     = getUTCDayOfWeek(iso)
              const booked = occupancyMap[iso] ?? 0
              const isToday = iso === new Date().toISOString().split('T')[0]

              return (
                <DayCell
                  key={iso}
                  day={dayNum}
                  iso={iso}
                  isOpen={isOpen}
                  isPastMonth={isPastMonth}
                  isEditing={isEditing}
                  isWeekend={wd === 0 || wd === 6}
                  isToday={isToday}
                  booked={booked}
                  capacity={capacity}
                  disabled={pending || isPastMonth || !isEditing}
                  onToggle={() => toggleDay(iso, !isOpen)}
                />
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-4 border-t pt-3" style={{ borderColor: 'var(--admin-card-border)' }}>
            <LegendItem color="#dcfce7" border="#86efac" label="Otevřeno" />
            <LegendItem color="#fee2e2" border="#fca5a5" label="Uzavřeno" />
            <LegendItem color="#fef9c3" border="#fde047" label="Obsazeno (existují rezervace)" />
            <LegendItem color="#fee2e2" border="#dc2626" thick label="Plně obsazeno" />
          </div>
        </div>

        {/* ── No days note ─────────────────────────────────────────────────── */}
        {localDays.length === 0 && !isPastMonth && (
          <div
            className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
            style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text-muted)' }}
          >
            <CalendarCheck className="size-4 shrink-0" aria-hidden="true" />
            Tento měsíc ještě nebyl inicializován. Kliknutím na „Zveřejnit měsíc" se dny vytvoří automaticky.
          </div>
        )}
      </div>
    </>
  )
}

// ─── Legend item ──────────────────────────────────────────────────────────────

function LegendItem({ color, border, label, thick = false }: { color: string; border: string; label: string; thick?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block size-3.5 rounded-sm"
        style={{ background: color, border: `${thick ? 2 : 1}px solid ${border}` }}
        aria-hidden="true"
      />
      <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>{label}</span>
    </div>
  )
}

// ─── DayCell ──────────────────────────────────────────────────────────────────

interface DayCellProps {
  day:         number
  iso:         string
  isOpen:      boolean
  isPastMonth: boolean
  isEditing:   boolean
  isWeekend:   boolean
  isToday:     boolean
  booked:      number
  capacity:    number
  disabled:    boolean
  onToggle:    () => void
}

function DayCell({
  day, iso, isOpen, isPastMonth, isEditing, isWeekend, isToday,
  booked, capacity, disabled, onToggle,
}: DayCellProps) {
  const isBookedOpen   = isOpen && booked > 0
  const isFullCapacity = isOpen && booked >= capacity

  const label = !isEditing
    ? `${iso} — kliknutím na Upravit zahájíte úpravy`
    : isOpen
      ? `${iso}, otevřeno – kliknutím zavřít`
      : `${iso}, zavřeno – kliknutím otevřít`

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
        disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-80',
        isToday && 'ring-2 ring-offset-1',
      )}
      style={
        isPastMonth
          ? {
              background:   'transparent',
              borderColor:  'var(--admin-card-border)',
              color:        'var(--admin-text-muted)',
              opacity:      0.4,
            }
          : isFullCapacity
            ? {
                background:   '#fee2e2',
                borderColor:  '#dc2626',
                borderWidth:  '2px',
                color:        '#991b1b',
              }
            : isBookedOpen
              ? {
                  background:  '#fef9c3',
                  borderColor: '#fde047',
                  color:       '#713f12',
                }
              : isOpen
                ? {
                    background:  '#dcfce7',
                    borderColor: '#86efac',
                    color:       '#166534',
                    ...(isToday ? { outlineColor: '#16a34a' } : {}),
                  }
                : {
                    background:  '#fee2e2',
                    borderColor: '#fca5a5',
                    color:       '#991b1b',
                  }
      }
    >
      <span>{day}</span>
      {isBookedOpen && (
        <span className="text-[8px] font-normal leading-none" aria-hidden="true">
          {booked}/{capacity}
        </span>
      )}
      {isFullCapacity && !isOpen && (
        <span className="text-[8px] font-normal leading-none" aria-hidden="true">
          {booked} psů
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
