import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminLoginForm } from '@/components/admin/auth/login-form'
import '../../admin.css'

export const metadata = { title: 'Přihlášení | VERDE Admin' }

export default async function AdminLoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Already authenticated with a valid admin role -> send to dashboard
  if (user) {
    const { data: role } = await supabase
      .from('admin_roles')
      .select('active')
      .eq('user_id', user.id)
      .single()

    if (role?.active) {
      redirect('/admin')
    }
    // Has a session but no valid role: fall through and show login form
    // (the form's signOut will clear the stale session if needed)
  }

  return (
    <div
      className="admin-shell min-h-screen flex items-center justify-center"
      style={{ background: 'var(--admin-bg)' }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/verde-logo-green.png"
            alt="VERDE"
            className="mx-auto h-14 w-auto mb-4"
          />
          <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
            Administrace psího hotelu
          </p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  )
}
