interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-1"
      style={{
        background: accent ? 'var(--admin-accent)' : 'var(--admin-card)',
        border: accent ? 'none' : '1px solid var(--admin-card-border)',
        color: accent ? '#fff' : 'var(--admin-text)',
      }}
    >
      <p className="text-xs font-medium uppercase tracking-wider" style={{ opacity: 0.65 }}>
        {label}
      </p>
      <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-serif)' }}>
        {value}
      </p>
      {sub && <p className="text-xs" style={{ opacity: 0.6 }}>{sub}</p>}
    </div>
  )
}
