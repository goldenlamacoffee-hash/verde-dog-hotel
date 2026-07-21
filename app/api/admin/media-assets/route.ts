import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp     = req.nextUrl.searchParams
  const limit  = Math.min(parseInt(sp.get('limit') ?? '48', 10), 200)
  const offset = parseInt(sp.get('offset') ?? '0', 10)
  const search = sp.get('search') ?? undefined
  const tag    = sp.get('tag') ?? undefined

  let q = supabase
    .from('media_assets')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit)
    .range(offset, offset + limit - 1)

  if (search) q = q.ilike('filename', `%${search}%`)
  if (tag)    q = q.contains('tags', [tag])

  const { data, count, error } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ assets: data ?? [], total: count ?? 0 })
}
