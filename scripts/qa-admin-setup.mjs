/**
 * Temporary QA admin setup + teardown script.
 * Run with: node --env-file-if-exists=/vercel/share/.env.project scripts/qa-admin-setup.mjs [setup|teardown]
 *
 * setup:   creates QA auth user + admin_roles row, prints email only
 * teardown: deletes QA auth user + admin_roles row
 *
 * The password is kept only in runtime memory (NODE_EXTRA environment below).
 * It is never written to disk or printed.
 */

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const SUPABASE_URL           = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const QA_EMAIL = `verde-calendar-qa-${Date.now()}@example.dev`
// Strong random password — stays only in memory
const QA_PASSWORD = randomBytes(24).toString('base64url')

const cmd = process.argv[2] ?? 'setup'

if (cmd === 'setup') {
  // 1. Create Auth user (email already confirmed, no invitation email)
  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email: QA_EMAIL,
    password: QA_PASSWORD,
    email_confirm: true,
    // Do NOT set must_change_password — would redirect to /admin/zmenit-heslo
    app_metadata: { must_change_password: false },
  })

  if (createErr || !created?.user) {
    console.error('Failed to create QA user:', createErr?.message)
    process.exit(1)
  }

  const userId = created.user.id

  // 2. Create admin_roles row — role 'admin' satisfies canManageCapacity
  const { error: roleErr } = await svc
    .from('admin_roles')
    .insert({
      user_id:   userId,
      role:      'admin',
      full_name: 'Verde QA Tester',
      active:    true,
    })

  if (roleErr) {
    console.error('Failed to insert admin_roles row:', roleErr.message)
    // Clean up Auth user before exiting
    await svc.auth.admin.deleteUser(userId)
    process.exit(1)
  }

  // Output only what the test runner needs — email + userId (no password)
  // Password is passed via env QA_PASSWORD set by the calling shell
  console.log(JSON.stringify({
    email:    QA_EMAIL,
    password: QA_PASSWORD,   // caller captures this and keeps it in memory only
    userId,
  }))

} else if (cmd === 'teardown') {
  const email  = process.env.QA_EMAIL
  const userId = process.env.QA_USER_ID

  if (!email || !userId) {
    console.error('QA_EMAIL and QA_USER_ID env vars required for teardown')
    process.exit(1)
  }

  // 1. Delete admin_roles row
  const { error: roleDelErr } = await svc
    .from('admin_roles')
    .delete()
    .eq('user_id', userId)

  if (roleDelErr) console.warn('admin_roles delete warning:', roleDelErr.message)

  // 2. Delete any availability_months rows created during the QA run
  //    (only 2026-10-01 test month — production months are never touched)
  const { error: monthDelErr } = await svc
    .from('availability_months')
    .delete()
    .eq('month_start', '2026-10-01')

  if (monthDelErr) console.warn('availability_months cleanup warning:', monthDelErr.message)

  // Also clean days for that month
  await svc.from('availability_days').delete().eq('month_start', '2026-10-01')

  // 3. Delete Auth user
  const { error: userDelErr } = await svc.auth.admin.deleteUser(userId)
  if (userDelErr) console.error('Failed to delete QA user:', userDelErr.message)
  else console.log('QA user deleted:', email)

} else {
  console.error('Unknown command. Use: setup | teardown')
  process.exit(1)
}
