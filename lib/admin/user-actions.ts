'use server'

/**
 * lib/admin/user-actions.ts
 *
 * Server Actions for admin user management.
 *
 * All Supabase Auth admin operations use the SERVICE ROLE client.
 * This file must NEVER be imported in Client Components.
 * The service-role key is NEVER sent to the browser.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  getAdminProfile,
  canManageUsers,
  ROLE_LABELS,
  type AppRole,
} from '@/lib/auth/roles'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REVALIDATE = () => revalidatePath('/admin/uzivatele')

const VALID_ROLES: AppRole[] = [
  'owner', 'admin', 'reception', 'staff', 'content_editor',
]

function isValidRole(r: unknown): r is AppRole {
  return VALID_ROLES.includes(r as AppRole)
}

/** Write an audit_log entry for user-management events. */
async function auditUserEvent(
  actorId: string,
  targetUserId: string,
  action: string,
  meta: Record<string, unknown> = {},
) {
  const admin = createServiceRoleClient()
  await admin.from('audit_log').insert({
    table_name: 'admin_roles',
    record_id: targetUserId,
    action,
    new_data: { actor_id: actorId, target_user_id: targetUserId, ...meta },
    changed_by: actorId,
  })
}

/** Count active owners — used to guard last-owner safety checks. */
async function countActiveOwners(): Promise<number> {
  const admin = createServiceRoleClient()
  const { count } = await admin
    .from('admin_roles')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'owner')
    .eq('active', true)
  return count ?? 0
}

// ─── Action results ───────────────────────────────────────────────────────────

export interface ActionResult {
  ok: boolean
  error?: string
}

// ─── Invite a new admin user ──────────────────────────────────────────────────

export async function inviteAdminUser(payload: {
  first_name: string
  last_name: string
  email: string
  role: string
  message?: string
}): Promise<ActionResult> {
  // 1. Verify the current caller is an active owner
  const caller = await getAdminProfile()
  if (!caller) return { ok: false, error: 'Nepřihlášen.' }
  if (!canManageUsers(caller.role)) {
    return { ok: false, error: 'Nemáte oprávnění spravovat uživatele.' }
  }

  // 2. Validate inputs
  const email = payload.email.trim().toLowerCase()
  const role = payload.role as AppRole
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Neplatný e-mail.' }
  }
  if (!isValidRole(role)) {
    return { ok: false, error: 'Neplatná role.' }
  }
  // Only owners may assign another owner
  if (role === 'owner' && caller.role !== 'owner') {
    return { ok: false, error: 'Roli vlastníka může přiřadit pouze jiný vlastník.' }
  }

  const full_name = `${payload.first_name.trim()} ${payload.last_name.trim()}`.trim()

  const admin = createServiceRoleClient()

  // 3. Check if email already exists in auth.users
  const { data: { users: existing } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existingUser = existing?.find((u) => u.email?.toLowerCase() === email)

  let authUserId: string

  if (existingUser) {
    // Email already has an Auth account — check if they already have an admin_roles row
    const { data: existingRole } = await admin
      .from('admin_roles')
      .select('user_id, role, active')
      .eq('user_id', existingUser.id)
      .single()

    if (existingRole) {
      return {
        ok: false,
        error: `Uživatel s tímto e-mailem již má přístup do administrace (role: ${ROLE_LABELS[existingRole.role as AppRole] ?? existingRole.role}).`,
      }
    }

    // Existing Auth user without admin access — create admin_roles row only
    authUserId = existingUser.id
  } else {
    // 4. Send Supabase invite email
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'vercel.app') ??
      ''

    const redirectTo = `${siteUrl}/auth/callback?next=/admin/nastavit-heslo`

    const { data: inviteData, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { full_name, role, invited_by: caller.id },
      })

    if (inviteErr || !inviteData?.user) {
      // Surface SMTP/email config issues clearly
      const msg = inviteErr?.message ?? 'Pozvánka se nepodařila.'
      if (
        msg.toLowerCase().includes('smtp') ||
        msg.toLowerCase().includes('email') ||
        msg.toLowerCase().includes('sending')
      ) {
        return {
          ok: false,
          error: `Chyba konfigurace e-mailu: ${msg}. Ověřte nastavení SMTP v Supabase.`,
        }
      }
      return { ok: false, error: msg }
    }

    authUserId = inviteData.user.id
  }

  // 5. Upsert profile row
  const { error: profileErr } = await admin
    .from('profiles')
    .upsert(
      { id: authUserId, full_name },
      { onConflict: 'id' },
    )

  // Profile upsert failure is non-fatal — log but continue
  if (profileErr) {
    console.error('[verde] profile upsert failed:', profileErr.message)
  }

  // 6. Insert admin_roles row — clean up Auth user on failure
  const { error: roleErr } = await admin.from('admin_roles').insert({
    user_id: authUserId,
    role,
    full_name,
    active: true,
  })

  if (roleErr) {
    // Attempt cleanup of newly-created Auth user only (not existing users)
    if (!existingUser) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => {})
    }
    return { ok: false, error: `Nepodařilo se přidat roli: ${roleErr.message}` }
  }

  // 7. Audit
  await auditUserEvent(caller.id, authUserId, 'user_invited', {
    email,
    role,
    full_name,
  })

  REVALIDATE()
  return { ok: true }
}

