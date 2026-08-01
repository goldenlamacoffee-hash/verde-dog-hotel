'use client'

/**
 * components/admin/services/services-catalogue-manager.tsx
 *
 * Full-featured services catalogue manager for the admin /sluzby page.
 * Features:
 *  - Grouped list by category with all new columns visible
 *  - Create / edit service via slide-in drawer
 *  - Archive (soft-delete) / restore / hard-delete with confirmation dialogs
 *  - Toggle active / available_in_reservation / show_on_web inline
 *  - Category management: create / edit / delete categories
 *  - Search / filter by name or category
 *  - Show/hide archived services toggle
 */

import { useState, useTransition, useMemo } from 'react'
import {
  upsertServiceCatalogue,
  archiveService,
  restoreService,
  deleteServiceSafe,
  upsertServiceCategory,
  deleteServiceCategory,
} from '@/lib/admin/service-actions'
import type { ServiceRow, ServiceCategoryRow } from '@/lib/types'

// ─── Unit helpers ─────────────────────────────────────────────────────────────

const UNIT_OPTIONS = [
  { value: 'night', label: '/ noc' },
  { value: 'day',   label: '/ den' },
  { value: 'stay',  label: '/ pobyt' },
  { value: 'walk',  label: '/ procházku' },
  { value: 'item',  label: '/ položku (jednorázově)' },
  { value: 'hour',  label: '/ hodinu' },
]

function unitDisplay(unit: string, custom_unit_label: string | null): string {
  if (custom_unit_label) return custom_unit_label
  return UNIT_OPTIONS.find((u) => u.value === unit)?.label ?? `/ ${unit}`
}

function formatCzk(value: number): string {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(value)
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px]" style={{ color: 'var(--admin-text-muted)' }}>{hint}</p>}
    </div>
  )
}

