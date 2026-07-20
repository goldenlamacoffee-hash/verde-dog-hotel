import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type AppRole = 'owner' | 'admin' | 'reception' | 'staff' | 'content_editor'

export interface AdminProfile {
  id: string
  email: string
  role: AppRole
  full_name: string | null
}

/** Returns the current user's profile+role or null if unauthenticated. */
export async function getAdminProfile(): Promise<AdminProfile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('admin_roles')
    .select('role, full_name')
    .eq('user_id', user.id)
    .single()

  if (!data) return null

  return {
    id: user.id,
    email: user.email ?? '',
    role: data.role as AppRole,
    full_name: data.full_name ?? null,
  }
}

/** Redirect to login if unauthenticated; optionally enforce minimum role. */
export async function requireAdmin(
  allowedRoles?: AppRole[],
): Promise<AdminProfile> {
  const profile = await getAdminProfile()
  if (!profile) redirect('/auth/login')

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    redirect('/admin?error=forbidden')
  }

  return profile
}

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Majitel',
  admin: 'Administrátor',
  reception: 'Recepce',
  staff: 'Personál',
  content_editor: 'Editor obsahu',
}

export function canManageUsers(role: AppRole) {
  return role === 'owner'
}

export function canManageSettings(role: AppRole) {
  return role === 'owner' || role === 'admin'
}

export function canManageReservations(role: AppRole) {
  return ['owner', 'admin', 'reception'].includes(role)
}

export function canManagePricing(role: AppRole) {
  return role === 'owner' || role === 'admin'
}

export function canManageContent(role: AppRole) {
  return ['owner', 'admin', 'content_editor'].includes(role)
}

export function canManageCapacity(role: AppRole) {
  return ['owner', 'admin', 'reception'].includes(role)
}

export function canViewDogs(role: AppRole) {
  return ['owner', 'admin', 'reception', 'staff'].includes(role)
}
