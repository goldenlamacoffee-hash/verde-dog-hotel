// Throwaway admin account for one-off E2E CMS verification.
// Created and deleted within the same session — see tmp-delete-verify-admin.mjs.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing Supabase env vars')

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const EMAIL = 'v0-e2e-verify-temp@example.com'
const PASSWORD = 'TempVerify!2026Xz'

const { data: createData, error: createErr } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: 'E2E Verify Temp' },
})
if (createErr || !createData?.user) {
  console.error('createUser failed:', createErr?.message)
  process.exit(1)
}

const userId = createData.user.id

const { error: profileErr } = await admin
  .from('profiles')
  .upsert({ id: userId, full_name: 'E2E Verify Temp' }, { onConflict: 'id' })
if (profileErr) console.error('profile upsert warning:', profileErr.message)

const { error: roleErr } = await admin.from('admin_roles').insert({
  user_id: userId,
  role: 'owner',
  full_name: 'E2E Verify Temp',
  active: true,
})
if (roleErr) {
  console.error('admin_roles insert failed:', roleErr.message)
  await admin.auth.admin.deleteUser(userId).catch(() => {})
  process.exit(1)
}

console.log('Created temp admin:', userId, EMAIL)
