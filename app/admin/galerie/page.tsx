import { getAdminGallery } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { GalleryEditor } from '@/components/admin/cms/gallery-editor'

export const metadata = { title: 'Galerie | VERDE Admin' }

export default async function AdminGalleryPage() {
  const { data: items } = await getAdminGallery()
  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader title="Galerie" description="Správa fotografií na webu" />
      <GalleryEditor initialItems={items ?? []} />
    </div>
  )
}
