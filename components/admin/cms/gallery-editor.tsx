'use client'

import { useState, useTransition } from 'react'
import { upsertGalleryItem, deleteGalleryItem } from '@/lib/admin/actions'

interface GalleryItem {
  id: string; title?: string; alt?: string; src: string
  category: string; featured: boolean; active: boolean; sort_order: number
}
const CATS = ['all', 'ubytovani', 'venku', 'pece', 'detail']
const EMPTY: Omit<GalleryItem, 'id'> = { title: '', alt: '', src: '', category: 'all', featured: false, active: true, sort_order: 0 }

export function GalleryEditor({ initialItems }: { initialItems: GalleryItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [editing, setEditing] = useState<Partial<GalleryItem> | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    if (!editing?.src) return
    startTransition(async () => {
      await upsertGalleryItem({
        id: editing.id, title: editing.title, alt: editing.alt, src: editing.src!,
        category: editing.category ?? 'all', featured: editing.featured ?? false,
        active: editing.active ?? true, sort_order: editing.sort_order ?? 0,
      })
      setEditing(null)
    })
  }

  function remove(id: string) {
    if (!confirm('Smazat tuto fotografii?')) return
    startTransition(async () => {
      await deleteGalleryItem(id)
      setItems(prev => prev.filter(i => i.id !== id))
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.id} className="rounded-xl overflow-hidden group relative"
               style={{ border: '1px solid var(--admin-card-border)', background: 'var(--admin-card)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.src} alt={item.alt ?? item.title ?? ''} className="w-full aspect-square object-cover" />
            <div className="p-2">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--admin-text)' }}>{item.title || item.alt || '—'}</p>
              <p className="text-[10px]" style={{ color: 'var(--admin-text-muted)' }}>{item.category}</p>
            </div>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditing({ ...item })}
                className="rounded px-2 py-1 text-[10px] font-medium"
                style={{ background: 'var(--admin-accent)', color: '#fff' }}>
                Upravit
              </button>
              <button onClick={() => remove(item.id)}
                className="rounded px-2 py-1 text-[10px]"
                style={{ background: '#dc2626', color: '#fff' }}>
                Smazat
              </button>
            </div>
            {item.featured && (
              <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: '#fef9c3', color: '#854d0e' }}>Hlavní</span>
            )}
          </div>
        ))}
        <button onClick={() => setEditing({ ...EMPTY, sort_order: items.length + 1 })}
          className="rounded-xl aspect-square flex flex-col items-center justify-center text-sm font-medium"
          style={{ background: 'var(--admin-accent-light)', color: 'var(--admin-accent)', border: '1px dashed var(--admin-card-border)' }}>
          <span className="text-2xl mb-1">+</span>
          Přidat foto
        </button>
      </div>

      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 w-full max-w-lg space-y-4" style={{ background: 'var(--admin-card)' }}>
            <h2 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)', color: 'var(--admin-text)' }}>
              {editing.id ? 'Upravit fotografii' : 'Nová fotografie'}
            </h2>
            {[['URL fotografie', 'src'], ['Popisek (alt)', 'alt'], ['Název', 'title']].map(([label, key]) => (
              <div key={key} className="space-y-1">
                <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>{label}</label>
                <input value={(editing as any)[key] ?? ''} onChange={e => setEditing(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>Kategorie</label>
                <select value={editing.category ?? 'all'} onChange={e => setEditing(p => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>Pořadí</label>
                <input type="number" value={editing.sort_order ?? 0} onChange={e => setEditing(p => ({ ...p, sort_order: Number(e.target.value) }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }} />
              </div>
            </div>
            <div className="flex gap-4">
              {[['featured', 'Hlavní foto'], ['active', 'Zobrazit']].map(([key, label]) => (
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
