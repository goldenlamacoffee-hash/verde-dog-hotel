'use client'

import { useState, useTransition, useCallback } from 'react'
import { Loader2, RotateCcw, Save, AlertTriangle } from 'lucide-react'
import { updateSiteSetting } from '@/lib/admin/actions'
import type { CalendarAppearance } from '@/lib/types'
import { CALENDAR_APPEARANCE_DEFAULTS } from '@/lib/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidHex(v: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v)
}

/**
 * Calculate WCAG relative luminance for a hex color.
 * Returns a value in [0, 1].
 */
function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h

  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255

  const linearize = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4

  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/** WCAG 2.1 contrast ratio between two hex colors. */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker  = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ─── Field definitions ───────────────────────────────────────────────────────

interface FieldDef {
  key: keyof CalendarAppearance
  label: string
  bgKey?: keyof CalendarAppearance  // paired bg key for contrast checking
}

const FIELD_GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Volno',
    fields: [
      { key: 'availableBackground', label: 'Pozadí', bgKey: undefined },
      { key: 'availableText',       label: 'Text',   bgKey: 'availableBackground' },
    ],
  },
  {
    title: 'Zbývají místa',
    fields: [
      { key: 'limitedBackground', label: 'Pozadí', bgKey: undefined },
      { key: 'limitedText',       label: 'Text',   bgKey: 'limitedBackground' },
    ],
  },
  {
    title: 'Poslední místo',
    fields: [
      { key: 'lastBackground', label: 'Pozadí', bgKey: undefined },
      { key: 'lastText',       label: 'Text',   bgKey: 'lastBackground' },
    ],
  },
  {
    title: 'Plně obsazeno',
    fields: [
      { key: 'fullBackground', label: 'Pozadí', bgKey: undefined },
      { key: 'fullText',       label: 'Text',   bgKey: 'fullBackground' },
    ],
  },
  {
    title: 'Vybraný termín',
    fields: [
      { key: 'selectedBackground', label: 'Pozadí', bgKey: undefined },
      { key: 'selectedText',       label: 'Text',   bgKey: 'selectedBackground' },
    ],
  },
  {
    title: 'Rozsah pobytu',
    fields: [
      { key: 'rangeBackground', label: 'Pozadí', bgKey: undefined },
    ],
  },
  {
    title: 'Dnešní datum',
    fields: [
      { key: 'todayBorder', label: 'Orámování', bgKey: undefined },
    ],
  },
  {
    title: 'Dočasně nedostupné',
    fields: [
      { key: 'closedBackground', label: 'Pozadí', bgKey: undefined },
      { key: 'closedText',       label: 'Text',   bgKey: 'closedBackground' },
    ],
  },
  {
    title: 'Neuvolněno k rezervaci',
    fields: [
      { key: 'unreleasedBackground', label: 'Pozadí', bgKey: undefined },
      { key: 'unreleasedText',       label: 'Text',   bgKey: 'unreleasedBackground' },
    ],
  },
]

// ─── Single color row ─────────────────────────────────────────────────────────

interface ColorRowProps {
  fieldLabel: string
  value: string
  bgForContrast?: string
  onChange: (val: string) => void
}

function ColorRow({ fieldLabel, value, bgForContrast, onChange }: ColorRowProps) {
  const [rawInput, setRawInput] = useState(value)
  const valid = isValidHex(rawInput)

  // Warn if contrast < 3.0 (relaxed — admin is just alerted, not blocked)
  const contrastWarn = valid && bgForContrast && isValidHex(bgForContrast)
    ? contrastRatio(rawInput, bgForContrast) < 3.0
    : false

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setRawInput(v)
    if (isValidHex(v)) onChange(v)
  }

  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value  // native color picker always gives #rrggbb
    setRawInput(v)
    onChange(v)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Label */}
      <span className="w-16 shrink-0 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
        {fieldLabel}
      </span>

      {/* Color swatch + native picker */}
      <div className="relative flex-shrink-0">
        <div
          className="size-7 rounded-md border cursor-pointer overflow-hidden"
          style={{
            backgroundColor: valid ? rawInput : '#cccccc',
            borderColor: 'var(--admin-card-border)',
          }}
        >
          <input
            type="color"
            value={valid ? rawInput : '#cccccc'}
            onChange={handlePickerChange}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={fieldLabel}
          />
        </div>
      </div>

      {/* HEX text input */}
      <input
        type="text"
        value={rawInput}
        onChange={handleTextChange}
        maxLength={7}
        placeholder="#RRGGBB"
        spellCheck={false}
        className="w-24 rounded-lg border px-2 py-1 text-xs font-mono"
        style={{
          background: 'var(--admin-bg)',
          borderColor: valid ? 'var(--admin-card-border)' : '#dc2626',
          color: 'var(--admin-text)',
        }}
        aria-invalid={!valid}
        aria-describedby={!valid ? `${fieldLabel}-error` : undefined}
      />

      {/* Validation / contrast feedback */}
      {!valid && (
        <span id={`${fieldLabel}-error`} className="text-xs text-red-600">
          Neplatná barva
        </span>
      )}
      {valid && contrastWarn && (
        <span className="flex items-center gap-1 text-xs" style={{ color: '#d97706' }}>
          <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
          Nízký kontrast
        </span>
      )}
    </div>
  )
}

