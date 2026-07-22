import Link from 'next/link'
import { getDogs } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'

export const metadata = { title: 'Psi | VERDE Admin' }

export default async function DogsPage() {
  const { data: dogs } = await getDogs()

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Psi" description={`${dogs?.length ?? 0} psů v databázi`} />

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--admin-card-border)', background: 'var(--admin-card)' }}
      >
        {!dogs?.length ? (
          <p className="p-8 text-sm text-center" style={{ color: 'var(--admin-text-muted)' }}>Zatím žádní psi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                  {['Jméno', 'Plemeno', 'Pohlaví', 'Hmotnost', 'Očkování', 'Majitel', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dogs.map((d: any) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--admin-card-border)' }} className="hover:bg-gray-50/40">
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>{d.name}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--admin-text-muted)' }}>
                      {d.dog_breeds?.name ?? d.breed_other ?? '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--admin-text-muted)' }}>
                      {d.sex === 'male' ? 'Pes' : d.sex === 'female' ? 'Fena' : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--admin-text-muted)' }}>
                      {d.weight_kg ? `${d.weight_kg} kg` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {d.vaccinated
                        ? <span className="text-xs" style={{ color: 'var(--admin-success)' }}>Platné</span>
                        : <span className="text-xs" style={{ color: 'var(--admin-danger)' }}>Chybí</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--admin-text-muted)' }}>
                      {d.customers ? `${d.customers.first_name} ${d.customers.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/zakaznici/${d.customer_id}`} className="text-xs font-medium" style={{ color: 'var(--admin-accent)' }}>
                        Majitel →
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
