'use client'

import { useState, useTransition } from 'react'
import { upsertFaqItem, deleteFaqItem } from '@/lib/admin/actions'

interface FaqItem {
  id: string
  question: string
  answer: string
  category: string
  sort_order: number
  active: boolean
}

interface Props { initialItems: FaqItem[] }

const EMPTY: Omit<FaqItem, 'id'> = { question: '', answer: '', category: 'general', sort_order: 0, active: true }

export function FaqEditor({ initialItems }: Props) {
  const [items, setItems] = useState<FaqItem[]>(initialItems)
  const [editing, setEditing] = useState<Partial<FaqItem> | null>(null)
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function openNew() { setEditing({ ...EMPTY, sort_order: items.length + 1 }) }
  function openEdit(item: FaqItem) { setEditing({ ...item }) }
  function cancel() { setEditing(null); setMsg(null) }

  function save() {
    if (!editing?.question || !editing?.answer) return
    startTransition(async () => {
      await upsertFaqItem({
        id: editing.id,
        question: editing.question!,
        answer: editing.answer!,
        category: editing.category ?? 'general',
        sort_order: editing.sort_order ?? 0,
        active: editing.active ?? true,
      })
      setMsg('Uloženo.')
      setEditing(null)
    })
  }

  function remove(id: string) {
    if (!confirm('Smazat tuto otázku?')) return
    startTransition(async () => {
      await deleteFaqItem(id)
      setItems(prev => prev.filter(i => i.id !== id))
    })
  }

  return (
    <div className="space-y-4">
      {msg && <div className="rounded-lg px-4 py-2.5 text-sm" style={{ background: '#dcfce7', color: '#166534' }}>{msg}</div>}

      {/* List */}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.id} className="rounded-xl p-4 flex items-start gap-4"
               style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}>
            <span className="text-xs tabular-nums pt-0.5 w-5 text-center shrink-0" style={{ color: 'var(--admin-text-muted)' }}>{idx + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm" style={{ color: 'var(--admin-text)' }}>{item.question}</p>
              <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--admin-text-muted)' }}>{item.answer}</p>
              <div className="flex gap-3 mt-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)' }}>
                  {item.category}
                </span>
                {!item.active && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#fee2e2', color: '#991b1b' }}>Skryto</span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => openEdit(item)} className="text-xs font-medium" style={{ color: 'var(--admin-accent)' }}>
                Upravit
              </button>
              <button onClick={() => remove(item.id)} className="text-xs" style={{ color: 'var(--admin-danger)' }}>
                Smazat
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={openNew}
        className="rounded-xl px-4 py-2.5 text-sm font-medium w-full"
        style={{ background: 'var(--admin-accent-light)', color: 'var(--admin-accent)', border: '1px dashed var(--admin-card-border)' }}
      >
        + Přidat otázku
      </button>

      {/* Edit modal */}
      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 w-full max-w-lg space-y-4" style={{ background: 'var(--admin-card)' }}>
            <h2 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)', color: 'var(--admin-text)' }}>
              {editing.id ? 'Upravit otázku' : 'Nová otázka'}
            </h2>
            <Field label="Otázka">
              <textarea rows={2} value={editing.question ?? ''} onChange={e => setEditing(p => ({ ...p, question: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
                style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }} />
            </Field>
            <Field label="Odpověď">
              <textarea rows={4} value={editing.answer ?? ''} onChange={e => setEditing(p => ({ ...p, answer: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
                style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Kategorie">
                <input value={editing.category ?? ''} onChange={e => setEditing(p => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }} />
              </Field>
              <Field label="Pořadí">
                <input type="number" value={editing.sort_order ?? 0} onChange={e => setEditing(p => ({ ...p, sort_order: Number(e.target.value) }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--admin-text)' }}>
              <input type="checkbox" checked={editing.active ?? true} onChange={e => setEditing(p => ({ ...p, active: e.target.checked }))} />
              Zobrazit na webu
            </label>
            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={isPending}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--admin-accent)', color: '#fff' }}>
                {isPending ? 'Ukládám…' : 'Uložit'}
              </button>
              <button onClick={cancel} className="rounded-lg py-2.5 px-4 text-sm"
                style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-card-border)' }}>
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}
