import { getSiteSetting, getPageSections } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { SiteSettingsEditor } from '@/components/admin/cms/site-settings-editor'
import { PageSectionsEditor } from '@/components/admin/cms/page-sections-editor'

export const metadata = { title: 'Nastavení webu | VERDE Admin' }

export default async function AdminContentPage() {
  const [contact, seo, capacity, { data: sections }] = await Promise.all([
    getSiteSetting('contact'),
    getSiteSetting('seo'),
    getSiteSetting('capacity'),
    getPageSections(),
  ])

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader title="Nastavení webu" description="Kontakt, SEO, provoz a obsah stránek" />

      <div>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--admin-text-muted)' }}>
          Globální nastavení
        </h2>
        <SiteSettingsEditor initialContact={contact} initialSeo={seo} initialCapacity={capacity} />
      </div>

      <div>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--admin-text-muted)' }}>
          Obsah stránek (sekce)
        </h2>
        <PageSectionsEditor sections={sections ?? []} />
      </div>
    </div>
  )
}
