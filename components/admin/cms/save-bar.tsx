'use client'

import { AlertCircle, Check, Loader2 } from 'lucide-react'
import type { EditorStatus } from './use-editor'
import './cms.css'

interface SaveBarProps {
  dirty: boolean
  saving: boolean
  status: EditorStatus
  error: string | null
  onSave: () => void
  onCancel: () => void
  disabled?: boolean
}

export function SaveBar({ dirty, saving, status, error, onSave, onCancel, disabled }: SaveBarProps) {
  const visible = dirty || saving || status !== 'idle'
  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Uložení změn"
      className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 pt-2 lg:left-60"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-lg"
        style={{
          pointerEvents: 'auto',
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
      >
        <p
          className="flex items-center gap-2 text-sm font-medium"
          aria-live="polite"
          style={{
            color:
              status === 'error'
                ? 'var(--admin-danger)'
                : status === 'saved' && !dirty
                  ? 'var(--admin-success)'
                  : 'var(--admin-text)',
          }}
        >
          {status === 'error' ? (
            <>
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {error ?? 'Uložení se nezdařilo'}
            </>
          ) : status === 'saved' && !dirty ? (
            <>
              <Check className="size-4 shrink-0" aria-hidden="true" />
              Změny uloženy
            </>
          ) : (
            <>
              <span
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ background: 'var(--admin-warning)' }}
                aria-hidden="true"
              />
              Neuložené změny
            </>
          )}
        </p>
        {(dirty || saving) && (
          <div className="flex items-center gap-2">
            <button type="button" className="cms-btn cms-btn-secondary" onClick={onCancel} disabled={saving}>
              Zrušit
            </button>
            <button type="button" className="cms-btn cms-btn-primary" onClick={onSave} disabled={saving || disabled}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Uložit změny
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
