'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { addPayment, deletePayment } from '@/lib/admin/actions'

interface Payment {
  id: string
  amount: number
  payment_type: string
  method: string | null
  paid_at: string
  note: string | null
}

interface Props {
  reservationId: string
  payments: Payment[]
  totalPrice: number | null
}

const TYPE_LABELS: Record<string, string> = {
  deposit: 'Záloha',
  final: 'Doplatek',
  refund: 'Vrácení',
  extra: 'Jiné',
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Hotovost',
  card: 'Karta',
  bank_transfer: 'Převod',
  online: 'Online',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function PaymentsPanel({ reservationId, payments: initial, totalPrice }: Props) {
  const [payments, setPayments] = useState<Payment[]>(initial)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    amount: '',
    payment_type: 'deposit' as 'deposit' | 'final' | 'refund' | 'extra',
    method: 'bank_transfer' as 'cash' | 'card' | 'bank_transfer' | 'online',
    note: '',
    paid_at: new Date().toISOString().split('T')[0],
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const totalPaid = payments
    .filter(p => p.payment_type !== 'refund')
    .reduce((s, p) => s + Number(p.amount), 0)
  const totalRefunded = payments
    .filter(p => p.payment_type === 'refund')
    .reduce((s, p) => s + Number(p.amount), 0)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) { setError('Zadejte platnou částku.'); return }
    setError(null)
    startTransition(async () => {
      try {
        await addPayment({
          reservation_id: reservationId,
          amount,
          payment_type: form.payment_type,
          method: form.method,
          note: form.note || undefined,
          paid_at: new Date(form.paid_at).toISOString(),
        })
        // Refresh by router but we locally optimistic-update too
        setOpen(false)
        setForm(f => ({ ...f, amount: '', note: '' }))
        // The server will revalidate — but to keep UI snappy, reload
        window.location.reload()
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Smazat tento platební záznam?')) return
    startTransition(async () => {
      try {
        await deletePayment(id, reservationId)
        setPayments(ps => ps.filter(p => p.id !== id))
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  return (
    <div>
      {/* Summary row */}
      <div className="mb-4 flex items-center justify-between text-sm">
        <div style={{ color: 'var(--admin-text-muted)' }}>
          Uhrazeno:{' '}
          <span className="font-semibold" style={{ color: 'var(--admin-text)' }}>
            {totalPaid.toLocaleString('cs-CZ')} Kč
          </span>
          {totalRefunded > 0 && (
            <span className="ml-2" style={{ color: '#dc2626' }}>
              − vráceno {totalRefunded.toLocaleString('cs-CZ')} Kč
            </span>
          )}
        </div>
        {totalPrice && (
          <div style={{ color: 'var(--admin-text-muted)' }}>
            celkem{' '}
            <span className="font-semibold" style={{ color: 'var(--admin-text)' }}>
              {Number(totalPrice).toLocaleString('cs-CZ')} Kč
            </span>
          </div>
        )}
      </div>

      {/* Payment list */}
      {payments.length === 0 ? (
        <p className="py-3 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
          Zatím žádné platby.
        </p>
      ) : (
        <ul className="space-y-2 mb-4">
          {payments.map(p => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)' }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                  style={{
                    background: p.payment_type === 'refund' ? '#fef2f2' : 'var(--admin-accent-light)',
                    color: p.payment_type === 'refund' ? '#dc2626' : 'var(--admin-accent)',
                  }}
                >
                  {TYPE_LABELS[p.payment_type] ?? p.payment_type}
                </span>
                <span style={{ color: 'var(--admin-text)' }}>
                  <strong>{Number(p.amount).toLocaleString('cs-CZ')} Kč</strong>
                  {p.method && (
                    <span className="ml-2" style={{ color: 'var(--admin-text-muted)' }}>
                      · {METHOD_LABELS[p.method] ?? p.method}
                    </span>
                  )}
                  {p.note && (
                    <span className="ml-2" style={{ color: 'var(--admin-text-muted)' }}>
                      · {p.note}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2" style={{ color: 'var(--admin-text-muted)' }}>
                <span className="text-xs">{fmt(p.paid_at)}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  disabled={pending}
                  className="rounded p-1 transition-colors hover:bg-red-100 hover:text-red-600"
                  aria-label="Smazat platbu"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add payment */}
      {open ? (
        <form onSubmit={handleAdd} className="space-y-3 rounded-xl p-4" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>Přidat platbu</h3>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--admin-text-muted)' }}>Částka (Kč)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-lg border px-3 py-1.5 text-sm"
                style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-text)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--admin-text-muted)' }}>Datum</label>
              <input
                type="date"
                required
                value={form.paid_at}
                onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))}
                className="w-full rounded-lg border px-3 py-1.5 text-sm"
                style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-text)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--admin-text-muted)' }}>Typ</label>
              <select
                value={form.payment_type}
                onChange={e => setForm(f => ({ ...f, payment_type: e.target.value as any }))}
                className="w-full rounded-lg border px-3 py-1.5 text-sm"
                style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-text)' }}
              >
                <option value="deposit">Záloha</option>
                <option value="final">Doplatek</option>
                <option value="refund">Vrácení</option>
                <option value="extra">Jiné</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--admin-text-muted)' }}>Způsob</label>
              <select
                value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value as any }))}
                className="w-full rounded-lg border px-3 py-1.5 text-sm"
                style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-text)' }}
              >
                <option value="bank_transfer">Převod</option>
                <option value="cash">Hotovost</option>
                <option value="card">Karta</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--admin-text-muted)' }}>Poznámka</label>
            <input
              type="text"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Volitelně"
              className="w-full rounded-lg border px-3 py-1.5 text-sm"
              style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-text)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
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
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          style={{ color: 'var(--admin-accent)' }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Přidat platbu
        </button>
      )}
    </div>
  )
}
