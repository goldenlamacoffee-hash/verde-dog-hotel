'use client'

import { useState, useTransition } from 'react'
import { upsertTestimonial, deleteTestimonial } from '@/lib/admin/actions'

interface Testimonial {
  id: string; author: string; dog_name?: string; text: string
  rating: number; featured: boolean; active: boolean; sort_order: number
}
const EMPTY: Omit<Testimonial, 'id'> = { author: '', dog_name: '', text: '', rating: 5, featured: false, active: true, sort_order: 0 }

export function TestimonialsEditor({ initialItems }: { initialItems: Testimonial[] }) {
  const [items, setItems] = useState(initialItems)
  const [editing, setEditing] = useState<Partial<Testimonial> | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    if (!editing?.author || !editing?.text) return
    startTransition(async () => {
      await upsertTestimonial({
        id: editing.id, author: editing.author!, dog_name: editing.dog_name,
        text: editing.text!, rating: editing.rating ?? 5,
        featured: editing.featured ?? false, active: editing.active ?? true,
        sort_order: editing.sort_order ?? 0,
      })
      setEditing(null)
    })
  }

  function remove(id: string) {
    if (!confirm('Smazat tuto recenzi?')) return
    startTransition(async () => {
      await deleteTestimonial(id)
      setItems(prev => prev.filter(i => i.id !== id))
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="rounded-xl p-4 flex gap-4"
               style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm" style={{ color: 'var(--admin-text)' }}>{item.author}</span>
                {item.dog_name && <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>· {item.dog_name}</span>}
                {'★'.repeat(item.rating)}
                {item.featured && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#fef9c3', color: '#854d0e' }}>Hlavní</span>}
              </div>
              <p className="text-xs line-clamp-2" style={{ color: 'var(--admin-text-muted)' }}>{item.text}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setEditing({ ...item })} className="text-xs font-medium" style={{ color: 'var(--admin-accent)' }}>Upravit</button>
              <button onClick={() => remove(item.id)} className="text-xs" style={{ color: 'var(--admin-danger)' }}>Smazat</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setEditing({ ...EMPTY, sort_order: items.length + 1 })}
        className="rounded-xl px-4 py-2.5 text-sm font-medium w-full"
        style={{ background: 'var(--admin-accent-light)', color: 'var(--admin-accent)', border: '1px dashed var(--admin-card-border)' }}>
        + Přidat recenzi
      </button>

      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 w-full max-w-lg space-y-4" style={{ background: 'var(--admin-card)' }}>
            <h2 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)', color: 'var(--admin-text)' }}>
              {editing.id ? 'Upravit recenzi' : 'Nová recenze'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[['Autor', 'author'], ['Jméno psa', 'dog_name']].map(([label, key]) => (
                <div key={key} className="space-y-1">
                  <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>{label}</label>
                  <input value={(editing as any)[key] ?? ''} onChange={e => setEditing(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }} />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>Text</label>
              <textarea rows={4} value={editing.text ?? ''} onChange={e => setEditing(p => ({ ...p, text: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
                style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>Hodnocení (1–5)</label>
                <input type="number" min={1} max={5} value={editing.rating ?? 5} onChange={e => setEditing(p => ({ ...p, rating: Number(e.target.value) }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }} />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>Pořadí</label>
                <input type="number" value={editing.sort_order ?? 0} onChange={e => setEditing(p => ({ ...p, sort_order: Number(e.target.value) }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }} />
              </div>
            </div>
            <div className="flex gap-4">
              {[['featured', 'Hlavní'], ['active', 'Zobrazit']].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--admin-text)' }}>
                  <input type="checkbox" checked={(editing as any)[key] ?? false} onChange={e => setEditing(p => ({ ...p, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={isPending}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--admin-accent)', color: '#fff' }}>
                {isPending ? 'Ukládám…' : 'Uložit'}
              </button>
              <button onClick={() => setEditing(null)} className="rounded-lg py-2.5 px-4 text-sm"
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
