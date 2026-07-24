'use client'

import { AvailabilityCalendar } from '../availability-calendar'
import { StepIntro, StepNav } from '../step-nav'
import type { Estimate, ReservationDraft } from '@/lib/reservation'

interface Props {
  draft: ReservationDraft
  errors: Record<string, string>
  estimate: Estimate
  onChange: (patch: Partial<ReservationDraft>) => void
  onNext: () => void
}

export function StepTerm({ draft, errors, estimate, onChange, onNext }: Props) {
  return (
    <div>
      <StepIntro
        step="Krok 1 z 5"
        title="Kdy k nám váš pes zavítá?"
        description="Vyberte termín příjezdu a odjezdu. Ubytování počítáme podle počtu nocí."
      />

      {/* Error messages from validation */}
      {(errors.arrival || errors.departure) ? (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive" role="alert">
          {errors.arrival && <p>{errors.arrival}</p>}
          {errors.departure && <p>{errors.departure}</p>}
        </div>
      ) : null}

      {/* Hidden accessible inputs so the browser form validation and
          autofill still work; the calendar drives their values. */}
      <input
        id="arrival"
        type="date"
        name="arrival"
        value={draft.arrival}
        readOnly
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
      />
      <input
        id="departure"
        type="date"
        name="departure"
        value={draft.departure}
        readOnly
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
      />

      <AvailabilityCalendar
        arrival={draft.arrival}
        departure={draft.departure}
        onArrivalChange={(date) => onChange({ arrival: date })}
        onDepartureChange={(date) => onChange({ departure: date })}
        onRangeChange={(arrival, departure) => onChange({ arrival, departure })}
      />

      <StepNav onNext={onNext} />
    </div>
  )
}
