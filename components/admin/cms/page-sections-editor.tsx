'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronRight, Save, Loader2 } from 'lucide-react'
import { upsertPageSection } from '@/lib/admin/actions'

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
}

const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero – hlavní banner',
  intro: 'Intro – představení',
  pillars: 'Pilíře – proč Verde',
  accommodation: 'Ubytování',
  routine: 'Denní program',
  cta: 'CTA – výzva k akci',
  footer: 'Patička (globální)',
}

function SectionCard({ section, onSaved }: { section: Section; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [rawJson, setRawJson] = useState(JSON.stringify(section.content, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [active, setActive] = useState(section.active)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

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
      } catch (err: any) {
        setJsonError(err.message)
      }
    })
  }

  const label = SECTION_LABELS[section.section_key] ?? section.section_key

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--admin-card-border)' }}
    >
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
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)' }}
          >
            {section.page}/{section.section_key}
          </span>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            background: active ? 'var(--admin-accent-light)' : '#f3f4f6',
            color: active ? 'var(--admin-accent)' : 'var(--admin-text-muted)',
          }}
        >
          {active ? 'Aktivní' : 'Skrytá'}
        </span>
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 pt-2" style={{ background: 'var(--admin-bg)' }}>
          <div className="mb-3 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--admin-text)' }}>
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                className="accent-[var(--admin-accent)]"
              />
              Zobrazit sekci na webu
            </label>
          </div>

          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>
            Obsah (JSON)
          </label>
          <textarea
            value={rawJson}
            onChange={e => { setRawJson(e.target.value); setJsonError(null) }}
            rows={14}
            spellCheck={false}
            className="w-full rounded-lg border px-3 py-2 font-mono text-xs leading-relaxed"
            style={{
              background: 'var(--admin-card)',
              borderColor: jsonError ? '#dc2626' : 'var(--admin-card-border)',
              color: 'var(--admin-text)',
              resize: 'vertical',
            }}
          />
          {jsonError && <p className="mt-1 text-xs text-red-600">{jsonError}</p>}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ background: 'var(--admin-accent)' }}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              {saved ? 'Uloženo!' : 'Uložit'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function PageSectionsEditor({ sections }: Props) {
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
          <h2
            className="mb-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--admin-text-muted)' }}
          >
            Stránka: {page}
          </h2>
          <div className="space-y-2">
            {pageSections.map(s => (
              <SectionCard key={`${s.page}-${s.section_key}-${key}`} section={s} onSaved={() => setKey(k => k + 1)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
