'use client'

import { useState, useTransition } from 'react'
import { updateSiteSetting } from '@/lib/admin/actions'

interface Props {
  /** Current configured maximum (null = unlimited). */
  initialMaxNights: number | null
}

export function MaximumStayEditor({ initialMaxNights }: Props) {
  const [enabled, setEnabled] = useState(initialMaxNights !== null)
  const [nights, setNights] = useState(initialMaxNights ?? 30)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleToggle(checked: boolean) {
    setEnabled(checked)
    setSaved(false)
    setError(null)
  }

  function handleNightsChange(value: string) {
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed)) setNights(parsed)
    setSaved(false)
    setError(null)
  }

  function handleSave() {
    // Validate
    if (enabled) {
      if (!Number.isInteger(nights) || nights < 1) {
        setError('Zadejte platný počet nocí (minimálně 1).')
        return
      }
      if (nights > 365) {
        setError('Maximální povolená hodnota je 365 nocí.')
        return
      }
    }

    setError(null)
    startTransition(async () => {
      try {
        // null-equivalent: store { nights: null } so the key exists but is inactive.
        // The API and helper both check for a positive integer, so null = unlimited.
        await updateSiteSetting('maximumStayNights', { nights: enabled ? nights : null })
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => handleToggle(!enabled)}
          className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            background: enabled ? 'var(--admin-accent)' : 'var(--admin-card-border)',
            outlineColor: 'var(--admin-accent)',
          }}
        >
          <span
            className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
            style={{ transform: enabled ? 'translateX(18px)' : 'translateX(2px)' }}
          />
        </button>
        <span className="text-sm font-medium" style={{ color: 'var(--admin-text)' }}>
          Omezit maximální délku pobytu
        </span>
      </label>

      {/* Night count input — only shown when enabled */}
      {enabled && (
        <div className="flex items-end gap-4 flex-wrap pl-1">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="maxStayNights"
              className="text-xs font-medium"
              style={{ color: 'var(--admin-text-muted)' }}
            >
              Maximální délka pobytu (nocí)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="maxStayNights"
                type="number"
                min={1}
                max={365}
                step={1}
                value={nights}
                onChange={(e) => handleNightsChange(e.target.value)}
                className="w-24 rounded-lg px-3 py-2 text-sm font-semibold text-center tabular-nums"
                style={{
                  background: 'var(--admin-bg)',
                  border:     '1px solid var(--admin-card-border)',
                  color:      'var(--admin-text)',
                }}
              />
              <span className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>nocí</span>
            </div>
          </div>
        </div>
      )}

      {/* Help text */}
      <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
        {enabled
          ? `Zákazníci nebudou moci vybrat pobyt delší než ${nights} nocí.`
          : 'Délka pobytu není omezena. Nechte vypnuto, pokud omezení nechcete.'}
      </p>

      {/* Error */}
      {error && (
        <p className="text-xs font-medium px-3 py-2 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}>
          {error}
        </p>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: 'var(--admin-accent)', color: '#fff' }}
        >
          {isPending ? 'Ukládám…' : 'Uložit'}
        </button>
        {saved && !isPending && (
          <span className="text-xs font-medium" style={{ color: '#16a34a' }}>
            Uloženo. Veřejná stránka rezervace se aktualizuje automaticky.
          </span>
        )}
      </div>
    </div>
  )
}
