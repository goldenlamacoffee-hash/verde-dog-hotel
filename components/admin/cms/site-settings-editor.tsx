'use client'

import { useState, useTransition } from 'react'
import { updateSiteSetting } from '@/lib/admin/actions'

interface Props {
  initialContact: Record<string, string> | null
  initialSeo: Record<string, string> | null
  initialCapacity: Record<string, any> | null
}

export function SiteSettingsEditor({ initialContact, initialSeo, initialCapacity }: Props) {
  const [contact, setContact] = useState(initialContact ?? {})
  const [seo, setSeo] = useState(initialSeo ?? {})
  const [capacity, setCapacity] = useState(initialCapacity ?? {})
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState<string | null>(null)

  function save(key: string, value: object) {
    startTransition(async () => {
      await updateSiteSetting(key, value)
      setSaved(key)
      setTimeout(() => setSaved(null), 2500)
    })
  }

  return (
    <div className="space-y-6">
      {/* Contact */}
      <Section title="Kontaktní informace">
        {[
          ['Telefon', 'phone'],
          ['E-mail', 'email'],
          ['Adresa', 'address'],
          ['Facebook URL', 'facebook'],
          ['Instagram URL', 'instagram'],
        ].map(([label, key]) => (
          <Field key={key} label={label}>
            <input
              value={contact[key] ?? ''}
              onChange={e => setContact(p => ({ ...p, [key]: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
            />
          </Field>
        ))}
        <SaveButton label="Uložit kontakt" saved={saved === 'contact'} isPending={isPending} onClick={() => save('contact', contact)} />
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
            value={capacity.maxDogs ?? 12}
            onChange={e => setCapacity(p => ({ ...p, maxDogs: Number(e.target.value) }))}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
          />
        </Field>
        <Field label="Počet boxů">
          <input
            type="number"
            value={capacity.boxes ?? 12}
            onChange={e => setCapacity(p => ({ ...p, boxes: Number(e.target.value) }))}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
          />
        </Field>
        <SaveButton label="Uložit kapacitu" saved={saved === 'capacity'} isPending={isPending} onClick={() => save('capacity', capacity)} />
      </Section>
    </div>
  )
}

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

function SaveButton({ label, saved, isPending, onClick }: { label: string; saved: boolean; isPending: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-2">
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
  )
}
