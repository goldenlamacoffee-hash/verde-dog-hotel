import type { Metadata } from 'next'
import { getMediaAssets } from '@/lib/admin/queries'
import { MediaLibrary } from '@/components/admin/media/media-library'

export const metadata: Metadata = { title: 'Média – Admin' }

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; tag?: string; page?: string }>
}) {
  const { search, tag, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const LIMIT = 48
  const offset = (page - 1) * LIMIT

  const { data, count } = await getMediaAssets({ search, tag, limit: LIMIT, offset })
  const assets = data ?? []
  const total = count ?? 0

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--admin-text)' }}>Média</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>
          Správa mediálních souborů referencovaných na webu ({total} záznamů)
        </p>
      </div>
      <MediaLibrary assets={assets} total={total} page={page} limit={LIMIT} search={search} tag={tag} />
    </div>
  )
}