// ─── Update a user (name, role, active) ──────────────────────────────────────

export async function updateAdminUser(payload: {
  user_id: string
  full_name: string
  role: AppRole
  active: boolean
}): Promise<ActionResult> {
  const caller = await getAdminProfile()
  if (!caller) return { ok: false, error: 'Nepřihlášen.' }
  if (!canManageUsers(caller.role)) {
    return { ok: false, error: 'Nemáte oprávnění spravovat uživatele.' }
  }

  const { user_id, full_name, role, active } = payload

  if (!isValidRole(role)) return { ok: false, error: 'Neplatná role.' }

  const admin = createServiceRoleClient()

  // Fetch current state
  const { data: current, error: fetchErr } = await admin
    .from('admin_roles')
    .select('role, active, full_name')
    .eq('user_id', user_id)
    .single()

  if (fetchErr || !current) return { ok: false, error: 'Uživatel nebyl nalezen.' }

  // Only owners may assign/modify owner role
  if (
    (role === 'owner' || current.role === 'owner') &&
    caller.role !== 'owner'
  ) {
    return {
      ok: false,
      error: 'Roli vlastníka může měnit pouze jiný vlastník.',
    }
  }

  // Last-owner safety: cannot downgrade or deactivate the last active owner
  if (current.role === 'owner' && current.active) {
    const changing_role = role !== 'owner'
    const deactivating = !active
    if (changing_role || deactivating) {
      const ownerCount = await countActiveOwners()
      if (ownerCount <= 1) {
        return {
          ok: false,
          error: 'Nelze odebrat posledního aktivního vlastníka administrace.',
        }
      }
    }
  }

  // Self-protection: cannot remove your own owner access if you are the last
  if (user_id === caller.id && caller.role === 'owner' && (role !== 'owner' || !active)) {
    const ownerCount = await countActiveOwners()
    if (ownerCount <= 1) {
      return {
        ok: false,
        error: 'Nemůžete si odebrat vlastní přístup vlastníka, jste jediný aktivní vlastník.',
      }
    }
  }

  const { error: updateErr } = await admin
    .from('admin_roles')
    .update({ full_name, role, active })
    .eq('user_id', user_id)

  if (updateErr) return { ok: false, error: updateErr.message }

  // Keep profile in sync
  await admin.from('profiles').upsert({ id: user_id, full_name }, { onConflict: 'id' })

  await auditUserEvent(caller.id, user_id, 'user_updated', {
    old_role: current.role,
    new_role: role,
    old_active: current.active,
    new_active: active,
    old_full_name: current.full_name,
    new_full_name: full_name,
  })

  REVALIDATE()
  return { ok: true }
}

// ─── Deactivate a user ────────────────────────────────────────────────────────

export async function deactivateAdminUser(user_id: string): Promise<ActionResult> {
  return updateAdminUser(await _currentRoleFor(user_id, { active: false }))
}

// ─── Reactivate a user ────────────────────────────────────────────────────────

export async function reactivateAdminUser(user_id: string): Promise<ActionResult> {
  return updateAdminUser(await _currentRoleFor(user_id, { active: true }))
}

/** Internal: fetch current admin_roles row and apply a partial override. */
async function _currentRoleFor(
  user_id: string,
  override: Partial<{ active: boolean; role: AppRole }>,
): Promise<{
  user_id: string
  full_name: string
  role: AppRole
  active: boolean
}> {
  const admin = createServiceRoleClient()
  const { data } = await admin
    .from('admin_roles')
    .select('full_name, role, active')
    .eq('user_id', user_id)
    .single()
  return {
    user_id,
    full_name: data?.full_name ?? '',
    role: (override.role ?? data?.role ?? 'staff') as AppRole,
    active: override.active ?? data?.active ?? false,
  }
}

