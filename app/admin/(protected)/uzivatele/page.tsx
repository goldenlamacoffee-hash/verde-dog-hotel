import { getAdminRoles } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'

export const metadata = { title: 'Uživatelé | VERDE Admin' }

const ROLE_LABELS: Record<string, string> = {
  owner: 'Majitel', admin: 'Admin', reception: 'Recepce', staff: 'Personál', content_editor: 'Editor obsahu',
}

export default async function AdminUsersPage() {
  const { data: roles } = await getAdminRoles()

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Uživatelé" description="Správa přístupů do administrace" />

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--admin-card-border)', background: 'var(--admin-card)' }}
      >
        {!roles?.length ? (
          <p className="p-8 text-sm text-center" style={{ color: 'var(--admin-text-muted)' }}>
            Zatím žádní administrátoři.<br />
            <span className="text-xs">Přidejte záznamy do tabulky <code>admin_roles</code> v Supabase.</span>
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                {['Uživatel', 'Role', 'Aktivní', 'Přidán'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((r: any) => (
                <tr key={r.user_id} style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--admin-text)' }}>
                    {r.full_name || r.profiles?.full_name || r.user_id}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{ background: 'var(--admin-accent-light)', color: 'var(--admin-accent)' }}>
                      {ROLE_LABELS[r.role] ?? r.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.active
                      ? <span className="text-xs" style={{ color: 'var(--admin-success)' }}>Aktivní</span>
                      : <span className="text-xs" style={{ color: 'var(--admin-danger)' }}>Blokován</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                    {new Date(r.created_at).toLocaleDateString('cs-CZ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl p-4 text-sm" style={{ background: '#fffbeb', border: '1px solid #fed7aa', color: '#92400e' }}>
        <strong>Poznámka:</strong> Nové admin uživatele registrujte přes Supabase Auth (Authentication &rarr; Users) a poté přidejte záznam do tabulky{' '}
        <code className="font-mono text-xs">admin_roles</code>.
      </div>
    </div>
  )
}
