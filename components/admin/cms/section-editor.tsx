'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { upsertPageSection } from '@/lib/admin/actions'
import { inferFields, type FieldDef } from '@/lib/admin/cms-config'
import { SchemaForm, Switch } from './fields'
import { SaveBar } from './save-bar'
import { useEditor } from './use-editor'
import './cms.css'

type Obj = Record<string, unknown>

interface Props {
  page: string
  sectionKey: string
  label: string
  description?: string
  initialContent: Obj
  initialActive: boolean
  sortOrder?: number
  fields?: FieldDef[]
  /** Hide the visibility switch (e.g. header/footer are always shown). */
  showVisibility?: boolean
}

interface Draft {
  content: Obj
  active: boolean
}

export function SectionEditor({
  page,
  sectionKey,
  label,
  description,
  initialContent,
  initialActive,
  sortOrder,
  fields,
  showVisibility = true,
}: Props) {
  const router = useRouter()
  const schema = useMemo(() => fields ?? inferFields(initialContent), [fields, initialContent])

  const editor = useEditor<Draft>({ content: initialContent, active: initialActive }, async d => {
    await upsertPageSection({
      page,
      section_key: sectionKey,
      content: d.content,
      active: d.active,
      sort_order: sortOrder,
    })
    router.refresh()
  })

  const [json, setJson] = useState<string | null>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const jsonText = json ?? JSON.stringify(editor.draft.content, null, 2)

  function onJsonChange(text: string) {
    setJson(text)
    try {
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Obsah musí být objekt')
      setJsonError(null)
      editor.update(d => ({ ...d, content: parsed as Obj }))
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Neplatný JSON')
    }
  }

  return (
    <div className="space-y-5 pb-28">
      {showVisibility && (
        <div className="cms-card flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--admin-text)' }}>
              Viditelnost
            </p>
            <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
              {editor.draft.active ? 'Zobrazeno na webu' : 'Skryto – návštěvníci tuto sekci nevidí'}
            </p>
          </div>
          <Switch
            checked={editor.draft.active}
            label={`Zobrazit sekci ${label} na webu`}
            onChange={v => editor.update(d => ({ ...d, active: v }))}
          />
        </div>
      )}

      <div className="cms-card space-y-5 p-5 sm:p-6">
        {description && (
          <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
            {description}
          </p>
        )}
        <SchemaForm
          fields={schema}
          value={editor.draft.content}
          onChange={content => {
            setJson(null)
            editor.update(d => ({ ...d, content }))
          }}
        />
      </div>

      <details className="cms-card group">
        <summary
          className="flex cursor-pointer list-none items-center justify-between gap-2 p-5 text-sm font-semibold"
          style={{ color: 'var(--admin-text)' }}
        >
          Pokročilé
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-5 border-t p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div>
            <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--admin-text)' }}>
              Technické informace
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt style={{ color: 'var(--admin-text-muted)' }}>Stránka</dt>
              <dd className="font-mono text-xs">{page}</dd>
              <dt style={{ color: 'var(--admin-text-muted)' }}>Klíč sekce</dt>
              <dd className="font-mono text-xs">{sectionKey}</dd>
            </dl>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`json-${sectionKey}`} className="block text-sm font-semibold" style={{ color: 'var(--admin-text)' }}>
              JSON obsah
            </label>
            <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
              Pouze pro vývojáře. Běžné úpravy provádějte ve formuláři výše.
            </p>
            <textarea
              id={`json-${sectionKey}`}
              className="cms-input font-mono text-xs"
              rows={14}
              spellCheck={false}
              value={jsonText}
              onChange={e => onJsonChange(e.target.value)}
            />
            {jsonError && (
              <p className="text-xs" role="alert" style={{ color: 'var(--admin-danger)' }}>
                {jsonError}
              </p>
            )}
          </div>
        </div>
      </details>

      <SaveBar
        {...editor}
        disabled={!!jsonError}
        onSave={editor.save}
        onCancel={() => {
          setJson(null)
          setJsonError(null)
          editor.cancel()
        }}
      />
    </div>
  )
}