// ─── Remove admin access ──────────────────────────────────────────────────────

export async function removeAdminUser(
  user_id: string,
  deleteAuthUser: boolean,
): Promise<ActionResult> {
  const caller = await getAdminProfile()
  if (!caller) return { ok: false, error: 'Nepřihlášen.' }
  if (!canManageUsers(caller.role)) {
    return { ok: false, error: 'Nemáte oprávnění spravovat uživatele.' }
  }

  const admin = createServiceRoleClient()

  const { data: current } = await admin
    .from('admin_roles')
    .select('role, active, full_name')
    .eq('user_id', user_id)
    .single()

  if (!current) return { ok: false, error: 'Uživatel nebyl nalezen.' }

  // Only owners may remove owners
  if (current.role === 'owner' && caller.role !== 'owner') {
    return { ok: false, error: 'Pouze vlastník může odebrat jiného vlastníka.' }
  }

  // Last-owner guard
  if (current.role === 'owner' && current.active) {
    const ownerCount = await countActiveOwners()
    if (ownerCount <= 1) {
      return {
        ok: false,
        error: 'Nelze odebrat posledního aktivního vlastníka administrace.',
      }
    }
  }

  // Delete admin_roles row (audit log is preserved by not cascading)
  const { error: deleteRoleErr } = await admin
    .from('admin_roles')
    .delete()
    .eq('user_id', user_id)

  if (deleteRoleErr) return { ok: false, error: deleteRoleErr.message }

  if (deleteAuthUser) {
    await admin.auth.admin.deleteUser(user_id).catch(() => {})
  }

  await auditUserEvent(caller.id, user_id, 'admin_access_removed', {
    deleted_auth_user: deleteAuthUser,
    old_role: current.role,
  })

  REVALIDATE()
  return { ok: true }
}

// ─── Resend invitation ────────────────────────────────────────────────────────

export async function resendInvitation(user_id: string): Promise<ActionResult> {
  const caller = await getAdminProfile()
  if (!caller) return { ok: false, error: 'Nepřihlášen.' }
  if (!canManageUsers(caller.role)) {
    return { ok: false, error: 'Nemáte oprávnění spravovat uživatele.' }
  }

  const admin = createServiceRoleClient()

  // Fetch current email from auth.users
  const { data: { user: authUser }, error: fetchErr } =
    await admin.auth.admin.getUserById(user_id)

  if (fetchErr || !authUser) return { ok: false, error: 'Uživatel nebyl nalezen.' }
  if (!authUser.email) return { ok: false, error: 'Uživatel nemá e-mail.' }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'vercel.app') ??
    ''
  const redirectTo = `${siteUrl}/auth/callback?next=/admin/nastavit-heslo`

  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    authUser.email,
    { redirectTo },
  )

  if (inviteErr) {
    const msg = inviteErr.message
    if (
      msg.toLowerCase().includes('smtp') ||
      msg.toLowerCase().includes('email') ||
      msg.toLowerCase().includes('sending')
    ) {
      return {
        ok: false,
        error: `Chyba konfigurace e-mailu: ${msg}. Ověřte nastavení SMTP v Supabase.`,
      }
    }
    return { ok: false, error: msg }
  }

  await auditUserEvent(caller.id, user_id, 'invitation_resent', {
    email: authUser.email,
  })

  REVALIDATE()
  return { ok: true }
}

// ─── Cancel invitation (deactivate pending user) ─────────────────────────────

export async function cancelInvitation(user_id: string): Promise<ActionResult> {
  const caller = await getAdminProfile()
  if (!caller) return { ok: false, error: 'Nepřihlášen.' }
  if (!canManageUsers(caller.role)) {
    return { ok: false, error: 'Nemáte oprávnění spravovat uživatele.' }
  }

  const admin = createServiceRoleClient()

  // Mark admin_roles inactive
  const { error } = await admin
    .from('admin_roles')
    .update({ active: false })
    .eq('user_id', user_id)

  if (error) return { ok: false, error: error.message }

  // Also revoke the Supabase Auth invite by deleting the user
  await admin.auth.admin.deleteUser(user_id).catch(() => {})

  await auditUserEvent(caller.id, user_id, 'invitation_cancelled', {})

  REVALIDATE()
  return { ok: true }
}
