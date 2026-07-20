'use client'

import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  RESERVATION_STEPS,
  calculateEstimate,
  createEmptyDraft,
  emptyDog,
  type ReservationDraft,
} from '@/lib/reservation'
import { StepTerm } from './steps/step-term'
import { StepDogs } from './steps/step-dogs'
import { StepServices } from './steps/step-services'
import { StepOwner } from './steps/step-owner'
import { StepSummary } from './steps/step-summary'
import { StepDone } from './steps/step-done'
import { EstimatePanel } from './estimate-panel'

type Errors = Record<string, string>

export function ReservationFlow() {
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState<ReservationDraft>(createEmptyDraft)
  const [errors, setErrors] = useState<Errors>({})

  const estimate = useMemo(() => calculateEstimate(draft), [draft])
  const activeStep = RESERVATION_STEPS[stepIndex]
  const isDone = activeStep.id === 'done'

  function update(patch: Partial<ReservationDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  function setDogCount(count: number) {
    setDraft((prev) => {
      const dogs = [...prev.dogs]
      if (count > dogs.length) {
        while (dogs.length < count) dogs.push(emptyDog())
      } else {
        dogs.length = count
      }
      return { ...prev, dogCount: count, dogs }
    })
  }

  function validateStep(): boolean {
    const e: Errors = {}
    if (activeStep.id === 'term') {
      if (!draft.arrival) e.arrival = 'Vyberte datum příjezdu.'
      if (!draft.departure) e.departure = 'Vyberte datum odjezdu.'
      if (draft.arrival && draft.departure && estimate.nights <= 0) {
        e.departure = 'Odjezd musí být po příjezdu.'
      }
    }
    if (activeStep.id === 'dogs') {
      draft.dogs.forEach((dog, i) => {
        if (!dog.name.trim()) e[`dog-${i}-name`] = 'Zadejte jméno psa.'
        if (!dog.sex) e[`dog-${i}-sex`] = 'Vyberte pohlaví.'
      })
    }
    if (activeStep.id === 'owner') {
      if (!draft.owner.firstName.trim()) e.firstName = 'Zadejte jméno.'
      if (!draft.owner.lastName.trim()) e.lastName = 'Zadejte příjmení.'
      if (!/^\S+@\S+\.\S+$/.test(draft.owner.email))
        e.email = 'Zadejte platný e-mail.'
      if (draft.owner.phone.replace(/\s/g, '').length < 9)
        e.phone = 'Zadejte platné telefonní číslo.'
    }
    if (activeStep.id === 'summary') {
      if (!draft.consents.truthfulness)
        e.truthfulness = 'Potvrďte pravdivost údajů.'
      if (!draft.consents.stayConditions)
        e.stayConditions = 'Potvrďte souhlas s podmínkami pobytu.'
      if (!draft.consents.cancellationConditions)
        e.cancellationConditions = 'Potvrďte souhlas se storno podmínkami.'
      if (!draft.consents.personalData)
        e.personalData = 'Potvrďte souhlas se zpracováním údajů.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (!validateStep()) {
      // focus first error region by scrolling to top of the form card
      document
        .getElementById('reservation-step')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setErrors({})
    setStepIndex((i) => Math.min(i + 1, RESERVATION_STEPS.length - 1))
    document
      .getElementById('reservation-top')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function back() {
    setErrors({})
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  function restart() {
    setDraft(createEmptyDraft())
    setErrors({})
    setStepIndex(0)
  }

  const progressSteps = RESERVATION_STEPS.slice(0, 5)

  return (
    <div id="reservation-top" className="mx-auto max-w-6xl">
      {!isDone ? (
        <ol className="mb-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-3 sm:gap-x-3">
          {progressSteps.map((step, i) => {
            const done = i < stepIndex
            const current = i === stepIndex
            return (
              <li key={step.id} className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => i < stepIndex && setStepIndex(i)}
                  disabled={i > stepIndex}
                  className={cn(
                    'flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm transition-colors',
                    current
                      ? 'bg-primary text-primary-foreground'
                      : done
                        ? 'text-verde-green hover:bg-verde-ivory'
                        : 'text-verde-stone',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full border text-xs font-semibold',
                      current
                        ? 'border-verde-white/40 bg-verde-white/15'
                        : done
                          ? 'border-verde-green bg-verde-green text-verde-white'
                          : 'border-verde-stone',
                    )}
                  >
                    {done ? <Check className="size-4" /> : i + 1}
                  </span>
                  <span className="hidden font-medium sm:inline">
                    {step.label}
                  </span>
                </button>
                {i < progressSteps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-px w-4 sm:w-8',
                      done ? 'bg-verde-green' : 'bg-verde-stone/50',
                    )}
                  />
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : null}

      <div
        className={cn(
          'grid gap-8',
          !isDone && activeStep.id !== 'summary'
            ? 'lg:grid-cols-[minmax(0,1fr)_20rem]'
            : '',
        )}
      >
        <div
          id="reservation-step"
          className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8 md:p-10"
        >
          {activeStep.id === 'term' && (
            <StepTerm
              draft={draft}
              errors={errors}
              estimate={estimate}
              onChange={update}
              onNext={next}
            />
          )}
          {activeStep.id === 'dogs' && (
            <StepDogs
              draft={draft}
              errors={errors}
              onChange={update}
              onDogCount={setDogCount}
              onNext={next}
              onBack={back}
            />
          )}
          {activeStep.id === 'services' && (
            <StepServices
              draft={draft}
              onChange={update}
              onNext={next}
              onBack={back}
            />
          )}
          {activeStep.id === 'owner' && (
            <StepOwner
              draft={draft}
              errors={errors}
              onChange={update}
              onNext={next}
              onBack={back}
            />
          )}
          {activeStep.id === 'summary' && (
            <StepSummary
              draft={draft}
              estimate={estimate}
              errors={errors}
              onChange={update}
              onNext={next}
              onBack={back}
              onEditStep={(id) =>
                setStepIndex(RESERVATION_STEPS.findIndex((s) => s.id === id))
              }
            />
          )}
          {activeStep.id === 'done' && (
            <StepDone draft={draft} estimate={estimate} onRestart={restart} />
          )}
        </div>

        {!isDone && activeStep.id !== 'summary' ? (
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <EstimatePanel estimate={estimate} />
          </aside>
        ) : null}
      </div>
    </div>
  )
}
