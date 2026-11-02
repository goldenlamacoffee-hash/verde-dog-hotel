import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight, ChevronRight, ImageIcon } from 'lucide-react'
import { getPageSections } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { Breadcrumbs } from '@/components/admin/cms/breadcrumbs'
import { getPageBySlug, sectionThumbnail } from '@/lib/admin/cms-config'
import '@/components/admin/cms/cms.css'

export default async function AdminPageSectionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = getPageBySlug(slug)
  if (!page) notFound()

  const { data: rows } = await getPageSections(page.dbPage)
  const byKey = new Map((rows ?? []).map(r => [r.section_key as string, r]))

  const configured = page.sections.map(s => ({
    key: s.key,
    label: s.label,
    description: s.description,
  }))
  const configuredKeys = new Set(configured.map(s => s.key))
  const extra = (rows ?? [])
    .filter(r => !configuredKeys.has(r.section_key as string))
    .map(r => ({ key: r.section_key as string, label: r.section_key as string, description: 'Další sekce stránky' }))

  const items = [...configured, ...extra]

  return (
    <div className="max-w-4xl">
      <Breadcrumbs items={[{ label: 'Nastavení webu', href: '/admin/obsah' }, { label: page.label }]} />
      <PageHeader
        title={page.label}
        description={page.description}
        action={
          <Link href={page.href} target="_blank" className="cms-btn cms-btn-secondary cms-btn-sm">
            Zobrazit stránku
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />

      <ul className="space-y-3">
        {items.map(item => {
          const row = byKey.get(item.key)
          const content = (row?.content ?? {}) as Record<string, unknown>
          const thumb = sectionThumbnail(content)
          const hidden = row ? row.active === false : false
          return (
            <li key={item.key}>
              <Link
                href={`/admin/obsah/stranky/${page.slug}/${item.key}`}
                className="cms-card group flex items-center gap-4 p-4 transition-colors hover:border-[var(--admin-accent)]"
              >
                <div
                  className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)' }}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb || '/placeholder.svg'} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="size-5" style={{ color: 'var(--admin-text-muted)' }} aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold" style={{ color: 'var(--admin-text)' }}>
                      {item.label}
                    </p>
                    {hidden && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-card-border)' }}
                      >
                        Skryto
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--admin-text-muted)' }} aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