const INPUT_CLS = 'w-full rounded-lg px-3 py-2 text-sm outline-none'
const INPUT_STYLE = { background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' } as const

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceEditState = {
  id?: string
  title: string
  description: string
  price: number
  unit: string
  slug: string
  standard: boolean
  active: boolean
  show_on_web: boolean
  available_in_reservation: boolean
  sort_order: number
  category_id: number | null
  internal_note: string
  custom_unit_label: string
}

type CategoryEditState = {
  id?: number
  name: string
  slug: string
  sort_order: number
  description: string
  visible_on_website: boolean
  active: boolean
}

const EMPTY_SERVICE: ServiceEditState = {
  title: '',
  description: '',
  price: 0,
  unit: 'night',
  slug: '',
  standard: false,
  active: true,
  show_on_web: true,
  available_in_reservation: true,
  sort_order: 0,
  category_id: null,
  internal_note: '',
  custom_unit_label: '',
}

const EMPTY_CATEGORY: CategoryEditState = {
  name: '',
  slug: '',
  sort_order: 0,
  description: '',
  visible_on_website: true,
  active: true,
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialServices: ServiceRow[]
  initialCategories: ServiceCategoryRow[]
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ServicesCatalogueManager({ initialServices, initialCategories }: Props) {
  const [services, setServices] = useState<ServiceRow[]>(initialServices)
  const [categories, setCategories] = useState<ServiceCategoryRow[]>(initialCategories)

  const [editingService, setEditingService] = useState<ServiceEditState | null>(null)
  const [editingCategory, setEditingCategory] = useState<CategoryEditState | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')

  const [isPending, startTransition] = useTransition()
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  // Confirm-delete dialog state
  const [confirmDelete, setConfirmDelete] = useState<{ serviceId: string; hasHistory: boolean } | null>(null)

  function flash(type: 'ok' | 'err', msg: string) {
    setBanner({ type, msg })
    setTimeout(() => setBanner(null), 4000)
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const filteredServices = useMemo(() => {
    let list = services
    if (!showArchived) list = list.filter((s) => !s.archived_at)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q) ||
          (s.service_categories?.name ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [services, showArchived, search])

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceRow[]>()
    for (const s of filteredServices) {
      const key = s.service_categories?.name ?? 'Bez kategorie'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [filteredServices])

  const archivedCount = useMemo(() => services.filter((s) => !!s.archived_at).length, [services])

  // ── Service CRUD ──────────────────────────────────────────────────────────

  function openNewService() {
    setEditingService({
      ...EMPTY_SERVICE,
      sort_order: services.length * 10 + 10,
    })
  }

  function openEditService(s: ServiceRow) {
    setEditingService({
      id: s.id,
      title: s.title,
      description: s.description ?? '',
      price: s.price,
      unit: s.unit,
      slug: s.slug ?? '',
      standard: s.standard,
      active: s.active,
      show_on_web: s.show_on_web,
      available_in_reservation: s.available_in_reservation,
      sort_order: s.sort_order,
      category_id: s.category_id,
      internal_note: s.internal_note ?? '',
      custom_unit_label: s.custom_unit_label ?? '',
    })
  }

  function saveService() {
    if (!editingService) return
    if (!editingService.title.trim()) { flash('err', 'Název služby je povinný.'); return }
    startTransition(async () => {
      const result = await upsertServiceCatalogue({
        id: editingService.id,
        title: editingService.title,
        description: editingService.description,
        price: editingService.price,
        unit: editingService.unit,
        slug: editingService.slug,
        standard: editingService.standard,
        active: editingService.active,
        show_on_web: editingService.show_on_web,
        available_in_reservation: editingService.available_in_reservation,
        sort_order: editingService.sort_order,
        category_id: editingService.category_id,
        internal_note: editingService.internal_note,
        custom_unit_label: editingService.custom_unit_label,
      })
      if (!result.ok) { flash('err', result.error ?? 'Chyba při ukládání.'); return }
      flash('ok', editingService.id ? 'Služba uložena.' : 'Služba vytvořena.')
      setEditingService(null)
      // Optimistic update — refresh by mutating state
      if (editingService.id) {
        const cat = categories.find((c) => c.id === editingService.category_id) ?? null
        setServices((prev) =>
          prev.map((s) =>
            s.id === editingService.id
              ? {
                  ...s,
                  ...editingService,
                  archived_at: null,
                  service_categories: cat ? { id: cat.id, name: cat.name, slug: cat.slug } : null,
                }
              : s,
          ),
        )
      } else {
        // New service — will appear on next server refresh; trigger route refresh
        window.location.reload()
      }
    })
  }

  function handleArchive(serviceId: string) {
    startTransition(async () => {
      const result = await archiveService(serviceId)
      if (!result.ok) { flash('err', result.error ?? 'Chyba.'); return }
      flash('ok', 'Služba archivována.')
      setServices((prev) =>
        prev.map((s) =>
          s.id === serviceId ? { ...s, archived_at: new Date().toISOString(), active: false } : s,
        ),
      )
    })
  }

  function handleRestore(serviceId: string) {
    startTransition(async () => {
      const result = await restoreService(serviceId)
      if (!result.ok) { flash('err', result.error ?? 'Chyba.'); return }
      flash('ok', 'Služba obnovena.')
      setServices((prev) =>
        prev.map((s) =>
          s.id === serviceId ? { ...s, archived_at: null, active: true } : s,
        ),
      )
    })
  }

  function handleDeleteRequest(serviceId: string) {
    // Show confirmation with history note
    setConfirmDelete({ serviceId, hasHistory: false })
  }

  function handleDeleteConfirm() {
    if (!confirmDelete) return
    setConfirmDelete(null)
    startTransition(async () => {
      const result = await deleteServiceSafe(confirmDelete.serviceId)
      if (!result.ok) {
        flash('err', result.error ?? 'Nelze smazat.')
        return
      }
      flash('ok', 'Služba smazána.')
      setServices((prev) => prev.filter((s) => s.id !== confirmDelete.serviceId))
    })
  }

  // ── Category CRUD ─────────────────────────────────────────────────────────

  function openNewCategory() {
    setEditingCategory({ ...EMPTY_CATEGORY, sort_order: categories.length * 10 + 10 })
  }

  function openEditCategory(c: ServiceCategoryRow) {
    setEditingCategory({
      id: c.id,
      name: c.name,
      slug: c.slug,
      sort_order: c.sort_order,
      description: c.description ?? '',
      visible_on_website: c.visible_on_website,
      active: c.active,
    })
  }

  function saveCategory() {
    if (!editingCategory) return
    if (!editingCategory.name.trim()) { flash('err', 'Název kategorie je povinný.'); return }
    startTransition(async () => {
      const result = await upsertServiceCategory({
        id: editingCategory.id,
        name: editingCategory.name,
        slug: editingCategory.slug || editingCategory.name.toLowerCase().replace(/\s+/g, '-'),
        sort_order: editingCategory.sort_order,
        description: editingCategory.description,
        visible_on_website: editingCategory.visible_on_website,
        active: editingCategory.active,
      })
      if (!result.ok) { flash('err', result.error ?? 'Chyba.'); return }
      flash('ok', editingCategory.id ? 'Kategorie uložena.' : 'Kategorie vytvořena.')
      setEditingCategory(null)
      window.location.reload()
    })
  }

  function handleDeleteCategory(catId: number, catName: string) {
    const inUse = services.filter((s) => s.category_id === catId && !s.archived_at)
    if (inUse.length > 0) {
      flash('err', `Kategorie „${catName}" obsahuje ${inUse.length} aktivní službu. Nejdříve ji přesuňte nebo archivujte.`)
      return
    }
    if (!confirm(`Smazat kategorii „${catName}"?`)) return
    startTransition(async () => {
      const result = await deleteServiceCategory(catId)
      if (!result.ok) { flash('err', result.error ?? 'Chyba.'); return }
      flash('ok', 'Kategorie smazána.')
      setCategories((prev) => prev.filter((c) => c.id !== catId))
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Banner */}
      {banner && (
        <div
          className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            background: banner.type === 'ok' ? 'var(--admin-success-light, #dcfce7)' : 'var(--admin-danger-light, #fee2e2)',
            color: banner.type === 'ok' ? 'var(--admin-success, #166534)' : 'var(--admin-danger, #991b1b)',
          }}
        >
          {banner.msg}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Hledat službu…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm w-56 outline-none"
          style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
        />
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              background: showArchived ? 'var(--admin-accent-light)' : 'var(--admin-card)',
              color: showArchived ? 'var(--admin-accent)' : 'var(--admin-text-muted)',
              border: '1px solid var(--admin-card-border)',
            }}
          >
            {showArchived ? 'Skrýt archivované' : `Zobrazit archivované (${archivedCount})`}
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowCategories((v) => !v)}
            className="rounded-lg px-3 py-2 text-sm font-medium"
            style={{
              background: showCategories ? 'var(--admin-accent-light)' : 'var(--admin-card)',
              color: showCategories ? 'var(--admin-accent)' : 'var(--admin-text-muted)',
              border: '1px solid var(--admin-card-border)',
            }}
          >
            Kategorie
          </button>
          <button
            onClick={openNewService}
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--admin-accent)', color: '#fff' }}
          >
            + Přidat službu
          </button>
        </div>
      </div>

      {/* Category panel */}
      {showCategories && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--admin-card-border)', background: 'var(--admin-card)' }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--admin-card-border)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>
              Kategorie služeb
            </span>
            <button
              onClick={openNewCategory}
              className="text-xs font-medium px-2 py-1 rounded-lg"
              style={{ background: 'var(--admin-accent-light)', color: 'var(--admin-accent)' }}
            >
              + Přidat
            </button>
          </div>
          <div className="divide-y" style={{ '--tw-divide-color': 'var(--admin-card-border)' } as React.CSSProperties}>
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex-1 text-sm font-medium" style={{ color: 'var(--admin-text)' }}>
                  {cat.name}
                </span>
                <span className="text-xs tabular-nums" style={{ color: 'var(--admin-text-muted)' }}>
                  #{cat.sort_order}
                </span>
                {!cat.active && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#fee2e2', color: '#991b1b' }}>
                    Neaktivní
                  </span>
                )}
                {!cat.visible_on_website && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)' }}>
                    Skrytá na webu
                  </span>
                )}
                <button
                  onClick={() => openEditCategory(cat)}
                  className="text-xs font-medium"
                  style={{ color: 'var(--admin-accent)' }}
                >
                  Upravit
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  className="text-xs"
                  style={{ color: 'var(--admin-danger)' }}
                >
                  Smazat
                </button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="px-5 py-4 text-sm" style={{ color: 'var(--admin-text-muted)' }}>Žádné kategorie.</p>
            )}
          </div>
        </div>
      )}

      {/* Services grouped by category */}
      {grouped.size === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--admin-text-muted)' }}>
          {search ? 'Žádná shoda.' : 'Katalog je prázdný.'}
        </p>
      )}

      {[...grouped.entries()].map(([catName, items]) => (
        <div
          key={catName}
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--admin-card-border)', background: 'var(--admin-card)' }}
        >
          <div
            className="px-5 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ borderBottom: '1px solid var(--admin-card-border)', color: 'var(--admin-text-muted)' }}
          >
            {catName}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                  {['Název', 'Popis', 'Cena', 'Slug', 'Web', 'Rezervace', 'Aktivní', ''].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-medium whitespace-nowrap"
                      style={{ color: 'var(--admin-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <ServiceRow
                    key={s.id}
                    service={s}
                    onEdit={openEditService}
                    onArchive={handleArchive}
                    onRestore={handleRestore}
                    onDelete={handleDeleteRequest}
                    isPending={isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ── Service edit drawer ─── */}
      {editingService !== null && (
        <ServiceDrawer
          editing={editingService}
          categories={categories}
          onChange={setEditingService}
          onSave={saveService}
          onCancel={() => setEditingService(null)}
          isPending={isPending}
        />
      )}

      {/* ── Category edit modal ─── */}
      {editingCategory !== null && (
        <CategoryModal
          editing={editingCategory}
          onChange={setEditingCategory}
          onSave={saveCategory}
          onCancel={() => setEditingCategory(null)}
          isPending={isPending}
        />
      )}

      {/* ── Delete confirmation dialog ─── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-sm space-y-4"
            style={{ background: 'var(--admin-card)' }}
          >
            <h2 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)', color: 'var(--admin-text)' }}>
              Smazat službu?
            </h2>
            <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
              Pokud má služba historii rezervací, akce selže a nabídne archivaci. Tato operace je nevratná.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteConfirm}
                disabled={isPending}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--admin-danger)', color: '#fff' }}
              >
                {isPending ? 'Mažu…' : 'Smazat'}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg py-2.5 px-4 text-sm"
                style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-card-border)' }}
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Service row ──────────────────────────────────────────────────────────────

function ServiceRow({
  service: s,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  isPending,
}: {
  service: ServiceRow
  onEdit: (s: ServiceRow) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
  isPending: boolean
}) {
  const isArchived = !!s.archived_at

  return (
    <tr
      style={{
        borderBottom: '1px solid var(--admin-card-border)',
        opacity: isArchived ? 0.55 : 1,
      }}
    >
      {/* Name */}
      <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--admin-text)' }}>
        <div className="flex items-center gap-2">
          {s.title}
          {s.standard && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--admin-accent-light)', color: 'var(--admin-accent)' }}
            >
              Standard
            </span>
          )}
          {isArchived && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: '#fee2e2', color: '#991b1b' }}
            >
              Archiv
            </span>
          )}
        </div>
      </td>

      {/* Description */}
      <td
        className="px-4 py-3 text-xs max-w-[200px] truncate"
        style={{ color: 'var(--admin-text-muted)' }}
        title={s.description ?? undefined}
      >
        {s.description || '—'}
      </td>

      {/* Price */}
      <td className="px-4 py-3 tabular-nums font-semibold whitespace-nowrap" style={{ color: 'var(--admin-text)' }}>
        {formatCzk(s.price)}{' '}
        <span className="font-normal text-xs" style={{ color: 'var(--admin-text-muted)' }}>
          {unitDisplay(s.unit, s.custom_unit_label)}
        </span>
      </td>

      {/* Slug */}
      <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--admin-text-muted)' }}>
        {s.slug || '—'}
      </td>

      {/* show_on_web */}
      <td className="px-4 py-3">
        <Dot active={s.show_on_web} />
      </td>

      {/* available_in_reservation */}
      <td className="px-4 py-3">
        <Dot active={s.available_in_reservation} />
      </td>

      {/* active */}
      <td className="px-4 py-3">
        <Dot active={s.active} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-3">
          {!isArchived && (
            <button
              onClick={() => onEdit(s)}
              disabled={isPending}
              className="text-xs font-medium"
              style={{ color: 'var(--admin-accent)' }}
            >
              Upravit
            </button>
          )}
          {isArchived ? (
            <button
              onClick={() => onRestore(s.id)}
              disabled={isPending}
              className="text-xs font-medium"
              style={{ color: 'var(--admin-success)' }}
            >
              Obnovit
            </button>
          ) : (
            <button
              onClick={() => onArchive(s.id)}
              disabled={isPending}
              className="text-xs"
              style={{ color: 'var(--admin-text-muted)' }}
            >
              Archivovat
            </button>
          )}
          <button
            onClick={() => onDelete(s.id)}
            disabled={isPending}
            className="text-xs"
            style={{ color: 'var(--admin-danger)' }}
          >
            Smazat
          </button>
        </div>
      </td>
    </tr>
  )
}

