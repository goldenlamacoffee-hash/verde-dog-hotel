// Throwaway script: delete the temporary admin auth user + admin_roles row
// created for end-to-end CMS verification. Deleted after use; not part of the app.
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL or service role key')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const userId = '749135eb-8d17-47a3-85c3-4436116bac3f'

const { error: roleErr } = await admin.from('admin_roles').delete().eq('user_id', userId)
if (roleErr) console.error('admin_roles delete error', roleErr)

const { error: profileErr } = await admin.from('profiles').delete().eq('id', userId)
if (profileErr) console.error('profiles delete error', profileErr)

const { error: userErr } = await admin.auth.admin.deleteUser(userId)
if (userErr) {
  console.error('deleteUser failed', userErr)
  process.exit(1)
}

console.log('deleted', userId)