// ─── Live preview ─────────────────────────────────────────────────────────────

interface PreviewProps {
  app: CalendarAppearance
}

function CalendarPreview({ app }: PreviewProps) {
  const previewCells = [
    { day: 24, bg: app.availableBackground,  text: app.availableText,  indicator: null, label: 'Volno' },
    { day: 25, bg: app.limitedBackground,    text: app.limitedText,    indicator: '2',  label: 'Zbývají místa' },
    { day: 26, bg: app.lastBackground,       text: app.lastText,       indicator: '1',  label: 'Poslední místo' },
    { day: 27, bg: app.fullBackground,       text: app.fullText,       indicator: '×',  label: 'Plno' },
    { day: 28, bg: app.selectedBackground,   text: app.selectedText,   indicator: null, label: 'Vybráno' },
    { day: 31, bg: app.closedBackground,     text: app.closedText,     indicator: null, label: 'Nedostupné' },
    { day: 32, bg: app.unreleasedBackground, text: app.unreleasedText, indicator: null, label: 'Neuvolněno' },
  ]

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)' }}
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>
        Náhled
      </h3>
      <div className="flex flex-wrap gap-2">
        {previewCells.map((cell) => (
          <div key={cell.day} className="flex flex-col items-center gap-1">
            <div
              className="flex h-10 w-10 flex-col items-center justify-center rounded-lg border text-[12px] font-semibold leading-none"
              style={{
                backgroundColor: cell.bg,
                color: cell.text,
                borderColor: cell.text + '33',
              }}
              aria-label={cell.label}
            >
              <span>{cell.day}</span>
              {cell.indicator && (
                <span className="text-[9px] font-bold leading-none mt-px">{cell.indicator}</span>
              )}
            </div>
            <span className="text-center text-[9px] leading-tight" style={{ color: 'var(--admin-text-muted)' }}>
              {cell.label}
            </span>
          </div>
        ))}
        {/* Range cell */}
        <div className="flex flex-col items-center gap-1">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg border text-[12px] font-semibold"
            style={{
              backgroundColor: app.rangeBackground,
              color: app.availableText,
              borderColor: 'transparent',
            }}
            aria-label="Rozsah"
          >
            29
          </div>
          <span className="text-center text-[9px] leading-tight" style={{ color: 'var(--admin-text-muted)' }}>
            Rozsah
          </span>
        </div>
        {/* Today border */}
        <div className="flex flex-col items-center gap-1">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[12px] font-semibold"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--admin-text)',
              border: `2px solid ${app.todayBorder}`,
            }}
            aria-label="Dnes"
          >
            30
          </div>
          <span className="text-center text-[9px] leading-tight" style={{ color: 'var(--admin-text-muted)' }}>
            Dnes
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main editor ─────────────────────────────────────────────────────────────

interface Props {
  initialAppearance: CalendarAppearance
}

export function CalendarAppearanceEditor({ initialAppearance }: Props) {
  const [app, setApp] = useState<CalendarAppearance>({ ...initialAppearance })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const update = useCallback((key: keyof CalendarAppearance, val: string) => {
    setSaved(false)
    setApp((prev) => ({ ...prev, [key]: val }))
  }, [])

  function handleReset() {
    setApp({ ...CALENDAR_APPEARANCE_DEFAULTS })
    setSaved(false)
    setError(null)
  }

  function handleSave() {
    // Validate all keys before saving
    const invalidKeys = (Object.keys(app) as (keyof CalendarAppearance)[]).filter(
      (k) => !isValidHex(app[k])
    )
    if (invalidKeys.length > 0) {
      setError(`Opravte neplatné barvy: ${invalidKeys.join(', ')}`)
      return
    }
    setError(null)

    startTransition(async () => {
      try {
        await updateSiteSetting('availabilityCalendarAppearance', app)
        setSaved(true)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Color groups */}
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELD_GROUPS.map((group) => (
          <div
            key={group.title}
            className="rounded-xl p-4 space-y-2.5"
            style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)' }}
          >
            <h3
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--admin-text-muted)' }}
            >
              {group.title}
            </h3>
            {group.fields.map((field) => (
              <ColorRow
                key={field.key}
                fieldLabel={field.label}
                value={app[field.key]}
                bgForContrast={field.bgKey ? app[field.bgKey] : undefined}
                onChange={(val) => update(field.key, val)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Live preview */}
      <CalendarPreview app={app} />

      {/* Feedback */}
      {error && (
        <p className="rounded-lg px-3 py-2 text-xs text-red-600" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-lg px-3 py-2 text-xs" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
          Barvy kalendáře uloženy. Veřejná stránka rezervace se aktualizuje automaticky.
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: 'var(--admin-accent)' }}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Uložit barvy
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm transition-colors hover:opacity-80 disabled:opacity-50"
          style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-text-muted)' }}
        >
          <RotateCcw className="size-3.5" />
          Obnovit výchozí barvy
        </button>
      </div>
    </div>
  )
}
