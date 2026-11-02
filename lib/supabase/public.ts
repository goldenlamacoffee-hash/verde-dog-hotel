import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Anonymous, cookie-less Supabase client for public site reads.
 *
 * The cookie-aware server client calls `cookies()`, which forces every page that
 * touches it to render dynamically on each request. Public content (CMS sections,
 * FAQ, prices, gallery, contact info) is identical for every visitor, so reading
 * it without cookies lets Next.js prerender and cache these pages (ISR) and
 * serve them instantly. Admin edits call `revalidatePath`, so changes still
 * show up right after saving.
 */
export async function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
