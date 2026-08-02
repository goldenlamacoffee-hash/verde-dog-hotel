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
import { ChevronUp, ChevronDown } from 'lucide-react'
import {
  upsertServiceCatalogue,
  archiveService,
  restoreService,
  deleteServiceSafe,
  reorderServices,
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
  /** Optimistic-concurrency version from DB — must be sent on update. */
  revision: number
  title: string
  description: string
  /** Stored as string while editing to allow "", "2500", "2500,50" etc. */
  price: string
  unit: string
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
  revision: 1,
  title: '',
  description: '',
  price: '',
  unit: 'night',
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
  /** Set when a concurrent-edit conflict is detected — shows a sticky reload prompt. */
  const [conflictBanner, setConflictBanner] = useState<string | null>(null)

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
      revision: s.revision ?? 1,
      title: s.title,
      description: s.description ?? '',
      price: String(s.price),
      unit: s.unit,
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

    // Normalize price string: trim, replace Czech comma decimal separator
    const normalizedPrice = editingService.price.trim().replace(',', '.')
    const priceAmount = Number(normalizedPrice)
    if (normalizedPrice === '' || !Number.isFinite(priceAmount) || priceAmount < 0) {
      flash('err', 'Zadejte platnou cenu.')
      return
    }

    startTransition(async () => {
      const result = await upsertServiceCatalogue({
        id: editingService.id,
        revision: editingService.revision,
        title: editingService.title,
        description: editingService.description,
        price: priceAmount,
        unit: editingService.unit,
        standard: editingService.standard,
        active: editingService.active,
        show_on_web: editingService.show_on_web,
        available_in_reservation: editingService.available_in_reservation,
        sort_order: editingService.sort_order,
        category_id: editingService.category_id,
        internal_note: editingService.internal_note,
        custom_unit_label: editingService.custom_unit_label,
      })
      if (!result.ok) {
        if (result.code === 'CONFLICT') {
          setEditingService(null)
          setConflictBanner(result.error ?? 'Konflikt úprav — načtěte stránku znovu.')
        } else {
          flash('err', result.error ?? 'Chyba při ukládání.')
        }
        return
      }
      flash('ok', editingService.id ? 'Služba uložena.' : 'Služba vytvořena.')
      setEditingService(null)
      if (editingService.id) {
        const cat = categories.find((c) => c.id === editingService.category_id) ?? null
        const newRevision = result.data?.revision ?? editingService.revision + 1
        // If the service was previously standard and is no longer, or a new standard was set,
        // demote old standard item in local state too
        const settingStandard = editingService.standard && editingService.active
        setServices((prev) =>
          prev.map((s) => {
            if (s.id === editingService.id) {
              return {
                ...s,
                ...editingService,
                // price is stored as string in edit state; ServiceRow expects number
                price: priceAmount,
                revision: newRevision,
                archived_at: null,
                service_categories: cat ? { id: cat.id, name: cat.name, slug: cat.slug } : null,
              }
            }
            // Demote any other standard service in optimistic state
            if (settingStandard && s.standard && s.active && !s.archived_at) {
              return { ...s, standard: false }
            }
            return s
          }),
        )
      } else {
        window.location.reload()
      }
    })
  }

  function handleArchive(serviceId: string) {
    const svc = services.find((s) => s.id === serviceId)
    startTransition(async () => {
      const result = await archiveService(serviceId, svc?.revision ?? 1)
      if (!result.ok) {
        if (result.code === 'CONFLICT') {
          setConflictBanner(result.error ?? 'Konflikt úprav — načtěte stránku znovu.')
        } else {
          flash('err', result.error ?? 'Chyba.')
        }
        return
      }
      flash('ok', 'Služba archivována.')
      setServices((prev) =>
        prev.map((s) =>
          s.id === serviceId
            ? { ...s, archived_at: new Date().toISOString(), active: false, revision: (s.revision ?? 1) + 1 }
            : s,
        ),
      )
    })
  }

  function handleRestore(serviceId: string) {
    const svc = services.find((s) => s.id === serviceId)
    startTransition(async () => {
      const result = await restoreService(serviceId, svc?.revision ?? 1)
      if (!result.ok) {
        if (result.code === 'CONFLICT') {
          setConflictBanner(result.error ?? 'Konflikt úprav — načtěte stránku znovu.')
        } else {
          flash('err', result.error ?? 'Chyba.')
        }
        return
      }
      flash('ok', 'Služba obnovena.')
      setServices((prev) =>
        prev.map((s) =>
          s.id === serviceId
            ? { ...s, archived_at: null, active: true, revision: (s.revision ?? 1) + 1 }
            : s,
        ),
      )
    })
  }

  function handleMoveService(serviceId: string, direction: 'up' | 'down') {
    // Find all visible services in the same category group (sorted by sort_order)
    const svc = services.find((s) => s.id === serviceId)
    if (!svc) return
    const siblings = services
      .filter((s) => s.category_id === svc.category_id && !s.archived_at)
      .sort((a, b) => a.sort_order - b.sort_order)
    const idx = siblings.findIndex((s) => s.id === serviceId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const target = siblings[swapIdx]
    const swappedA = { id: serviceId, sort_order: target.sort_order }
    const swappedB = { id: target.id, sort_order: svc.sort_order }
    startTransition(async () => {
      const result = await reorderServices([swappedA, swappedB])
      if (!result.ok) { flash('err', result.error ?? 'Chyba při řazení.'); return }
      setServices((prev) =>
        prev.map((s) => {
          if (s.id === serviceId) return { ...s, sort_order: target.sort_order }
          if (s.id === target.id) return { ...s, sort_order: svc.sort_order }
          return s
        }),
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

  // ── Render ───────────────────────────────────────────────────────���────────

  return (
    <div className="space-y-5">

      {/* Conflict banner — sticky, requires explicit reload */}
      {conflictBanner && (
        <div
          className="rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4"
          style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b' }}
        >
          <span className="font-medium">{conflictBanner}</span>
          <button
            onClick={() => window.location.reload()}
            className="shrink-0 rounded-lg px-3 py-1 text-xs font-semibold"
            style={{ background: '#f59e0b', color: '#fff' }}
          >
            Načíst znovu
          </button>
        </div>
      )}

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
                  {['', 'Název', 'Popis', 'Cena', 'Slug', 'Web', 'Rezervace', 'Aktivní', ''].map((h) => (
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
                {[...items].sort((a, b) => a.sort_order - b.sort_order).map((s, idx, arr) => (
                  <ServiceRow
                    key={s.id}
                    service={s}
                    onEdit={openEditService}
                    onArchive={handleArchive}
                    onRestore={handleRestore}
                    onDelete={handleDeleteRequest}
                    onMove={handleMoveService}
                    isFirst={idx === 0}
                    isLast={idx === arr.length - 1}
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
          currentSlug={editingService.id
            ? (services.find((s) => s.id === editingService.id)?.slug ?? null)
            : null}
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
  onMove,
  isFirst,
  isLast,
  isPending,
}: {
  service: ServiceRow
  onEdit: (s: ServiceRow) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, dir: 'up' | 'down') => void
  isFirst: boolean
  isLast: boolean
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
          {/* Reorder buttons */}
          {!isArchived && (
            <div className="flex flex-col">
              <button
                onClick={() => onMove(s.id, 'up')}
                disabled={isPending || isFirst}
                className="disabled:opacity-20"
                aria-label="Posunout nahoru"
                title="Posunout nahoru"
              >
                <ChevronUp className="size-3.5" style={{ color: 'var(--admin-text-muted)' }} />
              </button>
              <button
                onClick={() => onMove(s.id, 'down')}
                disabled={isPending || isLast}
                className="disabled:opacity-20"
                aria-label="Posunout dolů"
                title="Posunout dolů"
              >
                <ChevronDown className="size-3.5" style={{ color: 'var(--admin-text-muted)' }} />
              </button>
            </div>
          )}
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
  currentSlug,
  onChange,
  onSave,
  onCancel,
  isPending,
}: {
  editing: ServiceEditState
  categories: ServiceCategoryRow[]
  /** Existing slug for the service being edited — read-only display. */
  currentSlug?: string | null
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

          {/* Read-only slug — generated server-side on create, immutable on edit */}
          {editing.id && currentSlug && (
            <Field
              label="Slug (URL identifikátor)"
              hint="Generováno automaticky při vytvoření. Nelze změnit — zachovává stabilní URL."
            >
              <p
                className="rounded-lg px-3 py-2 text-sm select-all"
                style={{ ...INPUT_STYLE, color: 'var(--admin-text-muted)', fontFamily: 'var(--font-mono)', cursor: 'text' }}
              >
                {currentSlug}
              </p>
            </Field>
          )}

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
                type="text"
                inputMode="decimal"
                value={editing.price}
                onChange={(e) => set('price', e.target.value)}
                className={INPUT_CLS}
                style={INPUT_STYLE}
                placeholder="0"
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
              {
                key: 'standard' as const,
                label: 'Zahrnuta v ceně pobytu (Standard)',
                hint: 'Standard služby se zobrazí v sekci „V ceně pobytu". Může existovat pouze jedna — předchozí standardní položka bude automaticky odznačena.',
              },
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
