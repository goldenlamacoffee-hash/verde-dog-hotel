'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import Image from 'next/image'
import { upsertMediaAsset, deleteMediaAsset } from '@/lib/admin/actions'

interface MediaAsset {
  id: string
  filename: string
  storage_path: string
  public_url: string | null
  mime_type: string | null
  size_bytes: number | null
  alt: string | null
  tags: string[] | null
  created_at: string
}

interface Props {
  assets: MediaAsset[]
  total: number
  page: number
  limit: number
  search?: string
  tag?: string
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function fmt(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Add by URL dialog ────────────────────────────────────────────────────────
function AddUrlDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [url, setUrl] = useState('')
  const [filename, setFilename] = useState('')
  const [alt, setAlt] = useState('')
  const [tags, setTags] = useState('')
  const [err, setErr] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) { setErr('URL je povinné'); return }
    const name = filename.trim() || url.split('/').pop() || 'asset'
    startTransition(async () => {
      try {
        await upsertMediaAsset({
          filename: name,
          storage_path: url.trim(),
          public_url: url.trim(),
          alt: alt.trim() || null,
          tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        } as Parameters<typeof upsertMediaAsset>[0])
        router.refresh()
        onClose()
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Chyba')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--admin-text)' }}>Přidat médium (URL)</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--admin-text-muted)' }}>URL souboru *</label>
            <input
              value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/obrazek.jpg"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--admin-text-muted)' }}>Název souboru</label>
            <input
              value={filename} onChange={e => setFilename(e.target.value)}
              placeholder="hero-verde.jpg"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--admin-text-muted)' }}>Alt text</label>
            <input
              value={alt} onChange={e => setAlt(e.target.value)}
              placeholder="Popis pro screen readery"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--admin-text-muted)' }}>Tagy (čárkou oddělené)</label>
            <input
              value={tags} onChange={e => setTags(e.target.value)}
              placeholder="hero, galerie, int"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
            />
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-card-border)' }}>
              Zrušit
            </button>
            <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50" style={{ background: 'var(--admin-accent)' }}>
              {pending ? 'Ukládám…' : 'Přidat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Asset detail panel ────────────────────────────────────────────────────────
function AssetPanel({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [alt, setAlt] = useState(asset.alt ?? '')
  const [tags, setTags] = useState((asset.tags ?? []).join(', '))
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const url = asset.public_url ?? asset.storage_path

  function copyUrl() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleSave() {
    startTransition(async () => {
      await upsertMediaAsset({
        id: asset.id,
        filename: asset.filename,
        storage_path: asset.storage_path,
        public_url: asset.public_url ?? undefined,
        alt: alt.trim() || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      } as Parameters<typeof upsertMediaAsset>[0])
      router.refresh()
      onClose()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteMediaAsset(asset.id)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="w-full max-w-lg rounded-xl overflow-hidden" style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}>
        {/* Preview */}
        <div className="relative h-48 w-full" style={{ background: 'var(--admin-bg)' }}>
          {asset.mime_type?.startsWith('image/') || !asset.mime_type ? (
            <Image
              src={url}
              alt={asset.alt ?? asset.filename}
              fill
              className="object-contain"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <FileIcon className="w-12 h-12 opacity-30" />
            </div>
          )}
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-sm" style={{ color: 'var(--admin-text)' }}>{asset.filename}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>
                {asset.mime_type ?? 'unknown'} · {fmt(asset.size_bytes)}
              </p>
            </div>
            <button onClick={copyUrl} className="shrink-0 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: copied ? '#22c55e' : 'var(--admin-text)' }}>
              {copied ? 'Zkopírováno!' : 'Kopírovat URL'}
            </button>
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--admin-text-muted)' }}>Alt text</label>
            <input value={alt} onChange={e => setAlt(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--admin-text-muted)' }}>Tagy</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="hero, galerie, int" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }} />
          </div>

          <div className="flex gap-2 justify-between pt-1">
            {confirmDelete ? (
              <>
                <button onClick={handleDelete} disabled={pending} className="px-3 py-1.5 rounded-lg text-xs text-white bg-red-600 disabled:opacity-50">Smazat</button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: 'var(--admin-text-muted)' }}>Zrušit</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="px-3 py-1.5 rounded-lg text-xs text-red-500">Smazat</button>
            )}
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: 'var(--admin-text-muted)' }}>Zavřít</button>
              <button onClick={handleSave} disabled={pending} className="px-3 py-1.5 rounded-lg text-xs text-white disabled:opacity-50" style={{ background: 'var(--admin-accent)' }}>
                {pending ? 'Ukládám…' : 'Uložit'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export function MediaLibrary({ assets, total, page, limit, search, tag }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<MediaAsset | null>(null)

  const totalPages = Math.ceil(total / limit)

  function navigate(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams()
    const merged = { search, tag, page: String(page), ...params }
    Object.entries(merged).forEach(([k, v]) => { if (v) sp.set(k, v) })
    router.push(`${pathname}?${sp.toString()}`)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          defaultValue={search}
          placeholder="Hledat název…"
          className="rounded-lg px-3 py-2 text-sm w-56"
          style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
          onChange={e => navigate({ search: e.target.value || undefined, page: '1' })}
        />
        <input
          defaultValue={tag}
          placeholder="Filtr dle tagu…"
          className="rounded-lg px-3 py-2 text-sm w-40"
          style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
          onChange={e => navigate({ tag: e.target.value || undefined, page: '1' })}
        />
        <div className="ml-auto">
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-lg text-sm text-white"
            style={{ background: 'var(--admin-accent)' }}
          >
            + Přidat URL
          </button>
        </div>
      </div>

      {/* Grid */}
      {assets.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}>
          <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>Žádné soubory</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {assets.map(asset => {
            const url = asset.public_url ?? asset.storage_path
            const isImage = asset.mime_type?.startsWith('image/') || !asset.mime_type
            return (
              <button
                key={asset.id}
                onClick={() => setSelected(asset)}
                className="group relative aspect-square rounded-xl overflow-hidden text-left"
                style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}
              >
                {isImage ? (
                  <Image
                    src={url}
                    alt={asset.alt ?? asset.filename}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    unoptimized
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <FileIcon className="w-8 h-8 opacity-40" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
                     style={{ background: 'rgba(0,0,0,0.65)' }}>
                  <p className="text-[10px] text-white truncate">{asset.filename}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} z {total}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => navigate({ page: String(page - 1) })}
              className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
              style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
            >
              Předchozí
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => navigate({ page: String(page + 1) })}
              className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
              style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
            >
              Další
            </button>
          </div>
        </div>
      )}

      {addOpen && <AddUrlDialog onClose={() => setAddOpen(false)} />}
      {selected && <AssetPanel asset={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

// ─── Inline icon ──────────────────────────────────────────────────────────────
function FileIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}
