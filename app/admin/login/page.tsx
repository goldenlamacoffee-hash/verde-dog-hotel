import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminLoginForm } from '@/components/admin/auth/login-form'

export const metadata = { title: 'Přihlášení | VERDE Admin' }

export default async function AdminLoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/admin')

  return (
    <div className="admin-shell min-h-screen flex items-center justify-center" style={{ background: 'var(--admin-bg)' }}>
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
