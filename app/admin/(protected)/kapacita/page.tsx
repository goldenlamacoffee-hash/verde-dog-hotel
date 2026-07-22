import { getSiteSetting, getCapacityOverrides } from '@/lib/admin/queries'
import { updateSiteSetting } from '@/lib/admin/actions'
import { getOccupancyForRange } from '@/lib/capacity'
import { PageHeader } from '@/components/admin/ui/page-header'
import { CapacityOverridesPanel } from '@/components/admin/capacity/capacity-overrides-panel'

export const metadata = { title: 'Kapacita | VERDE Admin' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmtDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function fmtDisplay(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', {
    weekday: 'short',
    day:     'numeric',
    month:   'numeric',
  })
}

// ─── Capacity editor server action ────────────────────────────────────────────

async function saveCapacity(formData: FormData) {
  'use server'
  const raw = Number(formData.get('maxDogs'))
  if (isNaN(raw) || raw < 1 || raw > 50) return
  await updateSiteSetting('capacity', { maxDogs: raw, boxes: raw })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CapacityPage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fromStr  = fmtDate(today)
  const toStr    = fmtDate(addDays(today, 30))

  const [capacitySetting, { data: overrides }, occupancyResult] = await Promise.all([
    getSiteSetting('capacity'),
    getCapacityOverrides(),
    getOccupancyForRange(fromStr, toStr),
  ])

  const maxDogs: number =
    capacitySetting && typeof capacitySetting === 'object'
      ? ((capacitySetting as Record<string, unknown>).maxDogs as number) ?? 6
      : 6

  const nights = 'error' in occupancyResult ? [] : occupancyResult

  // Warn if any confirmed future occupancy exceeds a possible new cap
  const maxFutureBooked = nights.reduce((m, n) => Math.max(m, n.booked), 0)

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Kapacita"
        description="Správa maximální kapacity, blokací a přehled obsazenosti"
      />

      {/* ── Capacity editor ─────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--admin-text-muted)' }}
        >
          Maximální kapacita hotelu
        </h2>

        <form action={saveCapacity} className="flex items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="maxDogs"
              className="text-xs font-medium"
              style={{ color: 'var(--admin-text-muted)' }}
            >
              Počet míst (psů) celkem
            </label>
            <input
              id="maxDogs"
              name="maxDogs"
              type="number"
              min={1}
              max={50}
              defaultValue={maxDogs}
              className="w-24 rounded-lg px-3 py-2 text-sm font-semibold text-center"
              style={{
                background: 'var(--admin-bg)',
                border:     '1px solid var(--admin-card-border)',
                color:      'var(--admin-text)',
              }}
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--admin-accent)', color: '#fff' }}
          >
            Uložit kapacitu
          </button>

          <p className="text-xs self-center" style={{ color: 'var(--admin-text-muted)' }}>
            Aktuálně nastaveno: <span className="font-bold" style={{ color: 'var(--admin-text)' }}>{maxDogs} psů</span>
          </p>
        </form>

        {maxFutureBooked > 0 && (
          <p className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: '#fef9c3', color: '#92400e' }}>
            Upozornění: v nejbližších 30 dnech je nejvyšší obsazenost {maxFutureBooked} psů.
            Nastavení kapacity pod tuto hodnotu zablokuje nové rezervace.
          </p>
        )}
      </div>

      {/* ── 30-day occupancy table ──────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--admin-text-muted)' }}
        >
          Obsazenost — příštích 30 nocí
        </h2>

        {'error' in occupancyResult ? (
          <p className="text-sm" style={{ color: '#dc2626' }}>
            Nepodařilo se načíst data obsazenosti.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                  {['Datum', 'Obsazeno', 'Kapacita', 'Volno', 'Stav'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--admin-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nights.map((row) => {
                  const pct     = row.booked / row.maxDogs
                  const isToday = row.date === fromStr
                  let statusLabel: string
                  let statusColor: string
                  if (row.free === 0) {
                    statusLabel = 'Plno'
                    statusColor = '#dc2626'
                  } else if (pct >= 0.75) {
                    statusLabel = 'Téměř plno'
                    statusColor = '#d97706'
                  } else if (pct >= 0.25) {
                    statusLabel = 'Obsazeno'
                    statusColor = '#16a34a'
                  } else {
                    statusLabel = 'Volno'
                    statusColor = 'var(--admin-text-muted)'
                  }
                  return (
                    <tr
                      key={row.date}
                      style={{
                        borderBottom:  '1px solid var(--admin-card-border)',
                        background:    isToday ? 'var(--admin-bg)' : undefined,
                        fontWeight:    isToday ? 600 : undefined,
                      }}
                    >
                      <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--admin-text)' }}>
                        {isToday && (
                          <span
                            className="mr-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
                            style={{ background: 'var(--admin-accent)', color: '#fff' }}
                          >
                            Dnes
                          </span>
                        )}
                        {fmtDisplay(row.date)}
                      </td>
                      <td className="px-3 py-2 tabular-nums font-semibold" style={{ color: 'var(--admin-text)' }}>
                        {row.booked}
                      </td>
                      <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--admin-text-muted)' }}>
                        {row.maxDogs}
                      </td>
                      <td className="px-3 py-2 tabular-nums font-semibold" style={{ color: row.free === 0 ? '#dc2626' : 'var(--admin-text)' }}>
                        {row.free}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-semibold" style={{ color: statusColor }}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Capacity overrides ──────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--admin-text-muted)' }}
        >
          Blokace a omezení kapacity
        </h2>
        <CapacityOverridesPanel overrides={overrides ?? []} />
      </div>
    </div>
  )
}
