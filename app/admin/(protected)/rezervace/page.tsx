import Link from 'next/link'
import { getReservations } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { StatusBadge } from '@/components/admin/ui/status-badge'

export const metadata = { title: 'Rezervace | VERDE Admin' }

function fmt(d: string) {
  return new Date(d).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function nights(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const { data: reservations } = await getReservations({ status, limit: 100 })

  const STATUSES = [
    { value: '', label: 'Vše' },
    { value: 'inquiry', label: 'Poptávka' },
    { value: 'confirmed', label: 'Potvrzeno' },
    { value: 'checked_in', label: 'Ubytován' },
    { value: 'checked_out', label: 'Odjel' },
    { value: 'cancelled', label: 'Zrušeno' },
  ]

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader title="Rezervace" description={`${reservations?.length ?? 0} záznamů`} />

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <Link
            key={s.value}
            href={s.value ? `/admin/rezervace?status=${s.value}` : '/admin/rezervace'}
            className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors"
            style={{
              background: (status ?? '') === s.value ? 'var(--admin-accent)' : 'var(--admin-card)',
              color: (status ?? '') === s.value ? '#fff' : 'var(--admin-text-muted)',
              border: '1px solid var(--admin-card-border)',
            }}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--admin-card-border)', background: 'var(--admin-card)' }}
      >
        {!reservations?.length ? (
          <p className="p-8 text-sm text-center" style={{ color: 'var(--admin-text-muted)' }}>
            Žádné rezervace v tomto filtru.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                  {['Č.', 'Zákazník', 'Pes / psi', 'Příjezd', 'Odjezd', 'Nocí', 'Cena', 'Záloha', 'Stav', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider whitespace-nowrap"
                        style={{ color: 'var(--admin-text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reservations.map((r: any) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid var(--admin-card-border)' }}
                    className="hover:bg-gray-50/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--admin-accent)' }}>
                        {r.ref_number}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--admin-text)' }}>
                      {r.customer ? `${r.customer.first_name} ${r.customer.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--admin-text-muted)' }}>
                      {r.reservation_dogs?.map((rd: any) => rd.dog?.name).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap" style={{ color: 'var(--admin-text)' }}>{fmt(r.arrival_date)}</td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap" style={{ color: 'var(--admin-text)' }}>{fmt(r.departure_date)}</td>
                    <td className="px-4 py-3 tabular-nums text-center" style={{ color: 'var(--admin-text-muted)' }}>
                      {nights(r.arrival_date, r.departure_date)}
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap" style={{ color: 'var(--admin-text)' }}>
                      {r.total_price ? `${Number(r.total_price).toLocaleString('cs-CZ')} Kč` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.deposit_paid
                        ? <span className="text-xs" style={{ color: 'var(--admin-success)' }}>Uhrazena</span>
                        : <span className="text-xs" style={{ color: 'var(--admin-warning)' }}>Čeká</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/rezervace/${r.id}`}
                        className="text-xs font-medium whitespace-nowrap"
                        style={{ color: 'var(--admin-accent)' }}
                      >
                        Detail →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
