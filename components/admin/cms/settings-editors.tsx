'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { updateSiteSetting } from '@/lib/admin/actions'
import type { ContactSettingsValue } from '@/lib/types'
import { ImageInput, TextAreaInput, TextInput } from './fields'
import { SaveBar } from './save-bar'
import { useEditor } from './use-editor'
import './cms.css'

type Obj = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="cms-card space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-serif)', color: 'var(--admin-text)' }}>
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

function useSettingEditor<T extends object>(key: string, initial: T) {
  const router = useRouter()
  return useEditor<T>(initial, async draft => {
    await updateSiteSetting(key, draft)
    router.refresh()
  })
}

// ─── Contact (one object, one save) ──────────────────────────────────────────

export function ContactSettingsEditor({ initial }: { initial: ContactSettingsValue | null }) {
  const editor = useSettingEditor<ContactSettingsValue>('contact', { ...(initial ?? {}) })
  const c = editor.draft
  const set = (patch: Partial<ContactSettingsValue>) => editor.update(prev => ({ ...prev, ...patch }))
  const hours = Array.isArray(c.openingHours) ? c.openingHours : []

  return (
    <div className="space-y-5 pb-28">
      <Panel title="Kontaktní údaje" description="Zobrazují se v patičce a na stránce Kontakt.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Telefon" type="tel" inputMode="tel" value={str(c.phone)} onChange={v => set({ phone: v })} />
          <TextInput label="E-mail" type="email" inputMode="email" value={str(c.email)} onChange={v => set({ email: v })} />
          <TextInput label="Web" value={str(c.web)} onChange={v => set({ web: v })} />
          <TextInput label="Facebook" value={str(c.facebook)} onChange={v => set({ facebook: v })} />
          <TextInput label="Instagram" value={str(c.instagram)} onChange={v => set({ instagram: v })} />
        </div>
      </Panel>

      <Panel title="Adresa">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Adresa" value={str(c.addressLine1 ?? c.address)} onChange={v => set({ addressLine1: v, address: v })} />
          <TextInput label="Adresa – řádek 2" value={str(c.addressLine2)} onChange={v => set({ addressLine2: v })} />
          <TextInput label="Město" value={str(c.city)} onChange={v => set({ city: v })} />
          <TextInput label="PSČ" inputMode="numeric" value={str(c.postcode)} onChange={v => set({ postcode: v })} />
          <TextInput label="Země" value={str(c.country)} onChange={v => set({ country: v })} />
        </div>
      </Panel>

      <Panel title="Otevírací doba" description="Slouží pouze pro administraci a interní přehled.">
        <ul className="space-y-2">
          {hours.map((row, i) => (
            <li key={i} className="flex items-start gap-2">
              <input
                aria-label={`Dny, řádek ${i + 1}`}
                className="cms-input"
                placeholder="Např. Po–Pá"
                value={row.days}
                onChange={e => set({ openingHours: hours.map((r, j) => (j === i ? { ...r, days: e.target.value } : r)) })}
              />
              <input
                aria-label={`Hodiny, řádek ${i + 1}`}
                className="cms-input"
                placeholder="Např. 8:00–18:00"
                value={row.hours}
                onChange={e => set({ openingHours: hours.map((r, j) => (j === i ? { ...r, hours: e.target.value } : r)) })}
              />
              <button
                type="button"
                className="cms-icon-btn"
                style={{ color: 'var(--admin-danger)' }}
                aria-label={`Smazat řádek ${i + 1}`}
                onClick={() => set({ openingHours: hours.filter((_, j) => j !== i) })}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="cms-btn cms-btn-secondary cms-btn-sm"
          onClick={() => set({ openingHours: [...hours, { days: '', hours: '' }] })}
        >
          <Plus className="size-4" aria-hidden="true" />
          Přidat řádek
        </button>
      </Panel>

      <Panel title="Lokalita" description="Fotografie, popis a odkaz na mapu v sekci „Kde nás najdete“ na stránce Kontakt.">
        <TextInput label="Nadpis" placeholder="Kde nás najdete" value={str(c.locationTitle)} onChange={v => set({ locationTitle: v })} />
        <TextAreaInput label="Popis" rows={3} value={str(c.locationDescription)} onChange={v => set({ locationDescription: v })} />
        <TextInput
          label="Odkaz na Google Maps"
          hint="Použijte odkaz z tlačítka „Sdílet“ v Google Maps (google.com/maps, maps.google.com nebo maps.app.goo.gl)."
          inputMode="url"
          value={str(c.googleMapsUrl)}
          onChange={v => set({ googleMapsUrl: v })}
        />
        <ImageInput
          label="Fotografie lokality"
          hasAlt
          value={str(c.locationImageUrl)}
          alt={str(c.locationImageAlt)}
          onChange={v => set({ locationImageUrl: v })}
          onAltChange={v => set({ locationImageAlt: v })}
        />
      </Panel>

      <SaveBar {...editor} onSave={editor.save} onCancel={editor.cancel} />
    </div>
  )
}

// ─── SEO ─────────────────────────────────────────────────────────────────────

export function SeoEditor({ initial, ogImage }: { initial: Obj | null; ogImage: string }) {
  const editor = useSettingEditor<Obj>('seo', { ...(initial ?? {}) })
  const d = editor.draft
  const title = str(d.title)
  const description = str(d.description)

  return (
    <div className="space-y-5 pb-28">
      <Panel title="Vyhledávače" description="Takto se web zobrazí ve výsledcích vyhledávání.">
        <TextInput
          label="Titulek stránky"
          hint={`${title.length} znaků – doporučujeme do 60.`}
          value={title}
          onChange={v => editor.update(p => ({ ...p, title: v }))}
        />
        <TextAreaInput
          label="Popis (meta description)"
          hint={`${description.length} znaků – doporučujeme do 160.`}
          rows={3}
          value={description}
          onChange={v => editor.update(p => ({ ...p, description: v }))}
        />
      </Panel>

      <Panel title="Obrázek při sdílení" description="Obrázek se nastavuje v části Brand, aby byl na jednom místě.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            className="flex h-24 w-44 shrink-0 items-center justify-center overflow-hidden rounded-lg"
            style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)' }}
          >
            {ogImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ogImage || '/placeholder.svg'} alt="Obrázek při sdílení na sociálních sítích" className="h-full w-full object-cover" />
            ) : (
              <span className="px-2 text-center text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                Nenastaveno
              </span>
            )}
          </div>
          <Link href="/admin/obsah/brand" className="cms-btn cms-btn-secondary cms-btn-sm self-start sm:self-center">
            Změnit v části Brand
          </Link>
        </div>
      </Panel>

      <SaveBar {...editor} onSave={editor.save} onCancel={editor.cancel} />
    </div>
  )
}

