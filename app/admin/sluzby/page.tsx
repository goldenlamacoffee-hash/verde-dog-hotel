import { getAdminServices } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'

export const metadata = { title: 'Služby & Ceník | VERDE Admin' }

const UNIT_LABELS: Record<string, string> = {
  night: '/ noc', day: '/ den', stay: '/ pobyt', item: '/ položku', hour: '/ hod', month: '/ měs.',
}

export default async function ServicesPage() {
  const { data: services } = await getAdminServices()

  // Group by category
  const grouped: Record<string, any[]> = {}
  for (const s of (services ?? [])) {
    const cat = s.service_categories?.name ?? 'Ostatní'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(s)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Služby & Ceník" description="Správa nabídky a cen" />

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--admin-card-border)', background: 'var(--admin-card)' }}
        >
          <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider"
               style={{ borderBottom: '1px solid var(--admin-card-border)', color: 'var(--admin-text-muted)' }}>
            {cat}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                {['Název', 'Popis', 'Cena', 'Na webu', 'Aktivní'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((s: any) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>
                    {s.title}
                    {s.standard && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--admin-accent-light)', color: 'var(--admin-accent)' }}>
                        Standard
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-xs" style={{ color: 'var(--admin-text-muted)' }}>{s.description ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold whitespace-nowrap" style={{ color: 'var(--admin-text)' }}>
                    {Number(s.price).toLocaleString('cs-CZ')} Kč {UNIT_LABELS[s.unit] ?? ''}
                  </td>
                  <td className="px-4 py-3">
                    {s.show_on_web
                      ? <span className="text-xs" style={{ color: 'var(--admin-success)' }}>Ano</span>
                      : <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>Ne</span>}
                  </td>
                  <td className="px-4 py-3">
                    {s.active
                      ? <span className="text-xs" style={{ color: 'var(--admin-success)' }}>Aktivní</span>
                      : <span className="text-xs" style={{ color: 'var(--admin-danger)' }}>Neaktivní</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
