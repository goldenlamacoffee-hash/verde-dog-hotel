import { requireAdmin } from '@/lib/auth/roles'
import { getAdminUsersWithAuth } from '@/lib/admin/queries'
import { UsersManager } from '@/components/admin/users/users-manager'

export const metadata = { title: 'Uživatelé | VERDE Admin' }

// Always fetch fresh so changes reflect immediately
export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  // Require at minimum admin role; only owner sees full management controls
  const caller = await requireAdmin(['owner', 'admin'])

  const users = await getAdminUsersWithAuth()

  return (
    <div className="max-w-5xl">
      <UsersManager
        users={users}
        callerRole={caller.role}
        callerId={caller.id}
      />
    </div>
  )
}
