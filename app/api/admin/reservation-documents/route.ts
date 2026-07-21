import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  uploadReservationDocument,
  deleteReservationDocument,
  getDocumentSignedUrl,
} from '@/lib/media'

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
])
const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

async function requireAuth() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// POST — upload a document for a reservation
export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file          = formData.get('file')
  const reservationId = formData.get('reservation_id') as string | null
  const label         = (formData.get('label') as string | null) ?? undefined

  if (!(file instanceof File))  return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!reservationId)            return NextResponse.json({ error: 'No reservation_id' }, { status: 400 })

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 413 })
  }

  const { doc, error } = await uploadReservationDocument(reservationId, file, label)
  if (error || !doc) return NextResponse.json({ error: error ?? 'Upload failed' }, { status: 500 })

  return NextResponse.json({ doc }, { status: 201 })
}

// DELETE — remove a document by id (query param)
export async function DELETE(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 })

  const { error } = await deleteReservationDocument(id)
  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// GET — return a signed URL for a document by id
export async function GET(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 })

  const supabase = await createClient()
  const { data: doc, error: fetchErr } = await supabase
    .from('reservation_documents')
    .select('storage_path, filename')
    .eq('id', id)
    .single()

  if (fetchErr || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { url, error } = await getDocumentSignedUrl(doc.storage_path)
  if (error || !url) return NextResponse.json({ error: error ?? 'Signed URL failed' }, { status: 500 })

  return NextResponse.json({ url, filename: doc.filename })
}
