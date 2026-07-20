import { getAuditLog } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'

export const metadata = { title: 'Audit log | VERDE Admin' }

const ACTION_STYLES: Record<string, { bg: string; color: string }> = {
  INSERT: { bg: '#dcfce7', color: '#166534' },
  UPDATE: { bg: '#fef9c3', color: '#713f12' },
  DELETE: { bg: '#fee2e2', color: '#991b1b' },
}

function fmt(d: string) {
  return new Date(d).toLocaleString('cs-CZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; table?: string }>
}) {
  const { page: pageParam, table } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const limit = 50
  const offset = (page - 1) * limit

  const { data: entries, count } = await getAuditLog({ tableName: table, limit, offset })
  const totalPages = Math.ceil((count ?? 0) / limit)

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Audit log"
        description="Přehled všech změn v systému"
      />

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--admin-card-border)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--admin-card)', borderBottom: '1px solid var(--admin-card-border)' }}>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>Čas</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>Akce</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>Tabulka</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>ID záznamu</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>Změněno</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--admin-text-muted)' }}>
                  Žádné záznamy.
                </td>
              </tr>
            ) : (entries ?? []).map((e: any) => {
              const style = ACTION_STYLES[e.action] ?? { bg: '#f3f4f6', color: '#374151' }
              return (
                <tr
                  key={e.id}
                  style={{ borderBottom: '1px solid var(--admin-card-border)' }}
                  className="transition-colors hover:bg-[var(--admin-card)]"
                >
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                    {fmt(e.changed_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--admin-text)' }}>
                    {e.table_name}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs max-w-[12rem] truncate" style={{ color: 'var(--admin-text-muted)' }}>
                    {e.record_id}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                    {e.changed_by?.slice(0, 8) ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm" style={{ color: 'var(--admin-text-muted)' }}>
          <span>Strana {page} z {totalPages} ({count} záznamů)</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/admin/audit?page=${page - 1}${table ? `&table=${table}` : ''}`}
                className="rounded-lg px-3 py-1.5 font-medium transition-colors"
                style={{ background: 'var(--admin-card)', color: 'var(--admin-accent)' }}
              >
                Předchozí
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/admin/audit?page=${page + 1}${table ? `&table=${table}` : ''}`}
                className="rounded-lg px-3 py-1.5 font-medium transition-colors"
                style={{ background: 'var(--admin-card)', color: 'var(--admin-accent)' }}
              >
                Další
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
