import { getReservationsForRange, getSiteSetting } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { StatusBadge } from '@/components/admin/ui/status-badge'

export const metadata = { title: 'Kapacita | VERDE Admin' }

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmtDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function dayLabel(d: Date) {
  return d.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' })
}

export default async function CapacityPage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fromStr = fmtDate(today)
  const toStr = fmtDate(addDays(today, 27))

  const [{ data: reservations }, capacitySetting] = await Promise.all([
    getReservationsForRange(fromStr, toStr),
    getSiteSetting('capacity'),
  ])

  const maxDogs: number = capacitySetting?.maxDogs ?? 12
  const days: Date[] = Array.from({ length: 28 }, (_, i) => addDays(today, i))

  // Build occupancy map: date string -> count of dogs
  const occupancy: Record<string, number> = {}
  const resByDay: Record<string, any[]> = {}
  for (const d of days) {
    const key = fmtDate(d)
    occupancy[key] = 0
    resByDay[key] = []
  }
  for (const r of (reservations ?? [])) {
    const arr = new Date(r.arrival_date)
    const dep = new Date(r.departure_date)
    const dogCount = r.reservation_dogs?.length || 1
    for (const d of days) {
      if (d >= arr && d < dep) {
        const key = fmtDate(d)
        occupancy[key] = (occupancy[key] ?? 0) + dogCount
        resByDay[key].push(r)
      }
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Kapacita"
        description={`Přehled obsazenosti na 28 dní · max. ${maxDogs} psů`}
      />

      {/* Occupancy grid */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--admin-text-muted)' }}>
          Obsazenost boxů
        </h2>
        <div className="grid grid-cols-7 gap-2">
          {days.map(d => {
            const key = fmtDate(d)
            const count = occupancy[key] ?? 0
            const pct = count / maxDogs
            const isToday = key === fromStr
            const bgColor = pct >= 1 ? '#dc2626' : pct >= 0.75 ? '#d97706' : pct >= 0.4 ? '#16a34a' : '#e5e7eb'
            const textColor = pct >= 0.4 ? '#fff' : 'var(--admin-text)'
            return (
              <div
                key={key}
                className="rounded-xl p-2 text-center transition-colors"
                style={{
                  background: bgColor,
                  color: textColor,
                  outline: isToday ? '2px solid var(--admin-accent)' : 'none',
                  outlineOffset: '2px',
                }}
              >
                <p className="text-[10px] font-medium opacity-80">{dayLabel(d)}</p>
                <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-serif)' }}>{count}</p>
                <p className="text-[10px] opacity-70">/ {maxDogs}</p>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-4 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-[#e5e7eb]" /> Volno</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-[#16a34a]" /> Obsazeno 40–75%</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-[#d97706]" /> Téměř plno</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-[#dc2626]" /> Plno</span>
        </div>
      </div>

      {/* Today's reservations */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--admin-text-muted)' }}>
          Dnes ubytovaní
        </h2>
        {(resByDay[fromStr] ?? []).length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>Dnes nikdo ubytovaný.</p>
        ) : (
          <div className="space-y-2">
            {resByDay[fromStr].map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm p-3 rounded-lg"
                   style={{ background: 'var(--admin-bg)' }}>
                <div>
                  <span className="font-mono text-xs font-semibold" style={{ color: 'var(--admin-accent)' }}>{r.ref_number}</span>
                  <span className="ml-3" style={{ color: 'var(--admin-text)' }}>
                    {r.customer ? `${r.customer.first_name} ${r.customer.last_name}` : '—'}
                  </span>
                  <span className="ml-2 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                    {r.reservation_dogs?.map((rd: any) => rd.dog?.name).join(', ')}
                  </span>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
