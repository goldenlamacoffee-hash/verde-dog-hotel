import { notFound } from 'next/navigation'
import { getPageSections, getSiteSetting } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { Breadcrumbs } from '@/components/admin/cms/breadcrumbs'
import { SectionEditor } from '@/components/admin/cms/section-editor'
import {
  BrandEditor,
  CapacityEditor,
  ContactSettingsEditor,
  SeoEditor,
} from '@/components/admin/cms/settings-editors'
import { FOOTER_SECTION, GLOBAL_SCREENS, HEADER_SECTION, type SectionDef } from '@/lib/admin/cms-config'
import type { ContactSettingsValue } from '@/lib/types'

type Obj = Record<string, unknown>

async function GlobalSection({ def }: { def: SectionDef }) {
  const { data: rows } = await getPageSections('global')
  const row = (rows ?? []).find(r => r.section_key === def.key)
  return (
    <SectionEditor
      key={`global-${def.key}-${row?.updated_at ?? 'new'}`}
      page="global"
      sectionKey={def.key}
      label={def.label}
      initialContent={((row?.content as Obj | null) ?? {}) as Obj}
      initialActive={row?.active ?? true}
      sortOrder={row?.sort_order ?? undefined}
      fields={def.fields}
      showVisibility={false}
    />
  )
}

export default async function AdminGlobalSettingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const screen = GLOBAL_SCREENS.find(s => s.slug === slug)
  if (!screen) notFound()

  let body: React.ReactNode
  switch (slug) {
    case 'header':
      body = <GlobalSection def={HEADER_SECTION} />
      break
    case 'footer':
      body = <GlobalSection def={FOOTER_SECTION} />
      break
    case 'seo': {
      const [seo, brand] = await Promise.all([getSiteSetting('seo'), getSiteSetting('brand')])
      body = <SeoEditor initial={seo as Obj | null} ogImage={String((brand as Obj | null)?.ogImage ?? '')} />
      break
    }
    case 'brand':
      body = <BrandEditor initial={(await getSiteSetting('brand')) as Obj | null} />
      break
    case 'kontaktni-udaje':
      body = <ContactSettingsEditor initial={(await getSiteSetting('contact')) as ContactSettingsValue | null} />
      break
    case 'provoz':
      body = <CapacityEditor initial={(await getSiteSetting('capacity')) as Obj | null} />
      break
    default:
      notFound()
  }

  return (
    <div className="max-w-4xl">
      <Breadcrumbs items={[{ label: 'Nastavení webu', href: '/admin/obsah' }, { label: screen.label }]} />
      <PageHeader title={screen.label} description={screen.description} />
      {body}
    </div>
  )
}
