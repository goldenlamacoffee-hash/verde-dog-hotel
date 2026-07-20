'use client'

import { Field, TextArea, TextInput } from '../fields'
import { StepIntro, StepNav } from '../step-nav'
import type { ReservationDraft } from '@/lib/reservation'

interface Props {
  draft: ReservationDraft
  errors: Record<string, string>
  onChange: (patch: Partial<ReservationDraft>) => void
  onNext: () => void
  onBack: () => void
}

export function StepOwner({ draft, errors, onChange, onNext, onBack }: Props) {
  function updateOwner(patch: Partial<ReservationDraft['owner']>) {
    onChange({ owner: { ...draft.owner, ...patch } })
  }

  return (
    <div>
      <StepIntro
        step="Krok 4 z 5"
        title="Kontaktní údaje"
        description="Abychom vás mohli kontaktovat a potvrdit rezervaci."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Jméno" htmlFor="firstName" required error={errors.firstName}>
          <TextInput
            id="firstName"
            value={draft.owner.firstName}
            invalid={Boolean(errors.firstName)}
            onChange={(e) => updateOwner({ firstName: e.target.value })}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Příjmení" htmlFor="lastName" required error={errors.lastName}>
          <TextInput
            id="lastName"
            value={draft.owner.lastName}
            invalid={Boolean(errors.lastName)}
            onChange={(e) => updateOwner({ lastName: e.target.value })}
            autoComplete="family-name"
          />
        </Field>
        <Field label="E-mail" htmlFor="email" required error={errors.email}>
          <TextInput
            id="email"
            type="email"
            value={draft.owner.email}
            invalid={Boolean(errors.email)}
            onChange={(e) => updateOwner({ email: e.target.value })}
            autoComplete="email"
            placeholder="vas@email.cz"
          />
        </Field>
        <Field label="Telefon" htmlFor="phone" required error={errors.phone}>
          <TextInput
            id="phone"
            type="tel"
            value={draft.owner.phone}
            invalid={Boolean(errors.phone)}
            onChange={(e) => updateOwner({ phone: e.target.value })}
            autoComplete="tel"
            placeholder="+420 777 123 456"
          />
        </Field>
        <Field label="Adresa" htmlFor="address" className="sm:col-span-2">
          <TextInput
            id="address"
            value={draft.owner.address}
            onChange={(e) => updateOwner({ address: e.target.value })}
            autoComplete="street-address"
            placeholder="Ulice, město, PSČ"
          />
        </Field>
        <Field
          label="Nouzový kontakt — jméno"
          htmlFor="emergencyName"
          hint="Osoba, kterou můžeme kontaktovat, pokud vás nezastihneme."
        >
          <TextInput
            id="emergencyName"
            value={draft.owner.emergencyName}
            onChange={(e) => updateOwner({ emergencyName: e.target.value })}
          />
        </Field>
        <Field label="Nouzový kontakt — telefon" htmlFor="emergencyPhone">
          <TextInput
            id="emergencyPhone"
            type="tel"
            value={draft.owner.emergencyPhone}
            onChange={(e) => updateOwner({ emergencyPhone: e.target.value })}
          />
        </Field>
        <Field label="Zpráva pro nás" htmlFor="message" className="sm:col-span-2">
          <TextArea
            id="message"
            value={draft.owner.message}
            onChange={(e) => updateOwner({ message: e.target.value })}
            placeholder="Máte speciální přání nebo dotaz? Napište nám."
          />
        </Field>
      </div>

      <StepNav onNext={onNext} onBack={onBack} nextLabel="Přejít na souhrn" />
    </div>
  )
}
