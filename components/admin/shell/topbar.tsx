'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TopbarProps {
  user: { name: string; email: string; role: string }
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Majitel',
  admin: 'Admin',
  reception: 'Recepce',
  staff: 'Personál',
  content_editor: 'Editor',
}

export function AdminTopbar({ user }: TopbarProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <header
      className="flex items-center justify-between px-6 py-3 shrink-0"
      style={{
        background: 'var(--admin-card)',
        borderBottom: '1px solid var(--admin-card-border)',
        minHeight: '56px',
      }}
    >
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium leading-tight" style={{ color: 'var(--admin-text)' }}>
            {user.name}
          </p>
          <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
            {ROLE_LABELS[user.role] ?? user.role}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: 'var(--admin-accent-light)',
            color: 'var(--admin-accent)',
            border: '1px solid transparent',
          }}
        >
          <LogOutIcon className="w-3.5 h-3.5" />
          Odhlásit
        </button>
      </div>
    </header>
  )
}

function LogOutIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
