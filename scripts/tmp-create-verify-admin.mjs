// Throwaway script: create a temporary admin auth user + admin_roles row for
// end-to-end CMS verification. Deleted after use; not part of the app.
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL or service role key')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const email = 'v0-e2e-verify-temp@example.com'
const password = 'TempVerify!2026Xz'

const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: 'V0 E2E Verify Temp' },
})

if (createErr || !created?.user) {
  console.error('createUser failed', createErr)
  process.exit(1)
}

const userId = created.user.id

const { error: profileErr } = await admin.from('profiles').upsert({ id: userId, full_name: 'V0 E2E Verify Temp' }, { onConflict: 'id' })
if (profileErr) console.error('profile upsert error', profileErr)

const { error: roleErr } = await admin.from('admin_roles').insert({
  user_id: userId,
  role: 'admin',
  full_name: 'V0 E2E Verify Temp',
  active: true,
})

if (roleErr) {
  console.error('admin_roles insert failed', roleErr)
  await admin.auth.admin.deleteUser(userId).catch(() => {})
  process.exit(1)
}

console.log(JSON.stringify({ userId, email, password }))
