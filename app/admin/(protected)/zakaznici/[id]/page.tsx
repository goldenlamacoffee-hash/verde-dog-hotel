import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCustomerById } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { StatusBadge } from '@/components/admin/ui/status-badge'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: customer, error } = await getCustomerById(id)
  if (error || !customer) notFound()

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
        <Link href="/admin/zakaznici" style={{ color: 'var(--admin-accent)' }}>Zákazníci</Link>
        <span>/</span>
        <span>{customer.first_name} {customer.last_name}</span>
      </div>

      <PageHeader
        title={`${customer.first_name} ${customer.last_name}`}
        description={customer.email ?? undefined}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Contact */}
          <Section title="Kontakt">
            <InfoRow label="E-mail" value={customer.email ?? '—'} />
            <InfoRow label="Telefon" value={customer.phone ?? '—'} />
            <InfoRow label="Adresa" value={customer.address ?? '—'} />
            <InfoRow label="Město" value={customer.city ?? '—'} />
            {customer.is_vip && <InfoRow label="Segment" value="VIP zákazník" />}
          </Section>

          {/* Dogs */}
          {customer.dogs?.length > 0 && (
            <Section title={`Psi (${customer.dogs.length})`}>
              {customer.dogs.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                  <div>
                    <span className="font-medium text-sm" style={{ color: 'var(--admin-text)' }}>{d.name}</span>
                    {d.dog_breeds?.name && (
                      <span className="ml-2 text-xs" style={{ color: 'var(--admin-text-muted)' }}>{d.dog_breeds.name}</span>
                    )}
                  </div>
                  <div className="flex gap-2 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                    {d.vaccinated && <span>Očkován</span>}
                    {d.neutered && <span>Kastrován</span>}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Reservation history */}
          {customer.reservations?.length > 0 && (
            <Section title={`Rezervace (${customer.reservations.length})`}>
              {customer.reservations.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/rezervace/${r.id}`} className="font-mono text-xs font-semibold" style={{ color: 'var(--admin-accent)' }}>
                      {r.ref_number}
                    </Link>
                    <StatusBadge status={r.status} />
                  </div>
                  <span className="text-xs tabular-nums" style={{ color: 'var(--admin-text-muted)' }}>
                    {new Date(r.arrival_date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    {r.total_price && ` · ${Number(r.total_price).toLocaleString('cs-CZ')} Kč`}
                  </span>
                </div>
              ))}
            </Section>
          )}
        </div>

        <div className="space-y-5">
          <Section title="Poznámky">
            <p className="text-sm" style={{ color: 'var(--admin-text)' }}>
              {customer.notes || <span style={{ color: 'var(--admin-text-muted)' }}>Žádné poznámky.</span>}
            </p>
          </Section>
          <Section title="GDPR">
            <InfoRow label="Souhlas" value={customer.gdpr_consent ? 'Udělen' : 'Neudělen'} />
            {customer.gdpr_consent_at && (
              <InfoRow label="Datum" value={new Date(customer.gdpr_consent_at).toLocaleDateString('cs-CZ')} />
            )}
          </Section>
          <Section title="Systém">
            <InfoRow label="Zákazník od" value={new Date(customer.created_at).toLocaleDateString('cs-CZ')} />
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}>
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--admin-text-muted)' }}>{title}</h2>
      {children}
    </div>
  )
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-4 py-1.5 text-sm" style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
      <span style={{ color: 'var(--admin-text-muted)' }}>{label}</span>
      <span className="text-right font-medium" style={{ color: 'var(--admin-text)' }}>{value}</span>
    </div>
  )
}
