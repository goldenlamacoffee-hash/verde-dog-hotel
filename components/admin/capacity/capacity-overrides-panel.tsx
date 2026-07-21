'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { upsertCapacityOverride, deleteCapacityOverride } from '@/lib/admin/actions'

interface Override {
  id: string
  date_from: string
  date_to: string
  max_dogs: number | null
  reason: string | null
}

interface Props {
  overrides: Override[]
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function CapacityOverridesPanel({ overrides: initial }: Props) {
  const [overrides, setOverrides] = useState<Override[]>(initial)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    date_from: '',
    date_to: '',
    max_dogs: '',
    reason: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.date_from || !form.date_to) { setError('Zadejte datum od i do.'); return }
    if (form.date_to < form.date_from) { setError('Datum do musí být rovno nebo po datu od.'); return }
    setError(null)

    startTransition(async () => {
      try {
        await upsertCapacityOverride({
          date_from: form.date_from,
          date_to: form.date_to,
          max_dogs: form.max_dogs !== '' ? parseInt(form.max_dogs, 10) : null,
          reason: form.reason || undefined,
        })
        setOpen(false)
        setForm({ date_from: '', date_to: '', max_dogs: '', reason: '' })
        window.location.reload()
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Smazat toto omezení?')) return
    startTransition(async () => {
      try {
        await deleteCapacityOverride(id)
        setOverrides(os => os.filter(o => o.id !== id))
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  return (
    <div>
      {overrides.length === 0 ? (
        <p className="py-2 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
          Žádná blokace nebo omezení.
        </p>
      ) : (
        <ul className="space-y-2 mb-4">
          {overrides.map(o => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)' }}
            >
              <div>
                <span className="font-medium" style={{ color: 'var(--admin-text)' }}>
                  {fmtDate(o.date_from)}
                  {o.date_from !== o.date_to ? ` – ${fmtDate(o.date_to)}` : ''}
                </span>
                <span className="ml-3" style={{ color: 'var(--admin-text-muted)' }}>
                  {o.max_dogs === null ? 'Uzavřeno' : `max. ${o.max_dogs} psů`}
                  {o.reason ? ` · ${o.reason}` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(o.id)}
                disabled={pending}
                className="rounded p-1 transition-colors hover:bg-red-100 hover:text-red-600"
                aria-label="Smazat omezení"
                style={{ color: 'var(--admin-text-muted)' }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form
          onSubmit={handleAdd}
          className="space-y-3 rounded-xl p-4"
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)' }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>
            Přidat blokaci / omezení
          </h3>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--admin-text-muted)' }}>Datum od</label>
              <input
                type="date"
                required
                value={form.date_from}
                onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))}
                className="w-full rounded-lg border px-3 py-1.5 text-sm"
                style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-text)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--admin-text-muted)' }}>Datum do</label>
              <input
                type="date"
                required
                value={form.date_to}
                onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))}
                className="w-full rounded-lg border px-3 py-1.5 text-sm"
                style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-text)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                Max. psů (prázdné = uzavřeno)
              </label>
              <input
                type="number"
                min="0"
                value={form.max_dogs}
                onChange={e => setForm(f => ({ ...f, max_dogs: e.target.value }))}
                placeholder="Uzavřeno"
                className="w-full rounded-lg border px-3 py-1.5 text-sm"
                style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-text)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--admin-text-muted)' }}>Důvod (volitelně)</label>
              <input
                type="text"
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Dovolená, oprava…"
                className="w-full rounded-lg border px-3 py-1.5 text-sm"
                style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-text)' }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ background: 'var(--admin-accent)' }}
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Uložit
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null) }}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ color: 'var(--admin-text-muted)' }}
            >
              Zrušit
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
          style={{ color: 'var(--admin-accent)' }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Přidat blokaci
        </button>
      )}
    </div>
  )
}
