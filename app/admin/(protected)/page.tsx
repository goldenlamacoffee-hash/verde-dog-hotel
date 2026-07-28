import Link from 'next/link'
import { getDashboardStats, getReservations } from '@/lib/admin/queries'
import { getOccupancyForDate, getOccupancyForRange } from '@/lib/capacity'
import { getUnpublishedFutureMonths } from '@/lib/admin/availability-actions'
import { StatCard } from '@/components/admin/ui/stat-card'
import { PageHeader } from '@/components/admin/ui/page-header'
import { StatusBadge } from '@/components/admin/ui/status-badge'

export const metadata = { title: 'Dashboard | VERDE Admin' }

function fmt(date: string) {
  return new Date(date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function addDays(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default async function AdminDashboardPage() {
  const today = new Date().toISOString().split('T')[0]

  const [stats, { data: recent }, todayOccupancy, weekOccupancy, unpublishedResult] = await Promise.all([
    getDashboardStats(),
    getReservations({ limit: 8 }),
    getOccupancyForDate(today),
    getOccupancyForRange(today, addDays(today, 7)),
    getUnpublishedFutureMonths(3),
  ])
  const unpublishedMonths = unpublishedResult.months

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="Dashboard"
        description={new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />

      {/* ── Unpublished months reminder ───────────────────────────────────── */}
      {unpublishedMonths.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}
          role="alert"
        >
          <svg
            className="mt-0.5 shrink-0"
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            aria-hidden="true"
          >
            <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z" fill="#92400e"/>
            <path d="M8 4.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4.5zm0 6a.875.875 0 110 1.75.875.875 0 010-1.75z" fill="#92400e"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
              {unpublishedMonths.length === 1
                ? 'Jeden nadcházející měsíc není zveřejněn'
                : `${unpublishedMonths.length} nadcházející měsíce nejsou zveřejněny`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
              {unpublishedMonths
                .map(m =>
                  new Date(m + 'T00:00:00').toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })
                )
                .join(', ')}
              {' — zákazníci tyto termíny nemohou rezervovat.'}
            </p>
          </div>
          <Link
            href={`/admin/kapacita?month=${unpublishedMonths[0]}`}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: '#92400e', color: '#fff' }}
          >
            Zveřejnit
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ubytováno nyní" value={stats.checkedIn} accent />
        <StatCard label="Nadcházející" value={stats.upcoming} sub="potvrzené rezervace" />
        <StatCard label="Zákazníků celkem" value={stats.totalCustomers} />
        <StatCard label="Rezervací celkem" value={stats.totalReservations} />
      </div>

      {/* Live occupancy card */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--admin-text-muted)' }}
          >
            Obsazenost dnes
          </h2>
          <Link
            href="/admin/kapacita"
            className="text-xs font-medium"
            style={{ color: 'var(--admin-accent)' }}
          >
            Správa kapacity →
          </Link>
        </div>

        {/* Today summary */}
        <div className="flex items-baseline gap-2 mb-4">
          <span
            className="text-4xl font-bold"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--admin-text)' }}
          >
            {todayOccupancy.queryFailed ? '—' : todayOccupancy.booked}
          </span>
          <span className="text-lg" style={{ color: 'var(--admin-text-muted)' }}>
            / {todayOccupancy.queryFailed ? '?' : todayOccupancy.maxDogs} psů
          </span>
          {!todayOccupancy.queryFailed && todayOccupancy.free === 0 && (
            <span
              className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#fee2e2', color: '#dc2626' }}
            >
              Plno
            </span>
          )}
          {!todayOccupancy.queryFailed && todayOccupancy.free > 0 && (
            <span
              className="ml-2 text-xs font-medium"
              style={{ color: 'var(--admin-text-muted)' }}
            >
              {todayOccupancy.free} volných míst
            </span>
          )}
        </div>

        {/* 7-day mini bar chart */}
        {'error' in weekOccupancy ? (
          <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
            Data nedostupná.
          </p>
        ) : (
          <div className="flex gap-1.5 items-end h-12">
            {weekOccupancy.map((n) => {
              const pct     = n.maxDogs > 0 ? n.booked / n.maxDogs : 0
              const barPct  = Math.min(pct, 1)
              const color   = pct >= 1 ? '#dc2626' : pct >= 0.75 ? '#d97706' : '#16a34a'
              const isToday = n.date === today
              return (
                <div key={n.date} className="flex flex-col items-center gap-1 flex-1">
                  <div className="w-full flex items-end" style={{ height: '36px' }}>
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height:     `${Math.max(barPct * 100, 4)}%`,
                        background: color,
                        opacity:    isToday ? 1 : 0.65,
                        outline:    isToday ? '2px solid var(--admin-accent)' : 'none',
                        outlineOffset: '2px',
                      }}
                    />
                  </div>
                  <span
                    className="text-[9px] tabular-nums"
                    style={{ color: isToday ? 'var(--admin-text)' : 'var(--admin-text-muted)', fontWeight: isToday ? 700 : 400 }}
                  >
                    {new Date(n.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
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
