'use client'

import { CheckCircle2 } from 'lucide-react'
import { LeafSprig } from '@/components/brand/leaf-sprig'
import { CtaLink } from '@/components/common/cta-button'
import { formatDate, formatPrice } from '@/lib/format'
import type { Estimate, ReservationDraft } from '@/lib/reservation'

interface Props {
  draft: ReservationDraft
  estimate: Estimate
  refNumber: string
  /** Server-confirmed total — overrides client-side estimate when available. */
  confirmedTotal?: number | null
  /** Server-confirmed deposit — overrides client-side estimate when available. */
  confirmedDeposit?: number | null
  /**
   * VERDE contact email from CMS site_settings — shown in the confirmation
   * message so guests know who to contact. Falls back to a neutral sentence
   * when not configured.
   */
  contactEmail?: string | null
  onRestart: () => void
}

export function StepDone({ draft, estimate, refNumber, confirmedTotal, confirmedDeposit, contactEmail, onRestart }: Props) {
  const displayTotal = confirmedTotal ?? estimate.total
  const displayDeposit = confirmedDeposit ?? estimate.deposit
  const greeting = draft.owner.firstName
    ? `Děkujeme, ${draft.owner.firstName}.`
    : 'Děkujeme.'
  return (
    <div className="mx-auto max-w-xl text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-secondary">
        <CheckCircle2 className="size-8 text-verde-green" aria-hidden="true" />
      </div>
      <h2 className="mt-6 text-balance font-serif text-3xl font-semibold text-verde-deep">
        Žádost byla odeslána
      </h2>
      <p className="mt-3 text-pretty leading-relaxed text-verde-moss">
        {greeting} Vaši nezávaznou žádost jsme přijali.{' '}
        {contactEmail
          ? <>Ozveme se vám do 24 hodin na <a href={`mailto:${contactEmail}`} className="font-medium text-verde-green hover:underline">{contactEmail}</a> s potvrzením termínu a pokyny k rezervační záloze.</>
          : 'Ozveme se vám do 24 hodin s potvrzením termínu a pokyny k rezervační záloze.'
        }
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-secondary/50 p-6 text-left">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <span className="label-caps text-verde-wood">Číslo žádosti</span>
          <span className="font-mono text-sm font-semibold text-verde-deep">{refNumber}</span>
        </div>
        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-verde-moss">Termín</dt>
            <dd className="font-medium text-verde-deep">
              {formatDate(draft.arrival)} — {formatDate(draft.departure)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-verde-moss">Počet psů</dt>
            <dd className="font-medium text-verde-deep">{estimate.dogCount}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-verde-moss">
              {confirmedTotal != null ? 'Cena celkem' : 'Orientační cena'}
            </dt>
            <dd className="font-medium text-verde-deep">{formatPrice(displayTotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-verde-moss">Rezervační záloha (30 %)</dt>
            <dd className="font-medium text-verde-green">{formatPrice(displayDeposit)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex justify-center">
        <LeafSprig className="h-5 w-auto text-verde-green" />
      </div>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <CtaLink href="/" size="md">
          Zpět na úvod
        </CtaLink>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-verde-moss transition-colors hover:text-verde-green"
        >
          Vytvořit další žádost
        </button>
      </div>


    </div>
  )
}
