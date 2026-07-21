/**
 * lib/media.ts
 * Server-side helpers for Supabase Storage — two buckets:
 *   - "media"             (public, images)       → MediaAsset row in media_assets
 *   - "reservation-docs" (private, docs/images)  → ReservationDocument row in reservation_documents
 *
 * All functions use the server Supabase client (cookie-based auth) and are
 * safe to call from Route Handlers and Server Actions.
 */

import { createClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MediaAsset {
  id: string
  filename: string
  storage_path: string
  url: string
  mime_type: string | null
  size_bytes: number | null
  alt_text: string | null
  caption: string | null
  tags: string[] | null
  created_at: string
  uploaded_by: string | null
}

export interface ReservationDocument {
  id: string
  reservation_id: string
  storage_path: string
  filename: string
  label: string | null
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string | null
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEDIA_BUCKET = 'media'
const DOCS_BUCKET  = 'reservation-docs'
const SIGNED_URL_TTL = 3600 // 1 hour for private docs

// ─── Media bucket helpers ─────────────────────────────────────────────────────

/**
 * Upload a file to the `media` bucket and insert a row into `media_assets`.
 * Returns the new asset row including the public URL.
 */
export async function uploadMediaAsset(
  file: File,
  opts?: { altText?: string; caption?: string; tags?: string[] },
): Promise<{ asset: MediaAsset | null; error: string | null }> {
  const supabase = await createClient()

  // Derive a unique storage path: {timestamp}-{sanitised-filename}
  const ext  = file.name.split('.').pop() ?? 'bin'
  const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_').toLowerCase()
  const path = `${Date.now()}-${safe}`

  const arrayBuffer = await file.arrayBuffer()

  const { error: storageErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (storageErr) return { asset: null, error: storageErr.message }

  const { data: urlData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path)

  const publicUrl = urlData.publicUrl

  const { data: row, error: dbErr } = await supabase
    .from('media_assets')
    .insert({
      filename:     file.name,
      storage_path: path,
      url:          publicUrl,
      mime_type:    file.type || null,
      size_bytes:   file.size || null,
      alt_text:     opts?.altText ?? null,
      caption:      opts?.caption ?? null,
      tags:         opts?.tags ?? [],
    })
    .select()
    .single()

  if (dbErr) {
    // Attempt to clean up the orphaned storage object
    await supabase.storage.from(MEDIA_BUCKET).remove([path])
    return { asset: null, error: dbErr.message }
  }

  return { asset: row as MediaAsset, error: null }
}

/**
 * Delete a media asset from storage and remove its DB row.
 */
export async function deleteMediaAsset(
  assetId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: asset, error: fetchErr } = await supabase
    .from('media_assets')
    .select('storage_path')
    .eq('id', assetId)
    .single()

  if (fetchErr || !asset) return { error: fetchErr?.message ?? 'Not found' }

  await supabase.storage.from(MEDIA_BUCKET).remove([asset.storage_path])

  const { error: dbErr } = await supabase
    .from('media_assets')
    .delete()
    .eq('id', assetId)

  return { error: dbErr?.message ?? null }
}

/**
 * Update alt_text and tags for a media asset without re-uploading.
 */
export async function updateMediaAssetMeta(
  assetId: string,
  meta: { altText?: string; caption?: string; tags?: string[] },
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('media_assets')
    .update({
      ...(meta.altText  !== undefined && { alt_text: meta.altText }),
      ...(meta.caption  !== undefined && { caption:  meta.caption }),
      ...(meta.tags     !== undefined && { tags:     meta.tags    }),
    })
    .eq('id', assetId)

  return { error: error?.message ?? null }
}

// ─── Reservation-docs bucket helpers ─────────────────────────────────────────

/**
 * Upload a file to the private `reservation-docs` bucket and insert a row
 * into `reservation_documents`.
 */
export async function uploadReservationDocument(
  reservationId: string,
  file: File,
  label?: string,
): Promise<{ doc: ReservationDocument | null; error: string | null }> {
  const supabase = await createClient()

  const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_').toLowerCase()
  const path = `${reservationId}/${Date.now()}-${safe}`

  const arrayBuffer = await file.arrayBuffer()

  const { error: storageErr } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (storageErr) return { doc: null, error: storageErr.message }

  const { data: row, error: dbErr } = await supabase
    .from('reservation_documents')
    .insert({
      reservation_id: reservationId,
      storage_path:   path,
      filename:       file.name,
      label:          label ?? null,
      mime_type:      file.type || null,
      size_bytes:     file.size || null,
    })
    .select()
    .single()

  if (dbErr) {
    await supabase.storage.from(DOCS_BUCKET).remove([path])
    return { doc: null, error: dbErr.message }
  }

  return { doc: row as ReservationDocument, error: null }
}

/**
 * Create a short-lived signed URL for a private reservation document.
 */
export async function getDocumentSignedUrl(
  storagePath: string,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL)

  return { url: data?.signedUrl ?? null, error: error?.message ?? null }
}

/**
 * Delete a reservation document from storage and its DB row.
 */
export async function deleteReservationDocument(
  docId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: doc, error: fetchErr } = await supabase
    .from('reservation_documents')
    .select('storage_path')
    .eq('id', docId)
    .single()

  if (fetchErr || !doc) return { error: fetchErr?.message ?? 'Not found' }

  await supabase.storage.from(DOCS_BUCKET).remove([doc.storage_path])

  const { error: dbErr } = await supabase
    .from('reservation_documents')
    .delete()
    .eq('id', docId)

  return { error: dbErr?.message ?? null }
}

/**
 * Update the label of a reservation document.
 */
export async function updateDocumentLabel(
  docId: string,
  label: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('reservation_documents')
    .update({ label })
    .eq('id', docId)
  return { error: error?.message ?? null }
}
