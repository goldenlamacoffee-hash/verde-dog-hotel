import { NextRequest, NextResponse } from 'next/server'
import { getAdminProfile, canManageContent } from '@/lib/auth/roles'
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

  const GENERIC_ERROR = 'Obrázek se nepodařilo uložit do knihovny médií. Zkuste to prosím znovu.'

  // Replace an existing asset (same storage_path, same DB row)
  const replaceId = formData.get('replace_id') as string | null
  if (replaceId) {
    const { asset, error } = await replaceMediaAsset(replaceId, file)
    if (error || !asset) {
      console.error('[upload] replace failed', { replaceId, message: error })
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
    }
    return NextResponse.json({ asset }, { status: 200 })
  }

  // `alt_text` is the wire/form field name; it maps to the `alt` column on media_assets.
  const altText = (formData.get('alt_text') as string | null) ?? undefined
  const tagsRaw = (formData.get('tags') as string | null) ?? ''
  const tags    = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const { asset, error } = await uploadMediaAsset(file, { altText, tags })
  if (error || !asset) {
    console.error('[upload] media_assets insert failed', { filename: file.name, message: error })
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }

  return NextResponse.json({ asset }, { status: 201 })
}
