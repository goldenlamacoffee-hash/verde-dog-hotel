'use client'

import { useState, useTransition, useRef } from 'react'
import Image from 'next/image'
import { Image as ImageIcon, Plus, Trash2, X, MapPin } from 'lucide-react'
import { updateSiteSetting } from '@/lib/admin/actions'
import { MediaPickerModal } from '@/components/admin/media/media-picker-modal'
import type { MediaAsset } from '@/components/admin/media/media-library'
import type { ContactSettingsValue } from '@/lib/types'

interface Props {
  initialContact:  Record<string, unknown> | null
  initialSeo:      Record<string, string> | null
  initialCapacity: Record<string, unknown> | null
  initialBrand:    Record<string, string> | null
}

export function SiteSettingsEditor({ initialContact, initialSeo, initialCapacity, initialBrand }: Props) {
  const [contact,  setContact]  = useState<ContactSettingsValue>({
    phone:               (initialContact?.phone               as string)  ?? '',
    email:               (initialContact?.email               as string)  ?? '',
    address:             (initialContact?.address             as string)  ?? '',
    web:                 (initialContact?.web                 as string)  ?? '',
    facebook:            (initialContact?.facebook             as string)  ?? '',
    instagram:           (initialContact?.instagram            as string)  ?? '',
    openingHours:        (initialContact?.openingHours as ContactSettingsValue['openingHours']) ?? [],
    locationTitle:       (initialContact?.locationTitle        as string)  ?? '',
    locationDescription: (initialContact?.locationDescription  as string)  ?? '',
    addressLine1:        (initialContact?.addressLine1         as string)  ?? '',
    addressLine2:        (initialContact?.addressLine2         as string)  ?? '',
    city:                (initialContact?.city                 as string)  ?? '',
    postcode:            (initialContact?.postcode              as string)  ?? '',
    country:             (initialContact?.country               as string)  ?? '',
    googleMapsUrl:       (initialContact?.googleMapsUrl         as string)  ?? '',
    locationImageUrl:    (initialContact?.locationImageUrl      as string)  ?? '',
    locationImageAlt:    (initialContact?.locationImageAlt      as string)  ?? '',
  })
  const [seo,      setSeo]      = useState<Record<string, string>>((initialSeo as Record<string, string>) ?? {})
  const [capacity, setCapacity] = useState<Record<string, unknown>>(initialCapacity ?? {})
  const [brand,    setBrand]    = useState<Record<string, string>>((initialBrand as Record<string, string>) ?? {})
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState<string | null>(null)
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  function save(key: string, value: object) {
    setSaveErrors(prev => { const next = { ...prev }; delete next[key]; return next })
    startTransition(async () => {
      try {
        await updateSiteSetting(key, value)
        setSaved(key)
        setTimeout(() => setSaved(null), 2500)
      } catch (err) {
        setSaveErrors(prev => ({ ...prev, [key]: err instanceof Error ? err.message : 'Uložení se nezdařilo.' }))
      }
    })
  }

  // Opening hours row helpers
  function addHoursRow() {
    setContact(p => ({ ...p, openingHours: [...(p.openingHours ?? []), { days: '', hours: '' }] }))
  }
  function updateHoursRow(idx: number, field: 'days' | 'hours', val: string) {
    setContact(p => {
      const rows = [...(p.openingHours ?? [])]
      rows[idx] = { ...rows[idx], [field]: val }
      return { ...p, openingHours: rows }
    })
  }
  function removeHoursRow(idx: number) {
    setContact(p => ({ ...p, openingHours: (p.openingHours ?? []).filter((_, i) => i !== idx) }))
  }

  const inputStyle = { background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }

  return (
    <div className="space-y-6">
      {/* Contact */}
      <Section title="Kontaktní informace">
        {([
          ['Telefon', 'phone'],
          ['E-mail', 'email'],
          ['Adresa / Lokalita', 'address'],
          ['Webová adresa', 'web'],
          ['Facebook URL', 'facebook'],
          ['Instagram URL', 'instagram'],
        ] as [string, keyof ContactSettingsValue][]).map(([label, key]) => (
          <Field key={key} label={label}>
            <input
              value={(contact[key] as string) ?? ''}
              onChange={e => setContact(p => ({ ...p, [key]: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </Field>
        ))}

        {/* Opening hours — editable row list */}
        <Field label="Otevírací doba">
          <div className="space-y-2">
            {(contact.openingHours ?? []).map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={row.days}
                  onChange={e => updateHoursRow(idx, 'days', e.target.value)}
                  placeholder="Popis (např. Příjezdy)"
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                  style={inputStyle}
                />
                <input
                  value={row.hours}
                  onChange={e => updateHoursRow(idx, 'hours', e.target.value)}
                  placeholder="Čas (např. 9:00 – 18:00)"
                  className="w-36 rounded-lg px-3 py-1.5 text-sm outline-none"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => removeHoursRow(idx)}
                  className="shrink-0 rounded-lg p-1.5"
                  title="Odebrat řádek"
                  style={{ color: 'var(--admin-text-muted)' }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addHoursRow}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
              style={{ background: 'var(--admin-accent-light)', color: 'var(--admin-accent)', border: '1px solid var(--admin-card-border)' }}
            >
              <Plus className="size-3.5" />
              Přidat řádek
            </button>
          </div>
        </Field>

        <SaveButton
          label="Uložit kontakt"
          saved={saved === 'contact'}
          isPending={isPending}
          error={saveErrors.contact}
          onClick={() => save('contact', contact)}
        />
      </Section>

      {/* Location — Contact page "Kde nás najdete" block */}
      <Section title="Lokace">
        <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
          Statická sekce s fotografií a odkazem na Google Maps na stránce Kontakt.
          Bez interaktivní mapy — pouze fotografie a odkaz.
        </p>

        <Field label="Nadpis sekce (volitelné)">
          <input
            value={contact.locationTitle ?? ''}
            onChange={e => setContact(p => ({ ...p, locationTitle: e.target.value }))}
            placeholder="Kde nás najdete"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </Field>

        <Field label="Krátký popis (volitelné)">
          <textarea
            value={contact.locationDescription ?? ''}
            onChange={e => setContact(p => ({ ...p, locationDescription: e.target.value }))}
            placeholder="VERDE se nachází v klidném prostředí s pohodlným příjezdem autem."
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
            style={inputStyle}
          />
        </Field>

        <Field label="Adresa">
          <input
            value={contact.addressLine1 ?? ''}
            onChange={e => setContact(p => ({ ...p, addressLine1: e.target.value }))}
            placeholder="VERDE Hotel pro psy, Ulice 123"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </Field>
        <Field label="Adresa — řádek 2 (volitelné)">
          <input
            value={contact.addressLine2 ?? ''}
            onChange={e => setContact(p => ({ ...p, addressLine2: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Město">
            <input
              value={contact.city ?? ''}
              onChange={e => setContact(p => ({ ...p, city: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </Field>
          <Field label="PSČ">
            <input
              value={contact.postcode ?? ''}
              onChange={e => setContact(p => ({ ...p, postcode: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Země">
          <input
            value={contact.country ?? ''}
            onChange={e => setContact(p => ({ ...p, country: e.target.value }))}
            placeholder="Česká republika"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </Field>

        <Field label="Google Maps odkaz">
          <input
            value={contact.googleMapsUrl ?? ''}
            onChange={e => setContact(p => ({ ...p, googleMapsUrl: e.target.value }))}
            placeholder="https://maps.app.goo.gl/…"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
          />
          <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
            Vložte přesný odkaz z Google Maps (tlačítko &quot;Sdílet&quot;). Musí to být platná
            adresa google.com/maps, maps.google.com nebo maps.app.goo.gl.
          </p>
        </Field>

        <Field label="Fotografie lokace">
          <div className="flex items-center gap-3">
            {contact.locationImageUrl ? (
              <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg" style={{ background: 'var(--admin-bg)' }}>
                <Image
                  src={contact.locationImageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized={contact.locationImageUrl.startsWith('http')}
                />
              </div>
            ) : (
              <div
                className="flex h-20 w-32 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'var(--admin-bg)', border: '1px dashed var(--admin-card-border)' }}
              >
                <MapPin className="size-5" style={{ color: 'var(--admin-text-muted)' }} />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowLocationPicker(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                style={{ background: 'var(--admin-accent-light)', color: 'var(--admin-accent)', border: '1px solid var(--admin-card-border)' }}
              >
                <ImageIcon className="size-3.5" />
                Vybrat z médií
              </button>
              {contact.locationImageUrl && (
                <button
                  type="button"
                  onClick={() => setContact(p => ({ ...p, locationImageUrl: '', locationImageAlt: '' }))}
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: 'var(--admin-text-muted)' }}
                >
                  <X className="size-3.5" />
                  Odebrat fotografii
                </button>
              )}
            </div>
          </div>
        </Field>

        {contact.locationImageUrl && (
          <Field label="Alternativní text fotografie">
            <input
              value={contact.locationImageAlt ?? ''}
              onChange={e => setContact(p => ({ ...p, locationImageAlt: e.target.value }))}
              placeholder="Pohled na VERDE Hotel pro psy a okolní přírodu"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </Field>
        )}

        <SaveButton
          label="Uložit lokaci"
          saved={saved === 'contact'}
          isPending={isPending}
          error={saveErrors.contact}
          onClick={() => save('contact', contact)}
        />
      </Section>

      {/* SEO */}
      <Section title="SEO a meta tagy">
        {[['Titulek stránky', 'title'], ['Popis (description)', 'description']].map(([label, key]) => (
          <Field key={key} label={label}>
            <input
              value={seo[key] ?? ''}
              onChange={e => setSeo(p => ({ ...p, [key]: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
            />
          </Field>
        ))}
        <SaveButton label="Uložit SEO" saved={saved === 'seo'} isPending={isPending} onClick={() => save('seo', seo)} />
      </Section>

      {/* Capacity */}
      <Section title="Kapacita a provoz">
        <Field label="Maximální počet psů">
          <input
            type="number"
            value={(capacity.maxDogs as number) ?? 12}
            onChange={e => setCapacity(p => ({ ...p, maxDogs: Number(e.target.value) }))}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
          />
        </Field>
        <Field label="Počet boxů">
          <input
            type="number"
            value={(capacity.boxes as number) ?? 12}
            onChange={e => setCapacity(p => ({ ...p, boxes: Number(e.target.value) }))}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
          />
        </Field>
        <SaveButton label="Uložit kapacitu" saved={saved === 'capacity'} isPending={isPending} onClick={() => save('capacity', capacity)} />
      </Section>

      {/* Brand */}
      <Section title="Brand a média">
        <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
          Loga a OG obrázek. Nahrajte soubor tlačítkem nebo vložte URL z knihovny médií.
          Prázdné pole zachová výchozí statické logo z kódu.
        </p>
        {([
          ['Logo — tmavé (na světlém pozadí)', 'darkLogo'],
          ['Logo — světlé (na tmavém pozadí)', 'lightLogo'],
          ['OG obrázek (1200 × 630 px)', 'ogImage'],
        ] as [string, string][]).map(([label, key]) => (
          <BrandImageField
            key={key}
            label={label}
            value={brand[key] ?? ''}
            onChange={url => setBrand(p => ({ ...p, [key]: url }))}
          />
        ))}
        <SaveButton label="Uložit brand" saved={saved === 'brand'} isPending={isPending} onClick={() => save('brand', brand)} />
      </Section>

      <MediaPickerModal
        open={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={(asset: MediaAsset) => {
          setContact(p => ({
            ...p,
            locationImageUrl: asset.url,
            locationImageAlt: p.locationImageAlt || asset.alt_text || '',
          }))
        }}
      />
    </div>
  )
}

// ─── Brand image field with inline upload ─────────────────────────────────────
function BrandImageField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (url: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState<string | null>(null)

  async function handleUpload(file: File) {
    if (!file.type.startsWith('image/')) { setUploadErr('Pouze obrázky'); return }
    if (file.size > 10 * 1024 * 1024)   { setUploadErr('Max 10 MB');     return }
    setUploadErr(null)
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('alt_text', label)
    const res  = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    const json = await res.json()
    setUploading(false)
    if (!res.ok || !json.asset) { setUploadErr(json.error ?? 'Chyba'); return }
    onChange(json.asset.url as string)
  }

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        {value && (
          <div className="relative h-9 w-14 shrink-0 overflow-hidden rounded" style={{ background: 'var(--admin-bg)' }}>
            <Image src={value} alt="" fill className="object-contain" unoptimized />
          </div>
        )}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://… nebo nahrajte soubor"
          className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none"
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
        />
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Nahrát soubor"
          className="shrink-0 rounded-lg p-1.5 disabled:opacity-50"
          style={{ background: 'var(--admin-accent-light)', color: 'var(--admin-accent)', border: '1px solid var(--admin-card-border)' }}
        >
          <ImageIcon className="size-4" />
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')} className="shrink-0 p-1" title="Zrušit">
            <X className="size-3.5 text-red-400" />
          </button>
        )}
      </div>
      {uploading && <p className="text-xs mt-1" style={{ color: 'var(--admin-text-muted)' }}>Nahrávám…</p>}
      {uploadErr && <p className="text-xs mt-1 text-red-500">{uploadErr}</p>}
    </Field>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}>
      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}

function SaveButton({
  label, saved, isPending, onClick, error,
}: { label: string; saved: boolean; isPending: boolean; onClick: () => void; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5 pt-2">
      <div className="flex items-center gap-3">
        <button
          onClick={onClick}
          disabled={isPending}
          className="rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ background: 'var(--admin-accent)', color: '#fff' }}
        >
          {isPending ? 'Ukládám…' : label}
        </button>
        {saved && <span className="text-xs" style={{ color: 'var(--admin-success)' }}>Uloženo.</span>}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
