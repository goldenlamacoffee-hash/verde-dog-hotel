import { getAdminTestimonials } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { TestimonialsEditor } from '@/components/admin/cms/testimonials-editor'

export const metadata = { title: 'Recenze | VERDE Admin' }

export default async function AdminTestimonialsPage() {
  const { data: items } = await getAdminTestimonials()
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Recenze" description="Zobrazené na úvodní stránce" />
      <TestimonialsEditor initialItems={items ?? []} />
    </div>
  )
}
