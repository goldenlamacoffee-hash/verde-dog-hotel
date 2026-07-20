import { formatPrice } from '@/lib/format'
import type { Estimate } from '@/lib/reservation'

export function EstimatePanel({ estimate }: { estimate: Estimate }) {
  const hasNights = estimate.nights > 0
  return (
    <div className="rounded-2xl border border-border bg-secondary/60 p-6">
      <h2 className="font-serif text-lg font-semibold text-verde-deep">
        Orientační cena
      </h2>
      <p className="mt-1 text-xs text-verde-moss">
        Nezávazný odhad. Konečnou cenu potvrdíme po ověření termínu.
      </p>

      {hasNights ? (
        <>
          <dl className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
            <div className="flex items-center justify-between text-verde-moss">
              <dt>Počet nocí</dt>
              <dd className="font-medium text-verde-deep">{estimate.nights}</dd>
            </div>
            <div className="flex items-center justify-between text-verde-moss">
              <dt>Počet psů</dt>
              <dd className="font-medium text-verde-deep">
                {estimate.dogCount}
              </dd>
            </div>
          </dl>

          <ul className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
            {estimate.lines.map((line) => (
              <li key={line.id} className="flex items-start justify-between gap-3">
                <span className="text-verde-moss">
                  {line.label}
                  <span className="block text-xs text-verde-stone">
                    {line.detail}
                  </span>
                </span>
                <span className="shrink-0 font-medium text-verde-deep">
                  {formatPrice(line.amount)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
            <span className="font-serif text-base font-semibold text-verde-deep">
              Celkem
            </span>
            <span className="font-serif text-xl font-semibold text-verde-green">
              {formatPrice(estimate.total)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-verde-moss">
            <span>Rezervační záloha (30 %)</span>
            <span className="font-medium">{formatPrice(estimate.deposit)}</span>
          </div>
        </>
      ) : (
        <p className="mt-5 border-t border-border pt-5 text-sm text-verde-moss">
          Vyberte termín pobytu a my zobrazíme orientační cenu.
        </p>
      )}
    </div>
  )
}
