import Link from 'next/link'
import { getCustomers } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'

export const metadata = { title: 'Zákazníci | VERDE Admin' }

export default async function CustomersPage() {
  const { data: customers, count } = await getCustomers({ limit: 100 })

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Zákazníci" description={`${count ?? 0} zákazníků`} />

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--admin-card-border)', background: 'var(--admin-card)' }}
      >
        {!customers?.length ? (
          <p className="p-8 text-sm text-center" style={{ color: 'var(--admin-text-muted)' }}>
            Zatím žádní zákazníci.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                  {['Jméno', 'E-mail', 'Telefon', 'Město', 'Psi', 'VIP', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: 'var(--admin-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((c: any) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--admin-card-border)' }} className="hover:bg-gray-50/40">
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>
                      {c.first_name} {c.last_name}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--admin-text-muted)' }}>{c.email ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--admin-text-muted)' }}>{c.phone ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--admin-text-muted)' }}>{c.city ?? '—'}</td>
                    <td className="px-4 py-3 text-center" style={{ color: 'var(--admin-text-muted)' }}>
                      {c.dogs?.length ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {c.is_vip && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{ background: '#fef9c3', color: '#854d0e' }}>VIP</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/zakaznici/${c.id}`} className="text-xs font-medium" style={{ color: 'var(--admin-accent)' }}>
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
