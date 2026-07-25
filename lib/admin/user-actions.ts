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

/**
 * Write an audit_log entry for user-management events.
 *
 * The `action` column in audit_log is constrained to INSERT/UPDATE/DELETE.
 * We map all user-management events to `action: 'UPDATE'` on the admin_roles
 * table and store the semantic event name inside `new_data.event`.
 * This keeps the event history queryable while respecting the DB constraint.
 */
async function auditUserEvent(
  actorId: string,
  targetUserId: string,
  event: string,
  meta: Record<string, unknown> = {},
) {
  const admin = createServiceRoleClient()
  // Use INSERT for creation events, UPDATE for everything else
  const action = (event === 'user_invited' || event === 'user_created_immediately')
    ? 'INSERT'
    : 'UPDATE'
  await admin.from('audit_log').insert({
    table_name: 'admin_roles',
    record_id:  targetUserId,
    action,
    new_data: { event, actor_id: actorId, target_user_id: targetUserId, ...meta },
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

/**
 * Map a Supabase Auth error from inviteUserByEmail to a safe, user-facing
 * Czech message.  We key on `error.code` first (stable), then fall back to
 * a conservative message-substring check only for codes we don't recognise.
 *
 * Supabase Auth error codes reference:
 * https://supabase.com/docs/reference/javascript/auth-error-codes
 */
function mapInviteError(err: { code?: string; status?: number; message?: string } | null): string {
  const code    = err?.code    ?? ''
  const status  = err?.status  ?? 0
  const message = (err?.message ?? '').toLowerCase()

  // Provider rejected the address as non-deliverable / invalid
  if (
    code === 'email_address_invalid' ||
    message.includes('is invalid') ||
    message.includes('invalid email')
  ) {
    return 'Zadanou e-mailovou adresu poskytovatel odmítl. Zkontrolujte adresu nebo použijte jinou.'
  }

  // Address not on the Supabase-allowed-senders list (default SMTP restriction)
  if (
    code === 'email_address_not_authorized' ||
    message.includes('not authorized') ||
    message.includes('not allowed')
  ) {
    return 'Supabase nemůže na tuto adresu odeslat pozvánku bez vlastního SMTP. Nastavte vlastní SMTP v Supabase nebo použijte jinou adresu.'
  }

  // Rate limiting
  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    status === 429 ||
    message.includes('rate limit') ||
    message.includes('too many')
  ) {
    return 'Byl překročen limit odesílání e-mailů. Zkuste to za chvíli znovu.'
  }

  // Duplicate user — should have been caught earlier, but defend in depth
  if (
    code === 'user_already_exists' ||
    message.includes('already registered') ||
    message.includes('already exists')
  ) {
    return 'Uživatel s touto e-mailovou adresou již existuje.'
  }

  // SMTP delivery / server configuration issues
  if (
    code === 'smtp_error' ||
    message.includes('smtp') ||
    message.includes('sending') ||
    message.includes('could not send') ||
    message.includes('failed to send')
  ) {
    return 'Pozvánku se nepodařilo odeslat kvůli nastavení e-mailového serveru. Ověřte SMTP konfiguraci v Supabase.'
  }

  // Fallback: return the raw message so admins can see what Supabase reported
  return err?.message ?? 'Pozvánku se nepodařilo odeslat.'
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
      // Log safe diagnostic fields only — never log tokens or secrets
      console.error('[verde] inviteUserByEmail error', {
        code:    inviteErr?.code,
        status:  inviteErr?.status,
        message: inviteErr?.message,
      })
      return { ok: false, error: mapInviteError(inviteErr) }
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
    console.error('[verde] resendInvitation error', {
      code:    inviteErr.code,
      status:  inviteErr.status,
      message: inviteErr.message,
    })
    return { ok: false, error: mapInviteError(inviteErr) }
  }

  await auditUserEvent(caller.id, user_id, 'invitation_resent', {
    email: authUser.email,
  })

  REVALIDATE()
  return { ok: true }
}

// ─── Create account immediately (no email) ───────────────────────────────────

export interface CreateImmediateResult {
  ok: boolean
  error?: string
  /** Only populated on success — never persisted or logged */
  createdUserId?: string
}

export async function createAdminUserImmediately(payload: {
  first_name: string
  last_name: string
  email: string
  role: string
  temporary_password: string
}): Promise<CreateImmediateResult> {
  // 1. Verify caller
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
  if (role === 'owner' && caller.role !== 'owner') {
    return { ok: false, error: 'Roli vlastníka může přiřadit pouze jiný vlastník.' }
  }

  const pw = payload.temporary_password
  if (!pw || pw.length < 12) {
    return { ok: false, error: 'Dočasné heslo musí mít alespoň 12 znaků.' }
  }
  const pwChecks = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/]
  if (!pwChecks.every((re) => re.test(pw))) {
    return {
      ok: false,
      error: 'Heslo musí obsahovat velké písmeno, malé písmeno, číslo a speciální znak.',
    }
  }

  const full_name = `${payload.first_name.trim()} ${payload.last_name.trim()}`.trim()
  const admin = createServiceRoleClient()

  // 3. Check for duplicate email
  const { data: { users: existing } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existingUser = existing?.find((u) => u.email?.toLowerCase() === email)

  if (existingUser) {
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
    // Existing Auth user without admin role — not supported in immediate creation
    // (they already have a password; use invite flow to grant access)
    return {
      ok: false,
      error:
        'E-mail je již registrován v systému. Pro přidání administrátorského přístupu k existujícímu účtu použijte pozvánku.',
    }
  }

  // 4. Create Auth user immediately — no email sent, email_confirm: true
  const { data: createData, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: pw,
    email_confirm: true,
    app_metadata: { must_change_password: true },
    user_metadata: {
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      full_name,
    },
  })

  if (createErr || !createData?.user) {
    console.error('[verde] createUser error', {
      code:    createErr?.code,
      status:  createErr?.status,
      message: createErr?.message,
    })
    return { ok: false, error: createErr?.message ?? 'Vytvoření účtu se nezdařilo.' }
  }

  const authUserId = createData.user.id

  // 5. Upsert profile
  const { error: profileErr } = await admin
    .from('profiles')
    .upsert({ id: authUserId, full_name }, { onConflict: 'id' })

  if (profileErr) {
    console.error('[verde] profile upsert failed after createUser:', profileErr.message)
    // Cleanup Auth user to avoid orphan
    await admin.auth.admin.deleteUser(authUserId).catch(() => {})
    return { ok: false, error: 'Profil se nepodařilo vytvořit. Účet byl odstraněn.' }
  }

  // 6. Insert admin_roles
  const { error: roleErr } = await admin.from('admin_roles').insert({
    user_id: authUserId,
    role,
    full_name,
    active: true,
  })

  if (roleErr) {
    await admin.auth.admin.deleteUser(authUserId).catch(() => {})
    await admin.from('profiles').delete().eq('id', authUserId)
    return { ok: false, error: `Přiřazení role selhalo: ${roleErr.message}` }
  }

  // 7. Audit — do NOT log the password
  await auditUserEvent(caller.id, authUserId, 'user_created_immediately', {
    email,
    role,
    full_name,
  })

  REVALIDATE()
  return { ok: true, createdUserId: authUserId }
}

