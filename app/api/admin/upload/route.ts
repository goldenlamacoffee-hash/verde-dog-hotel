import { NextRequest, NextResponse } from 'next/server'
import { getAdminProfile, canManageContent } from '@/lib/auth'
import { uploadMediaAsset, replaceMediaAsset } from '@/lib/media'

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'image/gif', 'image/avif', 'image/svg+xml',
])
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  const profile = await getAdminProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageContent(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
  }

  // Replace an existing asset (same storage_path, same DB row)
  const replaceId = formData.get('replace_id') as string | null
  if (replaceId) {
    const { asset, error } = await replaceMediaAsset(replaceId, file)
    if (error || !asset) return NextResponse.json({ error: error ?? 'Replace failed' }, { status: 500 })
    return NextResponse.json({ asset }, { status: 200 })
  }

  const altText = (formData.get('alt_text') as string | null) ?? undefined
  const caption = (formData.get('caption')  as string | null) ?? undefined
  const tagsRaw = (formData.get('tags')     as string | null) ?? ''
  const tags    = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const { asset, error } = await uploadMediaAsset(file, { altText, caption, tags })
  if (error || !asset) return NextResponse.json({ error: error ?? 'Upload failed' }, { status: 500 })

  return NextResponse.json({ asset }, { status: 201 })
}