function Dot({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex size-2.5 rounded-full"
      style={{ background: active ? 'var(--admin-success)' : 'var(--admin-text-muted)', opacity: active ? 1 : 0.35 }}
    />
  )
}

// ─── Service drawer (slide-in panel) ─────────────────────────────────────────

function ServiceDrawer({
  editing,
  categories,
  onChange,
  onSave,
  onCancel,
  isPending,
}: {
  editing: ServiceEditState
  categories: ServiceCategoryRow[]
  onChange: (s: ServiceEditState) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
}) {
  function set<K extends keyof ServiceEditState>(key: K, value: ServiceEditState[K]) {
    onChange({ ...editing, [key]: value })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="w-full max-w-lg h-full overflow-y-auto p-6 space-y-5 flex flex-col"
        style={{ background: 'var(--admin-card)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--admin-text)' }}
          >
            {editing.id ? 'Upravit službu' : 'Nová služba'}
          </h2>
          <button
            onClick={onCancel}
            className="text-xl leading-none"
            style={{ color: 'var(--admin-text-muted)' }}
            aria-label="Zavřít"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 space-y-4">

          <Field label="Název *">
            <input
              value={editing.title}
              onChange={(e) => set('title', e.target.value)}
              className={INPUT_CLS}
              style={INPUT_STYLE}
              placeholder="Noční pobyt"
            />
          </Field>

          <Field label="Popis">
            <textarea
              rows={3}
              value={editing.description}
              onChange={(e) => set('description', e.target.value)}
              className={`${INPUT_CLS} resize-none`}
              style={INPUT_STYLE}
              placeholder="Krátký popis pro zákazníka…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Cena (Kč)">
              <input
                type="number"
                min={0}
                value={editing.price}
                onChange={(e) => set('price', Number(e.target.value))}
                className={INPUT_CLS}
                style={INPUT_STYLE}
              />
            </Field>

            <Field label="Jednotka">
              <select
                value={editing.unit}
                onChange={(e) => set('unit', e.target.value)}
                className={INPUT_CLS}
                style={INPUT_STYLE}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Vlastní popis jednotky" hint={'Přepíše výchozí popis jednotky (např. „/ 1 výjezd\u201c). Nechte prázdné pro výchozí.'}>

            <input
              value={editing.custom_unit_label}
              onChange={(e) => set('custom_unit_label', e.target.value)}
              className={INPUT_CLS}
              style={INPUT_STYLE}
              placeholder="/ výjezd"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Kategorie">
              <select
                value={editing.category_id ?? ''}
                onChange={(e) => set('category_id', e.target.value ? Number(e.target.value) : null)}
                className={INPUT_CLS}
                style={INPUT_STYLE}
              >
                <option value="">Bez kategorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Pořadí">
              <input
                type="number"
                value={editing.sort_order}
                onChange={(e) => set('sort_order', Number(e.target.value))}
                className={INPUT_CLS}
                style={INPUT_STYLE}
              />
            </Field>
          </div>

          <Field label="Slug (URL identifikátor)" hint="Musí odpovídat hodnotě v kódu rezervačního formuláře. Např. overnight-stay.">
            <input
              value={editing.slug}
              onChange={(e) => set('slug', e.target.value)}
              className={INPUT_CLS}
              style={{ ...INPUT_STYLE, fontFamily: 'var(--font-mono)' } as React.CSSProperties}
              placeholder="overnight-stay"
            />
          </Field>

          <Field label="Interní poznámka" hint="Vidí pouze administrátor, nikdy zákazník.">
            <textarea
              rows={2}
              value={editing.internal_note}
              onChange={(e) => set('internal_note', e.target.value)}
              className={`${INPUT_CLS} resize-none`}
              style={INPUT_STYLE}
            />
          </Field>

          {/* Boolean toggles */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)' }}>
            {[
              { key: 'active' as const, label: 'Aktivní', hint: 'Neaktivní služby jsou skryty na webu i v rezervaci.' },
              { key: 'show_on_web' as const, label: 'Zobrazit na webu (ceník, pece-a-ubytovani)', hint: '' },
              { key: 'available_in_reservation' as const, label: 'Dostupná v rezervačním formuláři', hint: '' },
              { key: 'standard' as const, label: 'Zahrnuta v ceně pobytu (Standard)', hint: 'Standard služby se zobrazí v sekci „V ceně pobytu".' },
            ].map(({ key, label, hint }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing[key] as boolean}
                  onChange={(e) => set(key, e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium" style={{ color: 'var(--admin-text)' }}>{label}</span>
                  {hint && <p className="text-[11px] mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>{hint}</p>}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-2 border-t" style={{ borderColor: 'var(--admin-card-border)' }}>
          <button
            onClick={onSave}
            disabled={isPending}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ background: 'var(--admin-accent)', color: '#fff' }}
          >
            {isPending ? 'Ukládám…' : 'Uložit'}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg py-2.5 px-4 text-sm"
            style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-card-border)' }}
          >
            Zrušit
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Category modal ───────────────────────────────────────────────────────────

function CategoryModal({
  editing,
  onChange,
  onSave,
  onCancel,
  isPending,
}: {
  editing: CategoryEditState
  onChange: (c: CategoryEditState) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
}) {
  function set<K extends keyof CategoryEditState>(key: K, value: CategoryEditState[K]) {
    onChange({ ...editing, [key]: value })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-md space-y-4"
        style={{ background: 'var(--admin-card)' }}
      >
        <h2
          className="font-semibold text-lg"
          style={{ fontFamily: 'var(--font-serif)', color: 'var(--admin-text)' }}
        >
          {editing.id ? 'Upravit kategorii' : 'Nová kategorie'}
        </h2>

        <Field label="Název *">
          <input
            value={editing.name}
            onChange={(e) => set('name', e.target.value)}
            className={INPUT_CLS}
            style={INPUT_STYLE}
            placeholder="Ubytování"
          />
        </Field>

        <Field label="Slug" hint="Automaticky se vygeneruje z názvu. Lze ručně upravit.">
          <input
            value={editing.slug}
            onChange={(e) => set('slug', e.target.value)}
            className={INPUT_CLS}
            style={{ ...INPUT_STYLE, fontFamily: 'var(--font-mono)' } as React.CSSProperties}
            placeholder="ubytovani"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Pořadí">
            <input
              type="number"
              value={editing.sort_order}
              onChange={(e) => set('sort_order', Number(e.target.value))}
              className={INPUT_CLS}
              style={INPUT_STYLE}
            />
          </Field>
        </div>

        <Field label="Popis (volitelný)">
          <textarea
            rows={2}
            value={editing.description}
            onChange={(e) => set('description', e.target.value)}
            className={`${INPUT_CLS} resize-none`}
            style={INPUT_STYLE}
          />
        </Field>

        <div className="space-y-2">
          {[
            { key: 'active' as const, label: 'Aktivní' },
            { key: 'visible_on_website' as const, label: 'Viditelná na webu' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--admin-text)' }}>
              <input type="checkbox" checked={editing[key] as boolean} onChange={(e) => set(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onSave}
            disabled={isPending}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ background: 'var(--admin-accent)', color: '#fff' }}
          >
            {isPending ? 'Ukládám…' : 'Uložit'}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg py-2.5 px-4 text-sm"
            style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-card-border)' }}
          >
            Zrušit
          </button>
        </div>
      </div>
    </div>
  )
}
