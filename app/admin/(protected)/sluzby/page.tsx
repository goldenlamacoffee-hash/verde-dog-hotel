import { getAdminServicesCatalogue, getAdminServiceCategories } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { ServicesCatalogueManager } from '@/components/admin/services/services-catalogue-manager'
import type { ServiceRow, ServiceCategoryRow } from '@/lib/types'

export const metadata = { title: 'Katalog služeb | VERDE Admin' }

export default async function ServicesPage() {
  const [{ data: services }, { data: categories }] = await Promise.all([
    getAdminServicesCatalogue(),
    getAdminServiceCategories(),
  ])

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Katalog služeb"
        description="Správa nabídky, cen a nastavení dostupnosti. Archivované služby zůstávají v historii rezervací."
      />
      <ServicesCatalogueManager
        initialServices={(services ?? []) as unknown as ServiceRow[]}
        initialCategories={(categories ?? []) as unknown as ServiceCategoryRow[]}
      />
    </div>
  )
}
