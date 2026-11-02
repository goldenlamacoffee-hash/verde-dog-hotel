import { notFound } from 'next/navigation'
import { getPageSections } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { Breadcrumbs } from '@/components/admin/cms/breadcrumbs'
import { SectionEditor } from '@/components/admin/cms/section-editor'
import { getPageBySlug } from '@/lib/admin/cms-config'

export default async function AdminSectionEditPage({
  params,
}: {
  params: Promise<{ slug: string; section: string }>
}) {
  const { slug, section } = await params
  const page = getPageBySlug(slug)
  if (!page) notFound()

  const def = page.sections.find(s => s.key === section)
  const { data: rows } = await getPageSections(page.dbPage)
  const row = (rows ?? []).find(r => r.section_key === section)
  if (!def && !row) notFound()

  const label = def?.label ?? section
  const content = ((row?.content as Record<string, unknown> | null) ?? {}) as Record<string, unknown>

  return (
    <div className="max-w-4xl">
      <Breadcrumbs
        items={[
          { label: 'Nastavení webu', href: '/admin/obsah' },
          { label: page.label, href: `/admin/obsah/stranky/${page.slug}` },
          { label },
        ]}
      />
      <PageHeader title={label} description={def?.description} />
      <SectionEditor
        // Remount when the saved row changes so the editor baseline matches the database.
        key={`${page.dbPage}-${section}-${row?.updated_at ?? 'new'}`}
        page={page.dbPage}
        sectionKey={section}
        label={label}
        initialContent={content}
        initialActive={row?.active ?? true}
        sortOrder={row?.sort_order ?? undefined}
        fields={def?.fields}
      />
    </div>
  )
}
