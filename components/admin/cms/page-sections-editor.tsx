'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronRight, Save, Loader2, Image as ImageIcon, X } from 'lucide-react'
import Image from 'next/image'
import { upsertPageSection } from '@/lib/admin/actions'
import { MediaLibrary } from '@/components/admin/media/media-library'
import type { MediaAsset } from '@/components/admin/media/media-library'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: string
  page: string
  section_key: string
  content: Record<string, unknown>
  active: boolean
  sort_order: number
}

interface Props {
  sections: Section[]
  mediaAssets: MediaAsset[]
  mediaTotal: number
}

// ─── Image keys that should have a picker instead of raw JSON for known sections
const IMAGE_KEYS: Record<string, string[]> = {
  hero:          ['image_url'],
  intro:         ['image_url'],
  accommodation: ['card_0_image', 'card_1_image', 'card_2_image'],
}

const SECTION_LABELS: Record<string, string> = {
  hero:                  'Hero – hlavní banner',
  intro:                 'Intro – představení',
  pillars:               'Pilíře – proč Verde',
  accommodation:         'Ubytování',
  accommodation_detail:  'Ubytování – detail',
  care_detail:           'Péče – detail',
  routine:               'Denní program',
  feeding:               'Krmení',
  requirements:          'Co s sebou',
  story:                 'Náš příběh',
  team:                  'Náš tým',
  values:                'Hodnoty',
  location:              'Lokalita',
  note:                  'Poznámky k ceníku',
  cta:                   'CTA – výzva k akci',
  footer:                'Patička (globální)',
  header:                'Hlavička (globální)',
}

