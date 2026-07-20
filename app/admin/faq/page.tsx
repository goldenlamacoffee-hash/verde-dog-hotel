import { getAdminFaq } from '@/lib/admin/queries'
import { PageHeader } from '@/components/admin/ui/page-header'
import { FaqEditor } from '@/components/admin/cms/faq-editor'

export const metadata = { title: 'FAQ | VERDE Admin' }

export default async function AdminFaqPage() {
  const { data: items } = await getAdminFaq()

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="FAQ" description="Nejčastěji kladené otázky na webu" />
      <FaqEditor initialItems={items ?? []} />
    </div>
  )
}