// ─── Brand ───────────────────────────────────────────────────────────────────

export function BrandEditor({ initial }: { initial: Obj | null }) {
  const editor = useSettingEditor<Obj>('brand', { ...(initial ?? {}) })
  const d = editor.draft
  const set = (key: string) => (url: string) => editor.update(p => ({ ...p, [key]: url }))

  return (
    <div className="space-y-5 pb-28">
      <Panel title="Loga" description="Prázdné pole zachová výchozí logo webu.">
        <ImageInput label="Logo tmavé (na světlém pozadí)" uploadable value={str(d.darkLogo)} onChange={set('darkLogo')} />
        <ImageInput label="Logo světlé (na tmavém pozadí)" uploadable value={str(d.lightLogo)} onChange={set('lightLogo')} />
      </Panel>
      <Panel title="Sdílení na sociálních sítích" description="Doporučená velikost je 1200 × 630 px.">
        <ImageInput label="OG obrázek" uploadable value={str(d.ogImage)} onChange={set('ogImage')} />
      </Panel>
      <SaveBar {...editor} onSave={editor.save} onCancel={editor.cancel} />
    </div>
  )
}

// ─── Capacity ────────────────────────────────────────────────────────────────

export function CapacityEditor({ initial }: { initial: Obj | null }) {
  const editor = useSettingEditor<Obj>('capacity', { ...(initial ?? {}) })
  const d = editor.draft
  const num = (v: unknown) => (typeof v === 'number' ? String(v) : v == null || v === '' ? '12' : String(v))
  const set = (key: string) => (v: string) => editor.update(p => ({ ...p, [key]: v === '' ? 0 : Number(v) }))

  return (
    <div className="space-y-5 pb-28">
      <Panel title="Kapacita hotelu" description="Provozní limity používané při rezervacích.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Maximální počet psů" type="number" inputMode="numeric" value={num(d.maxDogs)} onChange={set('maxDogs')} />
          <TextInput label="Počet boxů" type="number" inputMode="numeric" value={num(d.boxes)} onChange={set('boxes')} />
        </div>
      </Panel>
      <SaveBar {...editor} onSave={editor.save} onCancel={editor.cancel} />
    </div>
  )
}
