import Link from 'next/link'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { getPageSections } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { GLOBAL_SCREENS, PAGES, EXTRA_PAGES } from '@/lib/admin/cms-config'
import '@/components/admin/cms/cms.css'

export const metadata = { title: 'Nastavení webu | VERDE Admin' }

function PageLinkCard({
  href,
  title,
  description,
  meta,
}: {
  href: string
  title: string
  description: string
  meta?: string
}) {
  return (
    <Link
      href={href}
      className="cms-card group flex items-center justify-between gap-4 p-5 transition-colors hover:border-[var(--admin-accent)]"
    >
      <div className="min-w-0">
        <p className="font-semibold" style={{ color: 'var(--admin-text)' }}>
          {title}
        </p>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
          {description}
        </p>
        {meta && (
          <p className="mt-2 text-xs font-medium" style={{ color: 'var(--admin-accent)' }}>
            {meta}
          </p>
        )}
      </div>
      <ChevronRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--admin-text-muted)' }} aria-hidden="true" />
    </Link>
  )
}

function plural(n: number) {
  return n === 1 ? 'sekce' : n >= 2 && n <= 4 ? 'sekce' : 'sekcí'
}

export default async function AdminContentPage() {
  const { data: rows } = await getPageSections()
  const sections = rows ?? []

  const countFor = (dbPage: string, configured: number) => {
    const extra = sections.filter(r => r.page === dbPage).length
    return Math.max(configured, extra)
  }

  return (
    <div className="max-w-4xl space-y-10">
      <PageHeader
        title="Nastavení webu"
        description="Vyberte stránku nebo část webu, kterou chcete upravit."
        action={
          <Link href="/" target="_blank" className="cms-btn cms-btn-secondary cms-btn-sm">
            Zobrazit web
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />

      <section aria-labelledby="pages-heading" className="space-y-3">
        <h2 id="pages-heading" className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--admin-text-muted)' }}>
          Stránky
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PAGES.map(p => {
            const n = countFor(p.dbPage, p.sections.length)
            return (
              <PageLinkCard
                key={p.slug}
                href={`/admin/obsah/stranky/${p.slug}`}
                title={p.label}
                description={p.description}
                meta={`${n} ${plural(n)}`}
              />
            )
          })}
        </div>
      </section>

      <section aria-labelledby="global-heading" className="space-y-3">
        <h2 id="global-heading" className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--admin-text-muted)' }}>
          Celý web
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {GLOBAL_SCREENS.map(g => (
            <PageLinkCard key={g.slug} href={`/admin/obsah/globalni/${g.slug}`} title={g.label} description={g.description} />
          ))}
        </div>
      </section>

      <section aria-labelledby="more-heading" className="space-y-3">
        <h2 id="more-heading" className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--admin-text-muted)' }}>
          Další stránky
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {EXTRA_PAGES.map(p => (
            <PageLinkCard key={p.slug} href={`/admin/obsah/stranky/${p.slug}`} title={p.label} description={p.description} />
          ))}
        </div>
      </section>
    </div>
  )
}
