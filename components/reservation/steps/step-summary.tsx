'use client'

import { Pencil } from 'lucide-react'
import { StepIntro } from '../step-nav'
import { CtaButton } from '@/components/common/cta-button'
import { services } from '@/content/services'
import { formatDate, formatPrice } from '@/lib/format'
import type { Estimate, ReservationDraft, StepId } from '@/lib/reservation'

interface Props {
  draft: ReservationDraft
  estimate: Estimate
  errors: Record<string, string>
  onChange: (patch: Partial<ReservationDraft>) => void
  onNext: () => void
  onBack: () => void
  onEditStep: (id: StepId) => void
}

const CONSENTS: {
  key: keyof ReservationDraft['consents']
  label: string
  required: boolean
}[] = [
  { key: 'truthfulness', label: 'Potvrzuji, že uvedené údaje jsou pravdivé a úplné.', required: true },
  { key: 'stayConditions', label: 'Souhlasím s podmínkami pobytu psího hotelu VERDE.', required: true },
  { key: 'cancellationConditions', label: 'Souhlasím se storno podmínkami a výší zálohy.', required: true },
  { key: 'personalData', label: 'Souhlasím se zpracováním osobních údajů (GDPR).', required: true },
  { key: 'marketing', label: 'Chci dostávat novinky a tipy e-mailem (nepovinné).', required: false },
]

function EditRow({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-base font-semibold text-verde-deep">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-verde-green transition-colors hover:text-verde-deep"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          Upravit
        </button>
      </div>
      {children}
    </div>
  )
}

export function StepSummary({
  draft,
  estimate,
  errors,
  onChange,
  onNext,
  onBack,
  onEditStep,
}: Props) {
  function toggleConsent(key: keyof ReservationDraft['consents']) {
    onChange({ consents: { ...draft.consents, [key]: !draft.consents[key] } })
  }

  const selectedServiceTitles = draft.selectedServices
    .map((id) => services.find((s) => s.id === id)?.title)
    .filter(Boolean)

  return (
    <div>
      <StepIntro
        step="Krok 5 z 5"
        title="Souhrn rezervace"
        description="Zkontrolujte prosím údaje a potvrďte nezávaznou žádost o rezervaci."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <EditRow title="Termín pobytu" onEdit={() => onEditStep('term')}>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-verde-moss">Příjezd</dt>
              <dd className="font-medium text-verde-deep">{formatDate(draft.arrival)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-verde-moss">Odjezd</dt>
              <dd className="font-medium text-verde-deep">{formatDate(draft.departure)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-verde-moss">Počet nocí</dt>
              <dd className="font-medium text-verde-deep">{estimate.nights}</dd>
            </div>
          </dl>
        </EditRow>

        <EditRow title="Psi" onEdit={() => onEditStep('dogs')}>
          <ul className="space-y-2 text-sm">
            {draft.dogs.map((dog, i) => (
              <li key={i} className="text-verde-deep">
                <span className="font-medium">{dog.name || `Pes ${i + 1}`}</span>
                {dog.breed ? <span className="text-verde-moss"> · {dog.breed}</span> : null}
                {dog.sex ? (
                  <span className="text-verde-moss"> · {dog.sex === 'male' ? 'pes' : 'fena'}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </EditRow>

        <EditRow title="Doplňkové služby" onEdit={() => onEditStep('services')}>
          {selectedServiceTitles.length ? (
            <ul className="space-y-1 text-sm text-verde-deep">
              {selectedServiceTitles.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-verde-moss">Pouze péče v ceně pobytu.</p>
          )}
        </EditRow>

        <EditRow title="Kontakt" onEdit={() => onEditStep('owner')}>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-verde-moss">Jméno</dt>
              <dd className="font-medium text-verde-deep">
                {draft.owner.firstName} {draft.owner.lastName}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-verde-moss">E-mail</dt>
              <dd className="font-medium text-verde-deep">{draft.owner.email || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-verde-moss">Telefon</dt>
              <dd className="font-medium text-verde-deep">{draft.owner.phone || '—'}</dd>
            </div>
          </dl>
        </EditRow>
      </div>

      <div className="mt-5 rounded-xl border border-verde-green/20 bg-secondary/60 p-5">
        <div className="flex items-center justify-between">
          <span className="font-serif text-base font-semibold text-verde-deep">Orientační cena celkem</span>
          <span className="font-serif text-xl font-semibold text-verde-green">{formatPrice(estimate.total)}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-sm text-verde-moss">
          <span>Rezervační záloha (30 %)</span>
          <span className="font-medium">{formatPrice(estimate.deposit)}</span>
        </div>
      </div>

      <fieldset className="mt-8">
        <legend className="mb-3 font-serif text-base font-semibold text-verde-deep">Souhlasy</legend>
        <div className="space-y-3">
          {CONSENTS.map((consent) => {
            const error = errors[consent.key]
            return (
              <div key={consent.key}>
                <label className="flex cursor-pointer items-start gap-3 text-sm text-verde-charcoal">
                  <input
                    type="checkbox"
                    checked={draft.consents[consent.key]}
                    onChange={() => toggleConsent(consent.key)}
                    className="mt-0.5 size-4 shrink-0 accent-verde-green"
                  />
                  <span>
                    {consent.label}
                    {consent.required ? <span className="ml-0.5 text-destructive">*</span> : null}
                  </span>
                </label>
                {error ? (
                  <p className="ml-7 mt-1 text-xs font-medium text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </fieldset>

      <div className="mt-10 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-verde-moss transition-colors hover:text-verde-green"
        >
          Zpět
        </button>
        <CtaButton type="button" onClick={onNext} size="md">
          Odeslat nezávaznou žádost
        </CtaButton>
      </div>
    </div>
  )
}
