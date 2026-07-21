'use client'

/**
 * MediaPickerModal
 * Opens a dialog with the MediaLibrary in picker mode.
 * The caller supplies an `onSelect` callback that receives the chosen MediaAsset.
 * If the media page is not pre-fetched, we fetch the first page client-side.
 */

import { useState, useEffect, useTransition, useCallback } from 'react'
import { MediaLibrary, type MediaAsset } from './media-library'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (asset: MediaAsset) => void
}

export function MediaPickerModal({ open, onClose, onSelect }: Props) {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [total, setTotal]   = useState(0)
  const [page]              = useState(1)
  const LIMIT               = 48
  const [loading, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)

  // Fetch on open
  const loadAssets = useCallback(() => {
    startTransition(async () => {
      try {
        const res  = await fetch(`/api/admin/media-assets?limit=${LIMIT}&offset=0`)
        if (!res.ok) throw new Error(await res.text())
        const json = await res.json()
        setAssets(json.assets ?? [])
        setTotal(json.total ?? 0)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Chyba načítání')
      }
    })
  }, [])

  useEffect(() => {
    if (open) loadAssets()
  }, [open, loadAssets])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
             style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
          <h2 className="font-semibold text-base" style={{ fontFamily: 'var(--font-serif)', color: 'var(--admin-text)' }}>
            Vybrat fotografii z knihovny
          </h2>
          <button onClick={onClose} className="text-lg leading-none p-1 rounded"
            style={{ color: 'var(--admin-text-muted)' }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <span className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>Načítám…</span>
            </div>
          )}
          {error && (
            <div className="py-8 text-center">
              <p className="text-sm text-red-500">{error}</p>
              <button onClick={loadAssets} className="mt-3 text-xs" style={{ color: 'var(--admin-accent)' }}>
                Zkusit znovu
              </button>
            </div>
          )}
          {!loading && !error && (
            <MediaLibrary
              assets={assets}
              total={total}
              page={page}
              limit={LIMIT}
              onSelect={asset => { onSelect(asset); onClose() }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
