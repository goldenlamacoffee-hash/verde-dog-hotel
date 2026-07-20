import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/shell/sidebar'
import { AdminTopbar } from '@/components/admin/shell/topbar'
import '../admin/admin.css'

export const metadata = { title: 'Admin | VERDE' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')

  // Check admin role
  const { data: role } = await supabase
    .from('admin_roles')
    .select('role, full_name, active')
    .eq('user_id', user.id)
    .single()

  if (!role || !role.active) redirect('/admin/login')

  const adminUser = {
    id: user.id,
    email: user.email ?? '',
    name: role.full_name ?? user.email ?? '',
    role: role.role as string,
  }

  return (
    <div className="admin-shell flex min-h-screen" style={{ background: 'var(--admin-bg)', color: 'var(--admin-text)' }}>
      <AdminSidebar userRole={adminUser.role} />
      <div className="flex flex-1 flex-col min-w-0">
        <AdminTopbar user={adminUser} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
