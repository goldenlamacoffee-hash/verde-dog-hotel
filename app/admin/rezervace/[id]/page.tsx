import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getReservationById, getPaymentsForReservation, getReservationDocuments } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { StatusBadge } from '@/components/admin/ui/status-badge'
import { ReservationActions } from '@/components/admin/reservations/reservation-actions'
import { PaymentsPanel } from '@/components/admin/reservations/payments-panel'
import { DocumentsPanel } from '@/components/admin/reservations/documents-panel'

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ data: res, error }, { data: payments }, { data: docs }] = await Promise.all([
    getReservationById(id),
    getPaymentsForReservation(id),
    getReservationDocuments(id),
  ])
  if (error || !res) notFound()

  function fmt(d: string) {
    return new Date(d).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  const nights = Math.round((new Date(res.departure_date).getTime() - new Date(res.arrival_date).getTime()) / 86400000)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
        <Link href="/admin/rezervace" style={{ color: 'var(--admin-accent)' }}>Rezervace</Link>
        <span>/</span>
        <span className="font-mono">{res.ref_number}</span>
      </div>

      <PageHeader
        title={res.ref_number}
        description={`${fmt(res.arrival_date)} – ${fmt(res.departure_date)} · ${nights} nocí`}
        action={<StatusBadge status={res.status} />}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Customer */}
          {res.customer && (
            <Section title="Zákazník">
              <InfoRow label="Jméno" value={`${res.customer.first_name} ${res.customer.last_name}`} />
              <InfoRow label="Telefon" value={res.customer.phone ?? '—'} />
              <InfoRow label="E-mail" value={res.customer.email ?? '—'} />
              <div className="pt-1">
                <Link
                  href={`/admin/zakaznici/${res.customer.id}`}
                  className="text-xs font-medium"
                  style={{ color: 'var(--admin-accent)' }}
                >
                  Profil zákazníka →
                </Link>
              </div>
            </Section>
          )}

          {/* Dogs */}
          {res.reservation_dogs?.length > 0 && (
            <Section title="Psi">
              {res.reservation_dogs.map((rd: any) => (
                <div key={rd.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                  <div>
                    <span className="font-medium text-sm" style={{ color: 'var(--admin-text)' }}>{rd.dog?.name}</span>
                    {rd.dog?.dog_breeds?.name && (
                      <span className="ml-2 text-xs" style={{ color: 'var(--admin-text-muted)' }}>{rd.dog.dog_breeds.name}</span>
                    )}
                  </div>
                  {rd.box_number && (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--admin-accent-light)', color: 'var(--admin-accent)' }}>
                      Box {rd.box_number}
                    </span>
                  )}
                </div>
              ))}
            </Section>
          )}

          {/* Services */}
          {res.reservation_services?.length > 0 && (
            <Section title="Doplňkové služby">
              {res.reservation_services.map((s: any) => (
                <div key={s.id} className="flex justify-between text-sm py-1.5" style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                  <span style={{ color: 'var(--admin-text)' }}>{s.service?.title} × {s.quantity}</span>
                  <span className="tabular-nums" style={{ color: 'var(--admin-text-muted)' }}>
                    {Number(s.total_price).toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
              ))}
              {res.total_price && (
                <div className="flex justify-between text-sm font-semibold pt-2">
                  <span style={{ color: 'var(--admin-text)' }}>Celkem</span>
                  <span style={{ color: 'var(--admin-text)' }}>{Number(res.total_price).toLocaleString('cs-CZ')} Kč</span>
                </div>
              )}
            </Section>
          )}

          {/* Notes */}
          {res.notes && (
            <Section title="Poznámka zákazníka">
              <p className="text-sm" style={{ color: 'var(--admin-text)' }}>{res.notes}</p>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Section title="Akce">
            <ReservationActions reservationId={id} currentStatus={res.status} />
          </Section>

          <Section title="Platby">
            <PaymentsPanel
              reservationId={id}
              payments={payments ?? []}
              totalPrice={res.total_price}
            />
          </Section>

          <Section title="Detaily rezervace">
            <InfoRow label="Záloha (sazba)" value={res.deposit_amount ? `${Number(res.deposit_amount).toLocaleString('cs-CZ')} Kč` : '—'} />
            <InfoRow label="Záloha uhrazena" value={res.deposit_paid ? 'Ano' : 'Ne'} />
            <InfoRow label="Plná úhrada" value={res.paid_in_full ? 'Ano' : 'Ne'} />
            <InfoRow label="Zdroj" value={res.source ?? '—'} />
          </Section>

          <Section title="Dokumenty">
            <DocumentsPanel reservationId={id} initialDocs={docs ?? []} />
          </Section>

          <Section title="Systém">
            <InfoRow label="Vytvořeno" value={new Date(res.created_at).toLocaleDateString('cs-CZ')} />
            <InfoRow label="Aktualizováno" value={new Date(res.updated_at).toLocaleDateString('cs-CZ')} />
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}>
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--admin-text-muted)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-4 py-1 text-sm" style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
      <span style={{ color: 'var(--admin-text-muted)' }}>{label}</span>
      <span className="text-right font-medium" style={{ color: 'var(--admin-text)' }}>{value}</span>
    </div>
  )
}