// ─── Inline MediaPicker field ─────────────────────────────────────────────────
function MediaPickerField({
  label,
  fieldKey,
  value,
  mediaAssets,
  mediaTotal,
  onChange,
}: {
  label: string
  fieldKey: string
  value: string
  mediaAssets: MediaAsset[]
  mediaTotal: number
  onChange: (url: string) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>
        {label} <span className="font-mono opacity-60">({fieldKey})</span>
      </label>

      {/* Preview + input row */}
      <div className="flex items-center gap-2">
        {value && (
          <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded" style={{ background: 'var(--admin-bg)' }}>
            <Image src={value} alt="" fill className="object-cover" unoptimized />
          </div>
        )}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://… nebo vyberte z knihovny"
          className="flex-1 rounded-lg px-3 py-1.5 text-xs"
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
        />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          title="Vybrat z knihovny médií"
          className="shrink-0 rounded-lg p-1.5 transition-colors"
          style={{ background: 'var(--admin-accent-light)', color: 'var(--admin-accent)', border: '1px solid var(--admin-card-border)' }}
        >
          <ImageIcon className="size-4" />
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')} title="Zrušit výběr" className="shrink-0 p-1">
            <X className="size-3.5 text-red-400" />
          </button>
        )}
      </div>

      {/* Inline picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="flex w-full max-w-4xl flex-col rounded-xl overflow-hidden max-h-[80vh]"
            style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}>
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--admin-text)' }}>
                Vybrat médium — {label}
              </p>
              <button onClick={() => setPickerOpen(false)}>
                <X className="size-4" style={{ color: 'var(--admin-text-muted)' }} />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <MediaLibrary
                assets={mediaAssets}
                total={mediaTotal}
                page={1}
                limit={mediaTotal}
                onSelect={asset => { onChange(asset.public_url); setPickerOpen(false) }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SectionCard ──────────────────────────────────────────────────────────────
function SectionCard({
  section,
  mediaAssets,
  mediaTotal,
  onSaved,
}: {
  section: Section
  mediaAssets: MediaAsset[]
  mediaTotal: number
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState<Record<string, unknown>>({ ...section.content })
  const [rawJson, setRawJson] = useState(JSON.stringify(section.content, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [active, setActive] = useState(section.active)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const imageKeys = IMAGE_KEYS[section.section_key] ?? []

  function updateImageKey(key: string, url: string) {
    const next = { ...content, [key]: url || undefined }
    setContent(next)
    setRawJson(JSON.stringify(next, null, 2))
  }

  function handleJsonChange(raw: string) {
    setRawJson(raw)
    setJsonError(null)
    try {
      const parsed = JSON.parse(raw)
      setContent(parsed)
    } catch {
      // leave content stale until save
    }
  }

  function handleSave() {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(rawJson)
    } catch {
      setJsonError('Neplatný JSON.')
      return
    }
    setJsonError(null)
    startTransition(async () => {
      try {
        await upsertPageSection({
          page: section.page,
          section_key: section.section_key,
          content: parsed,
          active,
          sort_order: section.sort_order,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        onSaved()
      } catch (err: unknown) {
        setJsonError(err instanceof Error ? err.message : 'Chyba')
      }
    })
  }

  const label = SECTION_LABELS[section.section_key] ?? section.section_key

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--admin-card-border)' }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
        style={{ background: 'var(--admin-card)' }}
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="size-4 shrink-0" style={{ color: 'var(--admin-text-muted)' }} />
          ) : (
            <ChevronRight className="size-4 shrink-0" style={{ color: 'var(--admin-text-muted)' }} />
          )}
          <span className="text-sm font-medium" style={{ color: 'var(--admin-text)' }}>
            {label}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)' }}>
            {section.page}/{section.section_key}
          </span>
        </div>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            background: active ? 'var(--admin-accent-light)' : '#f3f4f6',
            color:      active ? 'var(--admin-accent)' : 'var(--admin-text-muted)',
          }}>
          {active ? 'Aktivní' : 'Skrytá'}
        </span>
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-3" style={{ background: 'var(--admin-bg)' }}>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--admin-text)' }}>
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}
              className="accent-[var(--admin-accent)]" />
            Zobrazit sekci na webu
          </label>

          {/* Image pickers for known image keys */}
          {imageKeys.length > 0 && (
            <div className="rounded-lg p-3 space-y-3"
              style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>
                Obrázky
              </p>
              {imageKeys.map(key => (
                <MediaPickerField
                  key={key}
                  label={key.replace(/_/g, ' ')}
                  fieldKey={key}
                  value={(content[key] as string) ?? ''}
                  mediaAssets={mediaAssets}
                  mediaTotal={mediaTotal}
                  onChange={url => updateImageKey(key, url)}
                />
              ))}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--admin-text-muted)' }}>
              Obsah (JSON)
            </label>
            <textarea
              value={rawJson}
              onChange={e => handleJsonChange(e.target.value)}
              rows={14}
              spellCheck={false}
              className="w-full rounded-lg border px-3 py-2 font-mono text-xs leading-relaxed"
              style={{
                background:   'var(--admin-card)',
                borderColor:  jsonError ? '#dc2626' : 'var(--admin-card-border)',
                color:        'var(--admin-text)',
                resize:       'vertical',
              }}
            />
            {jsonError && <p className="mt-1 text-xs text-red-600">{jsonError}</p>}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSave} disabled={pending}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ background: 'var(--admin-accent)' }}>
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {saved ? 'Uloženo!' : 'Uložit'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function PageSectionsEditor({ sections, mediaAssets, mediaTotal }: Props) {
  const [key, setKey] = useState(0)

  const grouped = sections.reduce<Record<string, Section[]>>((acc, s) => {
    if (!acc[s.page]) acc[s.page] = []
    acc[s.page].push(s)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([page, pageSections]) => (
        <div key={page}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--admin-text-muted)' }}>
            Stránka: {page}
          </h2>
          <div className="space-y-2">
            {pageSections.map(s => (
              <SectionCard
                key={`${s.page}-${s.section_key}-${key}`}
                section={s}
                mediaAssets={mediaAssets}
                mediaTotal={mediaTotal}
                onSaved={() => setKey(k => k + 1)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
