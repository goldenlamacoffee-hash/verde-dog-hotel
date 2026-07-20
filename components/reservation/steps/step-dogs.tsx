'use client'

import { Minus, Plus } from 'lucide-react'
import { Field, TextArea, TextInput } from '../fields'
import { StepIntro, StepNav } from '../step-nav'
import type { DogDraft, ReservationDraft } from '@/lib/reservation'

interface Props {
  draft: ReservationDraft
  errors: Record<string, string>
  onChange: (patch: Partial<ReservationDraft>) => void
  onDogCount: (count: number) => void
  onNext: () => void
  onBack: () => void
}

const MAX_DOGS = 4

export function StepDogs({
  draft,
  errors,
  onChange,
  onDogCount,
  onNext,
  onBack,
}: Props) {
  function updateDog(index: number, patch: Partial<DogDraft>) {
    const dogs = draft.dogs.map((dog, i) =>
      i === index ? { ...dog, ...patch } : dog,
    )
    onChange({ dogs })
  }

  return (
    <div>
      <StepIntro
        step="Krok 2 z 5"
        title="Řekněte nám o svém psovi"
        description="Čím více víme, tím lépe se o vašeho čtyřnohého kamaráda postaráme."
      />

      <div className="mb-8 flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-verde-deep">Počet psů</p>
          <p className="text-xs text-verde-moss">Ubytujeme až {MAX_DOGS} psy z jedné domácnosti.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Ubrat psa"
            disabled={draft.dogCount <= 1}
            onClick={() => onDogCount(Math.max(1, draft.dogCount - 1))}
            className="flex size-9 items-center justify-center rounded-full border border-border text-verde-deep transition-colors hover:bg-card disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <span className="w-6 text-center font-serif text-lg font-semibold text-verde-deep">
            {draft.dogCount}
          </span>
          <button
            type="button"
            aria-label="Přidat psa"
            disabled={draft.dogCount >= MAX_DOGS}
            onClick={() => onDogCount(Math.min(MAX_DOGS, draft.dogCount + 1))}
            className="flex size-9 items-center justify-center rounded-full border border-border text-verde-deep transition-colors hover:bg-card disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {draft.dogs.map((dog, i) => (
          <fieldset key={i} className="rounded-xl border border-border p-5 sm:p-6">
            <legend className="px-2 font-serif text-lg font-semibold text-verde-green">
              {draft.dogCount > 1 ? `${i + 1}. pes` : 'Váš pes'}
            </legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Jméno" htmlFor={`dog-${i}-name`} required error={errors[`dog-${i}-name`]}>
                <TextInput
                  id={`dog-${i}-name`}
                  value={dog.name}
                  invalid={Boolean(errors[`dog-${i}-name`])}
                  onChange={(e) => updateDog(i, { name: e.target.value })}
                  placeholder="Např. Ben"
                />
              </Field>
              <Field label="Plemeno" htmlFor={`dog-${i}-breed`}>
                <TextInput
                  id={`dog-${i}-breed`}
                  value={dog.breed}
                  onChange={(e) => updateDog(i, { breed: e.target.value })}
                  placeholder="Např. drátosrstý ohař"
                />
              </Field>
              <Field label="Věk / rok narození" htmlFor={`dog-${i}-age`}>
                <TextInput
                  id={`dog-${i}-age`}
                  value={dog.ageOrBirth}
                  onChange={(e) => updateDog(i, { ageOrBirth: e.target.value })}
                  placeholder="Např. 3 roky"
                />
              </Field>
              <Field label="Hmotnost (kg)" htmlFor={`dog-${i}-weight`}>
                <TextInput
                  id={`dog-${i}-weight`}
                  type="number"
                  min="1"
                  value={dog.weightKg}
                  onChange={(e) => updateDog(i, { weightKg: e.target.value })}
                  placeholder="Např. 28"
                />
              </Field>

              <Field label="Pohlaví" htmlFor={`dog-${i}-sex`} required error={errors[`dog-${i}-sex`]}>
                <div className="flex gap-2">
                  {[
                    { value: 'male', label: 'Pes' },
                    { value: 'female', label: 'Fena' },
                  ].map((option) => {
                    const active = dog.sex === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateDog(i, { sex: option.value as DogDraft['sex'] })}
                        className={
                          'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ' +
                          (active
                            ? 'border-verde-green bg-verde-green text-verde-white'
                            : 'border-border bg-card text-verde-moss hover:border-verde-green/50')
                        }
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </Field>
              <Field label="Kastrace" htmlFor={`dog-${i}-neutered`}>
                <label className="flex h-full items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-verde-charcoal">
                  <input
                    id={`dog-${i}-neutered`}
                    type="checkbox"
                    checked={dog.neutered}
                    onChange={(e) => updateDog(i, { neutered: e.target.checked })}
                    className="size-4 accent-verde-green"
                  />
                  Pes je kastrovaný / fena je kastrovaná
                </label>
              </Field>

              <Field label="Krmný režim" htmlFor={`dog-${i}-feeding`} className="sm:col-span-2">
                <TextInput
                  id={`dog-${i}-feeding`}
                  value={dog.feedingRegime}
                  onChange={(e) => updateDog(i, { feedingRegime: e.target.value })}
                  placeholder="Např. 2× denně granule, vlastní krmivo"
                />
              </Field>
              <Field
                label="Léky a zdravotní omezení"
                htmlFor={`dog-${i}-meds`}
                className="sm:col-span-2"
              >
                <TextInput
                  id={`dog-${i}-meds`}
                  value={dog.medications}
                  onChange={(e) => updateDog(i, { medications: e.target.value })}
                  placeholder="Např. žádné / alergie na kuřecí"
                />
              </Field>
              <Field
                label="Snášenlivost s ostatními psy"
                htmlFor={`dog-${i}-compat`}
                className="sm:col-span-2"
              >
                <TextInput
                  id={`dog-${i}-compat`}
                  value={dog.compatibility}
                  onChange={(e) => updateDog(i, { compatibility: e.target.value })}
                  placeholder="Např. přátelský, bez problémů"
                />
              </Field>
              <Field label="Poznámka" htmlFor={`dog-${i}-note`} className="sm:col-span-2">
                <TextArea
                  id={`dog-${i}-note`}
                  value={dog.note}
                  onChange={(e) => updateDog(i, { note: e.target.value })}
                  placeholder="Cokoli, co bychom měli vědet — návyky, oblíbené hračky, obavy…"
                />
              </Field>
            </div>
          </fieldset>
        ))}
      </div>

      <StepNav onNext={onNext} onBack={onBack} />
    </div>
  )
}
