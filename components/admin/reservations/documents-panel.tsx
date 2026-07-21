'use client'

/**
 * DocumentsPanel
 * Displayed on the reservation detail page.
 * Allows uploading PDFs/images, editing labels, viewing (signed URL), and deleting.
 */

import { useState, useRef, useTransition } from 'react'
import { updateReservationDocumentLabel } from '@/lib/admin/actions'

export interface ReservationDoc {
  id: string
  filename: string
  label: string | null
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

interface Props {
  reservationId: string
  initialDocs: ReservationDoc[]
}

function fmtBytes(n: number | null) {
  if (!n) return '—'
  if (n < 1024)           return `${n} B`
  if (n < 1024 * 1024)   return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function DocIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}

function DownloadIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

// ─── Single document row ──────────────────────────────────────────────────────
function DocRow({
  doc,
  onDelete,
}: {
  doc: ReservationDoc
  onDelete: (id: string) => void
}) {
  const [label, setLabel]   = useState(doc.label ?? '')
  const [editing, setEditing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isPending, startTransition]  = useTransition()
  const [confirmDel, setConfirmDel]   = useState(false)

  async function download() {
    setDownloading(true)
    try {
      const res  = await fetch(`/api/admin/reservation-documents?id=${doc.id}`)
      const json = await res.json()
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Chyba')
      const a = document.createElement('a')
      a.href     = json.url
      a.download = json.filename ?? doc.filename
      a.target   = '_blank'
      a.click()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Nelze stáhnout soubor')
    } finally {
      setDownloading(false)
    }
  }

  function saveLabel() {
    startTransition(async () => {
      await updateReservationDocumentLabel(doc.id, label.trim())
      setEditing(false)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/reservation-documents?id=${doc.id}`, { method: 'DELETE' })
      if (res.ok) onDelete(doc.id)
      else alert('Smazání selhalo')
      setConfirmDel(false)
    })
  }

  return (
    <div
      className="flex items-center gap-3 py-2.5 text-sm"
      style={{ borderBottom: '1px solid var(--admin-card-border)' }}
    >
      <DocIcon className="w-5 h-5 shrink-0 opacity-50" style={{ color: 'var(--admin-text-muted)' }} />

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              autoFocus
              className="flex-1 rounded px-2 py-1 text-xs"
              style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
              onKeyDown={e => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') setEditing(false) }}
            />
            <button onClick={saveLabel} disabled={isPending} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--admin-accent)', color: '#fff' }}>
              {isPending ? '…' : 'OK'}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>Zrušit</button>
          </div>
        ) : (
          <div>
            <p className="font-medium truncate" style={{ color: 'var(--admin-text)' }}>
              {label || doc.filename}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>
              {doc.mime_type ?? '—'} · {fmtBytes(doc.size_bytes)} ·{' '}
              {new Date(doc.created_at).toLocaleDateString('cs-CZ')}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={download}
          disabled={downloading}
          title="Stáhnout"
          className="p-1.5 rounded-lg disabled:opacity-50"
          style={{ color: 'var(--admin-text-muted)' }}
        >
          <DownloadIcon className="w-4 h-4" />
        </button>
        {!editing && (
          <button onClick={() => setEditing(true)} className="px-2 py-1 rounded text-[11px]"
            style={{ color: 'var(--admin-accent)' }}>
            Štítek
          </button>
        )}
        {confirmDel ? (
          <>
            <button onClick={handleDelete} disabled={isPending} className="px-2 py-1 rounded text-[11px] text-white bg-red-600 disabled:opacity-50">
              Smazat
            </button>
            <button onClick={() => setConfirmDel(false)} className="px-2 py-1 rounded text-[11px]"
              style={{ color: 'var(--admin-text-muted)' }}>
              Ne
            </button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} className="px-2 py-1 rounded text-[11px] text-red-500">
            Smazat
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Upload row ───────────────────────────────────────────────────────────────
function UploadRow({
  reservationId,
  onUploaded,
}: {
  reservationId: string
  onUploaded: (doc: ReservationDoc) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [label, setLabel] = useState('')
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
    if (!ALLOWED.has(file.type)) {
      setError('Nepodporovaný formát (PDF, JPEG, PNG, WEBP)')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Soubor je příliš velký (max 20 MB)')
      return
    }
    setError(null)
    setProgress(`Nahrávám ${file.name}…`)

    const fd = new FormData()
    fd.append('file',           file)
    fd.append('reservation_id', reservationId)
    if (label.trim()) fd.append('label', label.trim())

    const res  = await fetch('/api/admin/reservation-documents', { method: 'POST', body: fd })
    const json = await res.json()
    setProgress(null)
    if (!res.ok || !json.doc) { setError(json.error ?? 'Nahrávání selhalo'); return }
    onUploaded(json.doc as ReservationDoc)
    setLabel('')
  }

  return (
    <div className="pt-3">
      <div className="flex gap-2 items-center">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
        />
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Štítek (volitelné)"
          className="flex-1 rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!progress}
          className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--admin-accent)' }}
        >
          {progress ? progress : '+ Nahrát'}
        </button>
      </div>
      {error && <p className="text-xs mt-1 text-red-500">{error}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DocumentsPanel({ reservationId, initialDocs }: Props) {
  const [docs, setDocs] = useState(initialDocs)

  return (
    <div className="space-y-1">
      {docs.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--admin-text-muted)' }}>
          Žádné dokumenty
        </p>
      ) : (
        docs.map(doc => (
          <DocRow
            key={doc.id}
            doc={doc}
            onDelete={id => setDocs(prev => prev.filter(d => d.id !== id))}
          />
        ))
      )}
      <UploadRow
        reservationId={reservationId}
        onUploaded={doc => setDocs(prev => [...prev, doc])}
      />
    </div>
  )
}
