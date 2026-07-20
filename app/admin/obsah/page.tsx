import { getSiteSetting } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { SiteSettingsEditor } from '@/components/admin/cms/site-settings-editor'

export const metadata = { title: 'Nastavení webu | VERDE Admin' }

export default async function AdminContentPage() {
  const [contact, seo, capacity] = await Promise.all([
    getSiteSetting('contact'),
    getSiteSetting('seo'),
    getSiteSetting('capacity'),
  ])

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Nastavení webu" description="Kontakt, SEO a provoz" />
      <SiteSettingsEditor initialContact={contact} initialSeo={seo} initialCapacity={capacity} />
    </div>
  )
}
