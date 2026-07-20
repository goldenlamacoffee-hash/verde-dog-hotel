'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { CtaButton } from '@/components/common/cta-button'
import { Field, TextInput, TextArea } from '@/components/reservation/fields'

type Errors = Partial<Record<'name' | 'email' | 'message', string>>

export function ContactForm() {
  const [values, setValues] = useState({ name: '', email: '', phone: '', message: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [sent, setSent] = useState(false)

  function update(field: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    if (!values.name.trim()) next.name = 'Zadejte prosím jméno.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Zadejte platný e-mail.'
    if (values.message.trim().length < 10) next.message = 'Napište prosím alespoň pár slov.'
    setErrors(next)
    if (Object.keys(next).length === 0) {
      // Demo prototype: no backend. See lib/booking-types for the future contract.
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-verde-green/20 bg-secondary/40 p-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-verde-green text-verde-white">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </span>
        <h3 className="font-serif text-2xl font-semibold text-verde-deep">Zpráva odeslána</h3>
        <p className="max-w-sm text-pretty leading-relaxed text-verde-moss">
          Děkujeme za zprávu, {values.name.split(' ')[0]}. Ozveme se vám co nejdříve. (Ukázkový
          formulář — data se zatím neodesílají.)
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Jméno a příjmení" htmlFor="name" required error={errors.name}>
          <TextInput
            id="name"
            value={values.name}
            onChange={(e) => update('name', e.target.value)}
            invalid={!!errors.name}
            autoComplete="name"
          />
        </Field>
        <Field label="Telefon" htmlFor="phone">
          <TextInput
            id="phone"
            type="tel"
            value={values.phone}
            onChange={(e) => update('phone', e.target.value)}
            autoComplete="tel"
          />
        </Field>
      </div>
      <Field label="E-mail" htmlFor="email" required error={errors.email}>
        <TextInput
          id="email"
          type="email"
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
          invalid={!!errors.email}
          autoComplete="email"
        />
      </Field>
      <Field label="Zpráva" htmlFor="message" required error={errors.message}>
        <TextArea
          id="message"
          rows={5}
          value={values.message}
          onChange={(e) => update('message', e.target.value)}
          invalid={!!errors.message}
        />
      </Field>
      <CtaButton type="submit" size="md" className="self-start">
        Odeslat zprávu
      </CtaButton>
    </form>
  )
}
