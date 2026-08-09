import { getSiteSetting, getPageSections, getMediaAssets } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { SiteSettingsEditor } from '@/components/admin/cms/site-settings-editor'
import { PageSectionsEditor } from '@/components/admin/cms/page-sections-editor'

export const metadata = { title: 'Nastavení webu | VERDE Admin' }

export default async function AdminContentPage() {
  const [contact, seo, capacity, brand, { data: sections }, { data: mediaData }] = await Promise.all([
    getSiteSetting('contact'),
    getSiteSetting('seo'),
    getSiteSetting('capacity'),
    getSiteSetting('brand'),
    getPageSections(),
    getMediaAssets({ limit: 200 }),
  ])

  const mediaAssets = (mediaData ?? []).map((a: Record<string, unknown>) => ({
    id:           a.id as string,
    filename:     a.filename as string,
    storage_path: a.storage_path as string,
    public_url:   a.public_url as string,
    mime_type:    (a.mime_type ?? null) as string | null,
    size_bytes:   (a.size_bytes ?? null) as number | null,
    alt:          (a.alt ?? null) as string | null,
    tags:         (a.tags ?? null) as string[] | null,
    created_at:   a.created_at as string,
  }))

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader title="Nastavení webu" description="Kontakt, SEO, provoz a obsah stránek" />

      <div>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--admin-text-muted)' }}>
          Globální nastavení
        </h2>
        <SiteSettingsEditor initialContact={contact} initialSeo={seo} initialCapacity={capacity} initialBrand={brand as Record<string, string> | null} />
      </div>

      <div>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--admin-text-muted)' }}>
          Obsah stránek (sekce)
        </h2>
        <PageSectionsEditor
          sections={sections ?? []}
          mediaAssets={mediaAssets}
          mediaTotal={mediaAssets.length}
        />
      </div>
    </div>
  )
}
