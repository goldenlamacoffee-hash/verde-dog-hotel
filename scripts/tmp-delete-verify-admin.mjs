// Cleanup for the throwaway admin account created by tmp-create-verify-admin.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing Supabase env vars')

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const EMAIL = 'v0-e2e-verify-temp@example.com'

const { data: usersData, error: listErr } = await admin.auth.admin.listUsers()
if (listErr) {
  console.error('listUsers failed:', listErr.message)
  process.exit(1)
}

const user = usersData.users.find(u => u.email === EMAIL)
if (!user) {
  console.log('No temp admin user found — already clean.')
  process.exit(0)
}

await admin.from('admin_roles').delete().eq('user_id', user.id)
await admin.from('profiles').delete().eq('id', user.id)
const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
if (delErr) {
  console.error('deleteUser failed:', delErr.message)
  process.exit(1)
}

console.log('Deleted temp admin:', user.id, EMAIL)