// ─── Initialize password (first-login, atomic) ───────────────────────────────
//
// This is the ONLY path that clears the must_change_password flag.
// clearMustChangePassword() does NOT exist as a standalone export —
// the flag can only be cleared as a side-effect of a successful password update.
//
// Flow (all server-side, service-role key never leaves the server):
//  1. Obtain the authenticated user from the cookie-based session
//  2. Verify the user has an active admin_roles row
//  3. Verify app_metadata.must_change_password === true (guard: cannot be called freely)
//  4. Validate password strength server-side
//  5. Update the Auth password via auth.admin.updateUserById
//  6. Only on success: clear app_metadata.must_change_password
//  7. Only on success: write password_initialized audit event
//  8. Return { ok: true } — the password itself is never returned, logged, or stored
//
// If the password update fails, the flag is NOT cleared and NO audit event is written.

export async function initializeAdminPassword(newPassword: string): Promise<ActionResult> {
  // 1. Obtain authenticated user server-side — cannot be spoofed from the browser
  const supabase = await createClient()
  const { data: { user }, error: sessionErr } = await supabase.auth.getUser()

  if (sessionErr || !user) {
    return { ok: false, error: 'Relace vypršela. Přihlaste se znovu.' }
  }

  // 2. Verify active admin_roles row
  const admin = createServiceRoleClient()
  const { data: roleRow } = await admin
    .from('admin_roles')
    .select('active')
    .eq('user_id', user.id)
    .single()

  if (!roleRow?.active) {
    return { ok: false, error: 'Účet není aktivní.' }
  }

  // 3. Verify the flag is actually set — this action cannot be used as a free
  //    password-change endpoint; it is only valid for first-login initialization
  const mustChange =
    (user.app_metadata as Record<string, unknown>)?.must_change_password === true
  if (!mustChange) {
    return {
      ok: false,
      error: 'Tato akce je určena pouze pro první přihlášení. Použijte standardní změnu hesla.',
    }
  }

  // 4. Validate password strength server-side — never trust only client validation
  const pw = newPassword
  if (!pw || pw.length < 12) {
    return { ok: false, error: 'Heslo musí mít alespoň 12 znaků.' }
  }
  if (!/[A-Z]/.test(pw)) return { ok: false, error: 'Heslo musí obsahovat velké písmeno.' }
  if (!/[a-z]/.test(pw)) return { ok: false, error: 'Heslo musí obsahovat malé písmeno.' }
  if (!/[0-9]/.test(pw)) return { ok: false, error: 'Heslo musí obsahovat číslo.' }
  if (!/[^A-Za-z0-9]/.test(pw)) {
    return { ok: false, error: 'Heslo musí obsahovat speciální znak.' }
  }

  // 5. Update the password via Admin API — service-role only, never exposed to browser.
  //    We use updateUserById so the operation is server-to-server, not reliant on the
  //    client token having elevated permissions.
  const { error: pwErr } = await admin.auth.admin.updateUserById(user.id, {
    password: pw,
    // Do NOT pass app_metadata here — update it only after this succeeds (step 6)
  })

  if (pwErr) {
    console.error('[verde] initializeAdminPassword: password update failed', {
      code: pwErr.code,
      status: pwErr.status,
      message: pwErr.message,
      // password is intentionally omitted
    })
    return { ok: false, error: `Nastavení hesla se nezdařilo: ${pwErr.message}` }
  }

  // 6. Password update succeeded — NOW clear the flag.
  //    If this fails (extremely unlikely), the user will be redirected back here
  //    on next request, but their password has already been updated so they can
  //    simply submit again and this action will reject at step 3 on the next call
  //    once the flag is eventually cleared by a retry.
  const { error: metaErr } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { must_change_password: false },
  })

  if (metaErr) {
    // Non-fatal: flag may linger until a retry clears it, but the password has been set.
    // Log the diagnostic but do not fail the user-visible flow.
    console.error('[verde] initializeAdminPassword: flag clear failed (non-fatal)', {
      code: metaErr.code,
      message: metaErr.message,
    })
  }

  // 7. Audit event — password value is intentionally absent from meta
  await auditUserEvent(user.id, user.id, 'password_initialized', {
    flag_cleared: !metaErr,
  })

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
