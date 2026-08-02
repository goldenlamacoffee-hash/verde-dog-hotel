'use client'

import { Check, AlertTriangle } from 'lucide-react'
import { StepIntro, StepNav } from '../step-nav'
import { formatPrice, dbUnitLabel } from '@/lib/format'
import type { ReservationDraft } from '@/lib/reservation'
import type { ReservationService } from '@/lib/public-data'

interface Props {
  draft: ReservationDraft
  /** Services from DB. null = DB unavailable — block progression. */
  services: ReservationService[] | null
  onChange: (patch: Partial<ReservationDraft>) => void
  onNext: () => void
  onBack: () => void
}

export function StepServices({ draft, services, onChange, onNext, onBack }: Props) {
  // Fail-closed: cannot show or price services when DB is unavailable
  if (services === null) {
    return (
      <div>
        <StepIntro
          step="Krok 3 z 5"
          title="Doplňkové služby"
          description="Základní péče je vždy v ceně. Vyberte nadstandard, který vašemu psovi zpříjemní pobyt."
        />
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-verde-deep">Služby momentálně nejsou dostupné</p>
            <p className="text-verde-moss">
              Nepodařilo se načíst aktuální nabídku služeb. Obnovte stránku nebo nás kontaktujte přímo.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <StepNav onBack={onBack} onNext={() => {}} disabledNext />
        </div>
      </div>
    )
  }

  const standard = services.filter((s) => s.standard)
  const optional = services.filter((s) => !s.standard)

  function toggle(id: string) {
    const selected = draft.selectedServices.includes(id)
      ? draft.selectedServices.filter((s) => s !== id)
      : [...draft.selectedServices, id]
    onChange({ selectedServices: selected })
  }

  return (
    <div>
      <StepIntro
        step="Krok 3 z 5"
        title="Doplňkové služby"
        description="Základní péče je vždy v ceně. Vyberte nadstandard, který vašemu psovi zpříjemní pobyt."
      />

      {standard.length > 0 && (
        <div className="mb-8 rounded-xl border border-verde-green/20 bg-secondary/50 p-5">
          <p className="label-caps text-verde-wood">V ceně pobytu</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {standard.map((service) => (
              <li key={service.id} className="flex items-start gap-2 text-sm text-verde-deep">
                <Check className="mt-0.5 size-4 shrink-0 text-verde-green" aria-hidden="true" />
                {service.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {optional.map((service) => {
          const active = draft.selectedServices.includes(service.id)
          return (
            <button
              key={service.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(service.id)}
              className={
                'flex flex-col rounded-xl border p-5 text-left transition-colors ' +
                (active
                  ? 'border-verde-green bg-secondary/60 ring-1 ring-verde-green/30'
                  : 'border-border bg-card hover:border-verde-green/40')
              }
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-serif text-base font-semibold text-verde-deep">
                  {service.title}
                </span>
                <span
                  className={
                    'flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ' +
                    (active
                      ? 'border-verde-green bg-verde-green text-verde-white'
                      : 'border-verde-stone')
                  }
                  aria-hidden="true"
                >
                  {active ? <Check className="size-3.5" /> : null}
                </span>
              </div>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-verde-moss">
                {service.description}
              </p>
              <span className="mt-3 text-sm font-semibold text-verde-green">
                {formatPrice(service.price)}
                <span className="font-normal text-verde-stone">
                  {' '}{dbUnitLabel(service.unit, service.custom_unit_label)}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <StepNav onNext={onNext} onBack={onBack} />
    </div>
  )
}
