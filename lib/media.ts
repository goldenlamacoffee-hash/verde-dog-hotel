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
  public_url: string
  mime_type: string | null
  size_bytes: number | null
  alt: string | null
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
  document_type: string | null
  dog_id: string | null
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string | null
  created_at: string
}

export interface MediaUsageInfo {
  usageCount: number
  locations: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEDIA_BUCKET   = 'media'
const DOCS_BUCKET    = 'reservation-docs'
const SIGNED_URL_TTL = 3600 // 1 hour for private docs

// ─── Media bucket helpers ─────────────────────────────────────────────────────

/**
 * Upload a file to the `media` bucket and insert a row into `media_assets`.
 * Returns the new asset row including the public URL.
 */
export async function uploadMediaAsset(
  file: File,
  opts?: { altText?: string; tags?: string[] },
): Promise<{ asset: MediaAsset | null; error: string | null }> {
  const supabase = await createClient()

  const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_').toLowerCase()
  const path = `${Date.now()}-${safe}`

  const arrayBuffer = await file.arrayBuffer()

  const { error: storageErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

  if (storageErr) {
    console.error('[media] storage upload failed', { path, code: storageErr.name, message: storageErr.message })
    return { asset: null, error: storageErr.message }
  }

  const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  // NOTE: media_assets columns are `public_url` and `alt` (not `url` / `alt_text`).
  // There is no `caption` column — do not insert one.
  const { data: row, error: dbErr } = await supabase
    .from('media_assets')
    .insert({
      filename:     file.name,
      storage_path: path,
      public_url:   publicUrl,
      mime_type:    file.type || null,
      size_bytes:   file.size || null,
      alt:          opts?.altText ?? null,
      tags:         opts?.tags ?? [],
    })
    .select()
    .single()

  if (dbErr) {
    // Never leave an orphaned storage object if the DB insert fails.
    await supabase.storage.from(MEDIA_BUCKET).remove([path])
    console.error('[media] media_assets insert failed', { path, code: dbErr.code, message: dbErr.message })
    return { asset: null, error: dbErr.message }
  }

  return { asset: row as MediaAsset, error: null }
}

/**
 * Replace the file for an existing media asset while keeping the same DB row
 * and public URL. Re-uploads to the same storage_path with upsert:true so all
 * existing references automatically point to the new file.
 */
export async function replaceMediaAsset(
  assetId: string,
  file: File,
): Promise<{ asset: MediaAsset | null; error: string | null }> {
  const supabase = await createClient()

  const { data: existing, error: fetchErr } = await supabase
    .from('media_assets')
    .select('*')
    .eq('id', assetId)
    .single()

  if (fetchErr || !existing) return { asset: null, error: fetchErr?.message ?? 'Not found' }

  const arrayBuffer = await file.arrayBuffer()
  const { error: storageErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(existing.storage_path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (storageErr) return { asset: null, error: storageErr.message }

  // Update mime_type, size_bytes and filename; URL stays the same
  const { data: updated, error: dbErr } = await supabase
    .from('media_assets')
    .update({
      filename:   file.name,
      mime_type:  file.type || null,
      size_bytes: file.size || null,
    })
    .eq('id', assetId)
    .select()
    .single()

  if (dbErr) return { asset: null, error: dbErr.message }

  return { asset: updated as MediaAsset, error: null }
}

/**
 * Check how many places in the CMS reference a given asset URL.
 * Scans: gallery_items, page_sections (content JSON), site_settings (value JSON).
 */
export async function checkMediaAssetUsage(
  assetUrl: string,
): Promise<MediaUsageInfo> {
  const supabase = await createClient()
  const locations: string[] = []

  // gallery_items.image_url
  const { count: galCount } = await supabase
    .from('gallery_items')
    .select('id', { count: 'exact', head: true })
    .eq('image_url', assetUrl)
  if ((galCount ?? 0) > 0) locations.push(`Galerie (${galCount} položek)`)

  // page_sections.content — stored as JSONB; use ilike on cast text
  const { data: sectionRows } = await supabase
    .from('page_sections')
    .select('page, section_key')
    .textSearch('content::text', `'${assetUrl}'`, { config: 'simple' })
    .limit(20)
  // fall back to ilike because textSearch may not be set up on content
  const { data: sectionRowsIlike } = await supabase
    .from('page_sections')
    .select('page, section_key')
    .filter('content::text', 'ilike', `%${assetUrl}%`)
    .limit(20)

  const merged = sectionRowsIlike ?? sectionRows ?? []
  if (merged.length > 0) {
    const keys = merged.map((r: { page: string; section_key: string }) => `${r.page}/${r.section_key}`).join(', ')
    locations.push(`Stránkové sekce: ${keys}`)
  }

  // site_settings.value — stored as JSONB
  const { data: settingRows } = await supabase
    .from('site_settings')
    .select('key')
    .filter('value::text', 'ilike', `%${assetUrl}%`)
    .limit(20)
  if ((settingRows ?? []).length > 0) {
    const keys = (settingRows ?? []).map((r: { key: string }) => r.key).join(', ')
    locations.push(`Nastavení webu: ${keys}`)
  }

  const usageCount = locations.length
  return { usageCount, locations }
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
 * Update alt text and tags for a media asset without re-uploading.
 */
export async function updateMediaAssetMeta(
  assetId: string,
  meta: { altText?: string; tags?: string[] },
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('media_assets')
    .update({
      ...(meta.altText !== undefined && { alt:  meta.altText }),
      ...(meta.tags    !== undefined && { tags: meta.tags    }),
    })
    .eq('id', assetId)

  if (error) {
    console.error('[media] media_assets update failed', { assetId, code: error.code, message: error.message })
  }

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
  dogId?: string,
  documentType?: string,
): Promise<{ doc: ReservationDocument | null; error: string | null }> {
  const supabase = await createClient()

  const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_').toLowerCase()
  const path = `${reservationId}/${Date.now()}-${safe}`

  const arrayBuffer = await file.arrayBuffer()

  const { error: storageErr } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

  if (storageErr) return { doc: null, error: storageErr.message }

  const { data: row, error: dbErr } = await supabase
    .from('reservation_documents')
    .insert({
      reservation_id: reservationId,
      storage_path:   path,
      filename:       file.name,
      label:          label          ?? null,
      document_type:  documentType   ?? null,
      dog_id:         dogId          ?? null,
      mime_type:      file.type      || null,
      size_bytes:     file.size      || null,
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
