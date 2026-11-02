'use client'

import { useId, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ImageIcon, Plus, Trash2 } from 'lucide-react'
import { MediaPickerModal } from '@/components/admin/media/media-picker-modal'
import type { FieldDef } from '@/lib/admin/cms-config'
import './cms.css'

type Obj = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

// ─── Labelled wrapper ────────────────────────────────────────────────────────

export function FieldShell({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium" style={{ color: 'var(--admin-text)' }}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}

export function TextInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  inputMode?: 'numeric' | 'tel' | 'email' | 'url' | 'text'
}) {
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        className="cms-input"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    </FieldShell>
  )
}

export function TextAreaInput({
  label,
  hint,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
}) {
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        className="cms-input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    </FieldShell>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="cms-switch"
      onClick={() => onChange(!checked)}
    />
  )
}

// ─── Image ───────────────────────────────────────────────────────────────────

function fileNameFromUrl(url: string) {
  try {
    const last = new URL(url, 'http://x').pathname.split('/').filter(Boolean).pop() ?? ''
    return decodeURIComponent(last)
  } catch {
    return url
  }
}

export function ImageInput({
  label,
  value,
  onChange,
  alt,
  onAltChange,
  hasAlt,
  uploadable,
}: {
  label: string
  value: string
  onChange: (url: string) => void
  alt?: string
  onAltChange?: (alt: string) => void
  hasAlt?: boolean
  uploadable?: boolean
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const altId = useId()

  async function handleUpload(file: File) {
    if (!file.type.startsWith('image/')) return setUploadError('Nahrajte prosím obrázek.')
    if (file.size > 10 * 1024 * 1024) return setUploadError('Soubor je větší než 10 MB.')
    setUploadError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('alt_text', label)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json.asset) throw new Error(json.error ?? 'Nahrání se nezdařilo')
      onChange(json.asset.public_url as string)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Nahrání se nezdařilo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium" style={{ color: 'var(--admin-text)' }}>
        {label}
      </p>
      <div
        className="flex flex-col gap-4 rounded-xl p-3 sm:flex-row sm:items-start"
        style={{ border: '1px solid var(--admin-card-border)', background: 'var(--admin-bg)' }}
      >
        <div
          className="flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg sm:w-40"
          style={{ background: '#e8ebe9', border: '1px solid var(--admin-card-border)' }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value || '/placeholder.svg'} alt={alt || ''} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="size-7" style={{ color: 'var(--admin-text-muted)' }} aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="truncate text-sm" style={{ color: value ? 'var(--admin-text)' : 'var(--admin-text-muted)' }}>
            {value ? fileNameFromUrl(value) : 'Obrázek není vybrán'}
          </p>
          {hasAlt && (
            <div className="space-y-1">
              <label htmlFor={altId} className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>
                Popis obrázku (alt text)
              </label>
              <input
                id={altId}
                className="cms-input"
                value={alt ?? ''}
                placeholder="Stručně popište, co je na fotografii"
                onChange={e => onAltChange?.(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="cms-btn cms-btn-secondary cms-btn-sm" onClick={() => setPickerOpen(true)}>
              {value ? 'Změnit obrázek' : 'Vybrat obrázek'}
            </button>
            {uploadable && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  tabIndex={-1}
                  aria-label={`Nahrát soubor: ${label}`}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(f)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  className="cms-btn cms-btn-secondary cms-btn-sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? 'Nahrávám…' : 'Nahrát nový'}
                </button>
              </>
            )}
            {value && (
              <button type="button" className="cms-btn cms-btn-danger cms-btn-sm" onClick={() => onChange('')}>
                Odebrat obrázek
              </button>
            )}
          </div>
          {uploadError && (
            <p className="text-xs" role="alert" style={{ color: 'var(--admin-danger)' }}>
              {uploadError}
            </p>
          )}
        </div>
      </div>
      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={asset => {
          onChange(asset.public_url)
          if (hasAlt && !alt && asset.alt) onAltChange?.(asset.alt)
        }}
      />
    </div>
  )
}

// ─── String list ─────────────────────────────────────────────────────────────

function ListInput({
  label,
  hint,
  itemLabel,
  addLabel,
  multiline,
  value,
  onChange,
}: {
  label: string
  hint?: string
  itemLabel: string
  addLabel: string
  multiline?: boolean
  value: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--admin-text)' }}>
          {label}
        </p>
        {hint && (
          <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
            {hint}
          </p>
        )}
      </div>
      <ul className="space-y-2">
        {value.map((item, i) => (
          <li key={i} className="flex items-start gap-1">
            {multiline ? (
              <textarea
                aria-label={`${itemLabel} ${i + 1}`}
                className="cms-input"
                rows={3}
                value={item}
                onChange={e => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
              />
            ) : (
              <input
                aria-label={`${itemLabel} ${i + 1}`}
                className="cms-input"
                value={item}
                onChange={e => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
              />
            )}
            <RowControls
              index={i}
              count={value.length}
              onMove={dir => onChange(move(value, i, i + dir))}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
              what={`${itemLabel} ${i + 1}`}
            />
          </li>
        ))}
      </ul>
      <button type="button" className="cms-btn cms-btn-secondary cms-btn-sm" onClick={() => onChange([...value, ''])}>
        <Plus className="size-4" aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  )
}

function RowControls({
  index,
  count,
  onMove,
  onRemove,
  what,
}: {
  index: number
  count: number
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  what: string
}) {
  return (
    <div className="flex shrink-0 items-center">
      <button type="button" className="cms-icon-btn" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Posunout nahoru: ${what}`}>
        <ArrowUp className="size-4" />
      </button>
      <button type="button" className="cms-icon-btn" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Posunout dolů: ${what}`}>
        <ArrowDown className="size-4" />
      </button>
      <button type="button" className="cms-icon-btn" onClick={onRemove} aria-label={`Smazat: ${what}`} style={{ color: 'var(--admin-danger)' }}>
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}

// ─── Repeatable cards ────────────────────────────────────────────────────────

function blankItem(fields: FieldDef[], siblings: Obj[]): Obj {
  const item: Obj = {}
  for (const f of fields) if ('key' in f) item[f.key] = f.type === 'list' ? [] : f.type === 'cards' ? [] : f.type === 'object' ? {} : ''
  // Carry over non-editable keys (e.g. an icon name) so new items render like existing ones.
  const last = siblings[siblings.length - 1]
  if (last && typeof last.icon === 'string' && !('icon' in item)) item.icon = last.icon
  return item
}

function CardsInput({
  def,
  value,
  onChange,
}: {
  def: Extract<FieldDef, { type: 'cards' }>
  value: Obj[]
  onChange: (v: Obj[]) => void
}) {
  const [closed, setClosed] = useState<Set<number>>(() => new Set(value.length > 5 ? value.map((_, i) => i) : []))

  function toggle(i: number) {
    setClosed(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--admin-text)' }}>
          {def.label}
        </p>
        {def.hint && (
          <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
            {def.hint}
          </p>
        )}
      </div>
      <ul className="space-y-2">
        {value.map((item, i) => {
          const isOpen = !closed.has(i)
          const title = def.titleKey ? str(item[def.titleKey]) : ''
          return (
            <li key={i} className="rounded-xl" style={{ border: '1px solid var(--admin-card-border)', background: 'var(--admin-bg)' }}>
              <div className="flex items-center gap-1 pr-1">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm"
                  aria-expanded={isOpen}
                  onClick={() => toggle(i)}
                >
                  <ChevronDown
                    className="size-4 shrink-0 transition-transform"
                    style={{ transform: isOpen ? undefined : 'rotate(-90deg)', color: 'var(--admin-text-muted)' }}
                    aria-hidden="true"
                  />
                  <span className="shrink-0 font-medium" style={{ color: 'var(--admin-text-muted)' }}>
                    {def.itemLabel} {i + 1}
                  </span>
                  {title && (
                    <span className="truncate" style={{ color: 'var(--admin-text)' }}>
                      {title}
                    </span>
                  )}
                </button>
                <RowControls
                  index={i}
                  count={value.length}
                  onMove={dir => {
                    onChange(move(value, i, i + dir))
                    setClosed(new Set())
                  }}
                  onRemove={() => {
                    onChange(value.filter((_, j) => j !== i))
                    setClosed(new Set())
                  }}
                  what={`${def.itemLabel} ${i + 1}`}
                />
              </div>
              {isOpen && (
                <div className="border-t px-3 py-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card)', borderRadius: '0 0 0.75rem 0.75rem' }}>
                  <SchemaForm
                    fields={def.fields}
                    value={item}
                    onChange={next => onChange(value.map((v, j) => (j === i ? next : v)))}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className="cms-btn cms-btn-secondary cms-btn-sm"
        onClick={() => onChange([...value, blankItem(def.fields, value)])}
      >
        <Plus className="size-4" aria-hidden="true" />
        {def.addLabel}
      </button>
    </div>
  )
}

// ─── Schema form ─────────────────────────────────────────────────────────────

function isHalf(f: FieldDef) {
  return f.type === 'text' && f.half
}

export function SchemaForm({
  fields,
  value,
  onChange,
}: {
  fields: FieldDef[]
  value: Obj
  onChange: (next: Obj) => void
}) {
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v })

  const rows: FieldDef[][] = []
  for (const f of fields) {
    const last = rows[rows.length - 1]
    if (isHalf(f) && last && isHalf(last[0])) last.push(f)
    else rows.push([f])
  }

  return (
    <div className="space-y-5">
      {rows.map((row, ri) => (
        <div key={ri} className={row.length > 1 ? 'grid gap-4 sm:grid-cols-2' : undefined}>
          {row.map((f, fi) => (
            <FieldRenderer key={'key' in f ? f.key : `${f.prefix}-${fi}`} def={f} value={value} set={set} onChange={onChange} />
          ))}
        </div>
      ))}
    </div>
  )
}

function FieldRenderer({
  def,
  value,
  set,
  onChange,
}: {
  def: FieldDef
  value: Obj
  set: (key: string, v: unknown) => void
  onChange: (next: Obj) => void
}) {
  switch (def.type) {
    case 'text':
      return <TextInput label={def.label} hint={def.hint} value={str(value[def.key])} onChange={v => set(def.key, v)} />
    case 'textarea':
      return <TextAreaInput label={def.label} hint={def.hint} rows={def.rows} value={str(value[def.key])} onChange={v => set(def.key, v)} />
    case 'image':
      return (
        <ImageInput
          label={def.label}
          value={str(value[def.key])}
          onChange={v => set(def.key, v)}
          hasAlt={!!def.altKey}
          alt={def.altKey ? str(value[def.altKey]) : undefined}
          onAltChange={a => def.altKey && set(def.altKey, a)}
        />
      )
    case 'list':
      return (
        <ListInput
          label={def.label}
          hint={def.hint}
          itemLabel={def.itemLabel}
          addLabel={def.addLabel}
          multiline={def.multiline}
          value={Array.isArray(value[def.key]) ? (value[def.key] as unknown[]).map(str) : []}
          onChange={v => set(def.key, v)}
        />
      )
    case 'cards':
      return (
        <CardsInput
          def={def}
          value={Array.isArray(value[def.key]) ? (value[def.key] as Obj[]) : []}
          onChange={v => set(def.key, v)}
        />
      )
    case 'object':
      return (
        <fieldset className="space-y-3 rounded-xl p-4" style={{ border: '1px solid var(--admin-card-border)' }}>
          <legend className="px-1 text-sm font-medium" style={{ color: 'var(--admin-text)' }}>
            {def.label}
          </legend>
          <SchemaForm
            fields={def.fields}
            value={(value[def.key] as Obj) ?? {}}
            onChange={next => set(def.key, next)}
          />
        </fieldset>
      )
    case 'flatCards':
      return <FlatCards def={def} value={value} onChange={onChange} />
  }
}

/** Cards stored as indexed flat keys, e.g. card_0_title, card_0_image. */
function FlatCards({
  def,
  value,
  onChange,
}: {
  def: Extract<FieldDef, { type: 'flatCards' }>
  value: Obj
  onChange: (next: Obj) => void
}) {
  const cards = Array.from({ length: def.count }, (_, i) => i)

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" style={{ color: 'var(--admin-text)' }}>
        {def.label}
      </p>
      <div className="space-y-3">
        {cards.map(i => {
          const scoped = (k: string) => `${def.prefix}_${i}_${k}`
          const view: Obj = {}
          const mapped: FieldDef[] = def.fields.map(f => {
            if (f.type === 'image') {
              view[f.key] = value[scoped(f.key)]
              if (f.altKey) view[f.altKey] = value[scoped(f.altKey)]
            } else if ('key' in f) {
              view[f.key] = value[scoped(f.key)]
            }
            return f
          })
          return (
            <div key={i} className="rounded-xl p-4" style={{ border: '1px solid var(--admin-card-border)', background: 'var(--admin-bg)' }}>
              <p className="mb-3 text-sm font-medium" style={{ color: 'var(--admin-text-muted)' }}>
                {def.itemLabel} {i + 1}
              </p>
              <SchemaForm
                fields={mapped}
                value={view}
                onChange={next => {
                  const out: Obj = { ...value }
                  for (const [k, v] of Object.entries(next)) out[scoped(k)] = v
                  onChange(out)
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
