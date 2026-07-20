import Link from 'next/link'
import { getDashboardStats, getReservations } from '@/lib/admin/queries'
import { StatCard } from '@/components/admin/ui/stat-card'
import { PageHeader } from '@/components/admin/ui/page-header'
import { StatusBadge } from '@/components/admin/ui/status-badge'

export const metadata = { title: 'Dashboard | VERDE Admin' }

function fmt(date: string) {
  return new Date(date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function AdminDashboardPage() {
  const [stats, { data: recent }] = await Promise.all([
    getDashboardStats(),
    getReservations({ limit: 8 }),
  ])

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="Dashboard"
        description={new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ubytováno nyní" value={stats.checkedIn} accent />
        <StatCard label="Nadcházející" value={stats.upcoming} sub="potvrzené rezervace" />
        <StatCard label="Zákazníků celkem" value={stats.totalCustomers} />
        <StatCard label="Rezervací celkem" value={stats.totalReservations} />
      </div>

      {/* Recent reservations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-serif)', color: 'var(--admin-text)' }}>
            Poslední rezervace
          </h2>
          <Link
            href="/admin/rezervace"
            className="text-xs font-medium"
            style={{ color: 'var(--admin-accent)' }}
          >
            Zobrazit vše →
          </Link>
        </div>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--admin-card-border)', background: 'var(--admin-card)' }}
        >
          {!recent?.length ? (
            <p className="p-6 text-sm" style={{ color: 'var(--admin-text-muted)' }}>Zatím žádné rezervace.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                    {['Č. rezervace', 'Zákazník', 'Pes', 'Příjezd', 'Odjezd', 'Stav'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r: any) => (
                    <tr
                      key={r.id}
                      style={{ borderBottom: '1px solid var(--admin-card-border)' }}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/admin/rezervace/${r.id}`} className="font-mono text-xs font-semibold" style={{ color: 'var(--admin-accent)' }}>
                          {r.ref_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--admin-text)' }}>
                        {r.customer ? `${r.customer.first_name} ${r.customer.last_name}` : '—'}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--admin-text-muted)' }}>
                        {r.reservation_dogs?.map((rd: any) => rd.dog?.name).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--admin-text)' }}>{fmt(r.arrival_date)}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--admin-text)' }}>{fmt(r.departure_date)}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
