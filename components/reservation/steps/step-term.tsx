'use client'

import { CalendarDays } from 'lucide-react'
import { Field, TextInput } from '../fields'
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
  const today = new Date().toISOString().split('T')[0]
  return (
    <div>
      <StepIntro
        step="Krok 1 z 5"
        title="Kdy k nám váš pes zavítá?"
        description="Vyberte termín příjezdu a odjezdu. Ubytování počítáme podle počtu nocí."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Datum příjezdu" htmlFor="arrival" required error={errors.arrival}>
          <TextInput
            id="arrival"
            type="date"
            min={today}
            value={draft.arrival}
            invalid={Boolean(errors.arrival)}
            onChange={(e) => onChange({ arrival: e.target.value })}
          />
        </Field>
        <Field label="Datum odjezdu" htmlFor="departure" required error={errors.departure}>
          <TextInput
            id="departure"
            type="date"
            min={draft.arrival || today}
            value={draft.departure}
            invalid={Boolean(errors.departure)}
            onChange={(e) => onChange({ departure: e.target.value })}
          />
        </Field>
      </div>

      {estimate.nights > 0 ? (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-verde-green/20 bg-secondary/60 px-4 py-3 text-sm text-verde-deep">
          <CalendarDays className="size-5 text-verde-green" aria-hidden="true" />
          <span>
            Pobyt na <strong className="font-semibold">{estimate.nights}</strong>{' '}
            {estimate.nights === 1 ? 'noc' : estimate.nights < 5 ? 'noci' : 'nocí'}.
          </span>
        </div>
      ) : null}

      <StepNav onNext={onNext} />
    </div>
  )
}
