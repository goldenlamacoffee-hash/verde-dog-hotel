'use client'

import { useState, useTransition, useRef } from 'react'
import Image from 'next/image'
import { upsertGalleryItem, deleteGalleryItem, reorderGalleryItems } from '@/lib/admin/actions'
import { MediaPickerModal } from '@/components/admin/media/media-picker-modal'
import type { MediaAsset } from '@/components/admin/media/media-library'

interface GalleryItem {
  id: string
  title?: string
  alt?: string
  src: string
  category: string
  featured: boolean
  active: boolean
  sort_order: number
}

const CATS = ['all', 'ubytovani', 'venku', 'pece', 'detail']
const EMPTY: Omit<GalleryItem, 'id'> = {
  title: '', alt: '', src: '', category: 'all',
  featured: false, active: true, sort_order: 0,
}

export function GalleryEditor({ initialItems }: { initialItems: GalleryItem[] }) {
  const [items, setItems]     = useState(initialItems)
  const [editing, setEditing] = useState<Partial<GalleryItem> | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const dragIdx = useRef<number | null>(null)

  // ─── Drag-reorder ─────────────────────────────────────────────────────────
  function onDragStart(idx: number) { dragIdx.current = idx }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    const from = dragIdx.current
    if (from === null || from === idx) return
    setItems(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(idx, 0, moved)
      dragIdx.current = idx
      return next
    })
  }

  function onDragEnd() {
    dragIdx.current = null
    // Persist new sort_order
    startTransition(async () => {
      await reorderGalleryItems(
        items.map((item, i) => ({ id: item.id, sort_order: i + 1 })),
      )
    })
  }

  function save() {
    if (!editing?.src) return
    startTransition(async () => {
      await upsertGalleryItem({
        id:         editing.id,
        title:      editing.title,
        alt:        editing.alt,
        src:        editing.src!,
        category:   editing.category ?? 'all',
        featured:   editing.featured ?? false,
        active:     editing.active ?? true,
        sort_order: editing.sort_order ?? 0,
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

  function handlePickerSelect(asset: MediaAsset) {
    setEditing(prev => ({
      ...prev,
      src: asset.public_url,
      alt: prev?.alt || asset.alt || '',
      title: prev?.title || asset.filename.replace(/\.[^/.]+$/, '') || '',
    }))
  }

  return (
    <div className="space-y-4">
      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item, idx) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={e => onDragOver(e, idx)}
            onDragEnd={onDragEnd}
            className="rounded-xl overflow-hidden group relative cursor-grab active:cursor-grabbing"
            style={{ border: '1px solid var(--admin-card-border)', background: 'var(--admin-card)' }}
          >
            <div className="relative aspect-square w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.alt ?? item.title ?? ''} className="w-full h-full object-cover" />
            </div>
            <div className="p-2">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--admin-text)' }}>
                {item.title || item.alt || '—'}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--admin-text-muted)' }}>{item.category}</p>
            </div>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditing({ ...item })}
                className="rounded px-2 py-1 text-[10px] font-medium"
                style={{ background: 'var(--admin-accent)', color: '#fff' }}
              >
                Upravit
              </button>
              <button
                onClick={() => remove(item.id)}
                className="rounded px-2 py-1 text-[10px]"
                style={{ background: '#dc2626', color: '#fff' }}
              >
                Smazat
              </button>
            </div>
            {item.featured && (
              <span
                className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: '#fef9c3', color: '#854d0e' }}
              >
                Hlavní
              </span>
            )}
          </div>
        ))}

        {/* Add button */}
        <button
          onClick={() => setEditing({ ...EMPTY, sort_order: items.length + 1 })}
          className="rounded-xl aspect-square flex flex-col items-center justify-center text-sm font-medium"
          style={{
            background: 'var(--admin-accent-light)',
            color: 'var(--admin-accent)',
            border: '1px dashed var(--admin-card-border)',
          }}
        >
          <span className="text-2xl mb-1">+</span>
          Přidat foto
        </button>
      </div>

      {/* Edit modal */}
      {editing !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          <div className="rounded-2xl p-6 w-full max-w-lg space-y-4" style={{ background: 'var(--admin-card)' }}>
            <h2
              className="font-semibold text-lg"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--admin-text)' }}
            >
              {editing.id ? 'Upravit fotografii' : 'Nová fotografie'}
            </h2>

            {/* Image preview + picker */}
            <div className="space-y-2">
              <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>
                Fotografie
              </label>
              {editing.src ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden"
                     style={{ background: 'var(--admin-bg)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={editing.src} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                  >
                    Změnit
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="w-full aspect-video rounded-lg flex flex-col items-center justify-center gap-2 text-sm"
                  style={{
                    background: 'var(--admin-bg)',
                    border: '2px dashed var(--admin-card-border)',
                    color: 'var(--admin-accent)',
                  }}
                >
                  <span className="text-2xl">+</span>
                  Vybrat z knihovny médií
                </button>
              )}

              {/* Manual URL fallback */}
              <input
                value={editing.src ?? ''}
                onChange={e => setEditing(p => ({ ...p, src: e.target.value }))}
                placeholder="nebo vložte URL přímo…"
                className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                style={{
                  background: 'var(--admin-bg)',
                  border: '1px solid var(--admin-card-border)',
                  color: 'var(--admin-text-muted)',
                }}
              />
            </div>

            {/* Alt + title */}
            {[['Popisek (alt)', 'alt'], ['Název', 'title']].map(([label, key]) => (
              <div key={key} className="space-y-1">
                <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>
                  {label}
                </label>
                <input
                  value={(editing as Record<string, string>)[key] ?? ''}
                  onChange={e => setEditing(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
                />
              </div>
            ))}

            {/* Category + sort */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>Kategorie</label>
                <select
                  value={editing.category ?? 'all'}
                  onChange={e => setEditing(p => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
                >
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>Pořadí</label>
                <input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={e => setEditing(p => ({ ...p, sort_order: Number(e.target.value) }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-4">
              {[['featured', 'Hlavní foto'], ['active', 'Zobrazit']] .map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--admin-text)' }}>
                  <input
                    type="checkbox"
                    checked={(editing as Record<string, boolean>)[key] ?? false}
                    onChange={e => setEditing(p => ({ ...p, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={save}
                disabled={isPending || !editing.src}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--admin-accent)', color: '#fff' }}
              >
                {isPending ? 'Ukládám…' : 'Uložit'}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg py-2.5 px-4 text-sm"
                style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-card-border)' }}
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media picker modal */}
      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
      />
    </div>
  )
}
