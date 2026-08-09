'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isValidGoogleMapsUrl } from '@/lib/validate-url'

// ─── Reservations ─────────────────────────────────────────────────────────────

export async function updateReservationStatus(id: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('reservations')
    .update({ status, ...(status === 'cancelled' ? { cancelled_at: new Date().toISOString() } : {}) })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/rezervace')
  revalidatePath(`/admin/rezervace/${id}`)
}

export async function updateReservationNotes(id: string, internalNotes: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('reservations')
    .update({ internal_notes: internalNotes })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/rezervace/${id}`)
}

// ─── Customers ────────────────────────────────────────────────────────────────

export async function upsertCustomer(data: {
  id?: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  notes?: string
  is_vip?: boolean
}) {
  const supabase = await createClient()
  const { error, data: result } = data.id
    ? await supabase.from('customers').update(data).eq('id', data.id).select().single()
    : await supabase.from('customers').insert(data).select().single()
  if (error) throw new Error(error.message)
  revalidatePath('/admin/zakaznici')
  return result
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/zakaznici')
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function upsertService(data: {
  id?: string
  title: string
  description?: string
  price: number
  unit: string
  standard: boolean
  active: boolean
  show_on_web: boolean
  sort_order: number
  category_id?: number
}) {
  const supabase = await createClient()
  const { error } = data.id
    ? await supabase.from('services').update(data).eq('id', data.id)
    : await supabase.from('services').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/sluzby')
  revalidatePath('/cenik')
}

// ─── CMS ──────────────────────────────────────────────────────────────────────

export async function updateSiteSetting(key: string, value: object) {
  // Server-side validation for admin-supplied Google Maps link on the
  // Contact page location block. Never trust the client to have validated this.
  if (key === 'contact') {
    const mapsUrl = (value as Record<string, unknown>).googleMapsUrl
    if (typeof mapsUrl === 'string' && mapsUrl.trim() !== '' && !isValidGoogleMapsUrl(mapsUrl)) {
      throw new Error('Zadejte platný odkaz na Google Maps.')
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
  .from('site_settings')
  .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: user?.id })
  if (error) throw new Error(error.message)

  // Always revalidate the admin page and global layout (covers footer on all pages)
  revalidatePath('/admin/obsah')
  revalidatePath('/', 'layout')

  // Revalidate specific public pages that render this setting
  if (key === 'contact') {
    revalidatePath('/kontakt')
  }
  if (key === 'availabilityCalendarAppearance' || key === 'maximumStayNights') {
    revalidatePath('/rezervace')
  }
}

export async function upsertFaqItem(data: {
  id?: string
  question: string
  answer: string
  category: string
  sort_order: number
  active: boolean
}) {
  const supabase = await createClient()
  const { error } = data.id
    ? await supabase.from('faq_items').update(data).eq('id', data.id)
    : await supabase.from('faq_items').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/faq')
  revalidatePath('/faq')
}

export async function deleteFaqItem(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('faq_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/faq')
  revalidatePath('/faq')
}

export async function upsertTestimonial(data: {
  id?: string
  author: string
  dog_name?: string
  text: string
  rating: number
  featured: boolean
  active: boolean
  sort_order: number
}) {
  const supabase = await createClient()
  const { error } = data.id
    ? await supabase.from('testimonials').update(data).eq('id', data.id)
    : await supabase.from('testimonials').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/recenze')
  revalidatePath('/')
}

export async function deleteTestimonial(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('testimonials').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/recenze')
}

export async function upsertGalleryItem(data: {
  id?: string
  title?: string
  alt?: string
  src: string
  category: string
  featured: boolean
  active: boolean
  sort_order: number
}) {
  const supabase = await createClient()
  const { error } = data.id
    ? await supabase.from('gallery_items').update(data).eq('id', data.id)
    : await supabase.from('gallery_items').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/galerie')
  revalidatePath('/galerie')
}

export async function deleteGalleryItem(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('gallery_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/galerie')
}

/**
 * Batch-update sort_order for a list of gallery items after drag-reorder.
 * @param items Array of { id, sort_order } — only the ordering columns.
 */
export async function reorderGalleryItems(items: { id: string; sort_order: number }[]) {
  const supabase = await createClient()
  const updates = items.map(({ id, sort_order }) =>
    supabase.from('gallery_items').update({ sort_order }).eq('id', id),
  )
  const results = await Promise.all(updates)
  const failed = results.find(r => r.error)
  if (failed?.error) throw new Error(failed.error.message)
  revalidatePath('/admin/galerie')
  revalidatePath('/galerie')
}

// ─── Reservation documents ────────────────────────────────────────────────────

export async function updateReservationDocumentLabel(docId: string, label: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('reservation_documents')
    .update({ label })
    .eq('id', docId)
  if (error) throw new Error(error.message)
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function addPayment(data: {
  reservation_id: string
  amount: number
  payment_type: 'deposit' | 'final' | 'refund' | 'extra'
  method?: 'cash' | 'card' | 'bank_transfer' | 'online'
  paid_at?: string
  note?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('payments').insert({
    ...data,
    paid_at: data.paid_at ?? new Date().toISOString(),
    recorded_by: user?.id ?? null,
  })
  if (error) throw new Error(error.message)

  // Update deposit_paid / paid_in_full flags on the reservation
  const { data: allPayments } = await supabase
    .from('payments')
    .select('payment_type, amount')
    .eq('reservation_id', data.reservation_id)
    .not('payment_type', 'eq', 'refund')

  const { data: res } = await supabase
    .from('reservations')
    .select('total_price, deposit_amount')
    .eq('id', data.reservation_id)
    .single()

  if (allPayments && res) {
    const totalPaid = allPayments.reduce((s: number, p: any) => s + Number(p.amount), 0)
    const refunds = 0 // already excluded above
    const depositPaid = allPayments.some((p: any) => p.payment_type === 'deposit')
    const paidInFull = totalPaid - refunds >= Number(res.total_price)

    await supabase
      .from('reservations')
      .update({ deposit_paid: depositPaid, paid_in_full: paidInFull })
      .eq('id', data.reservation_id)
  }

  revalidatePath(`/admin/rezervace/${data.reservation_id}`)
}

export async function deletePayment(id: string, reservationId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/rezervace/${reservationId}`)
}

// ─── Capacity overrides ───────────────────────────────────────────────────────

export async function upsertCapacityOverride(data: {
  id?: string
  date_from: string
  date_to: string
  max_dogs?: number | null
  reason?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = data.id
    ? await supabase.from('capacity_overrides').update({ ...data, id: undefined }).eq('id', data.id)
    : await supabase.from('capacity_overrides').insert({ ...data, created_by: user?.id })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/kapacita')
}

export async function deleteCapacityOverride(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('capacity_overrides').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/kapacita')
}

// ─── Page sections ────────────────────────────────────────────────────────────

export async function upsertPageSection(data: {
  page: string
  section_key: string
  content: Record<string, unknown>
  active?: boolean
  sort_order?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('page_sections')
    .upsert(
      { ...data, updated_by: user?.id, updated_at: new Date().toISOString() },
      { onConflict: 'page,section_key' }
    )

  if (error) throw new Error(error.message)
  revalidatePath('/admin/obsah')
  revalidatePath('/')
}

// ─── Pricing rules ────────────────────────────────────────────────────────────

export async function upsertPricingRule(data: {
  id?: string
  name: string
  rule_type: 'seasonal' | 'length_of_stay' | 'multi_dog' | 'promo'
  date_from?: string | null
  date_to?: string | null
  min_nights?: number | null
  max_nights?: number | null
  dog_count_min?: number | null
  modifier_type: 'percent' | 'fixed'
  modifier_value: number
  active: boolean
  sort_order: number
}) {
  const supabase = await createClient()
  const { error } = data.id
    ? await supabase.from('pricing_rules').update({ ...data, id: undefined }).eq('id', data.id)
    : await supabase.from('pricing_rules').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/sluzby')
  revalidatePath('/cenik')
}

export async function deletePricingRule(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('pricing_rules').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/sluzby')
}

// ─── Media assets ─────────────────────────────────────────────────────────────

/** Mime-type hint derived from file extension */
function mimeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif',  webp: 'image/webp', svg: 'image/svg+xml',
    mp4: 'video/mp4',  webm: 'video/webm', pdf: 'application/pdf',
  }
  return map[ext] ?? 'application/octet-stream'
}

/** Sanitise filename — strip path traversal, allow only safe chars */
function sanitiseFilename(raw: string): string {
  return raw
    .replace(/[/\\?%*:|"<>]/g, '-') // replace dangerous chars
    .replace(/\.{2,}/g, '.')         // collapse consecutive dots
    .replace(/^[.\s]+|[.\s]+$/g, '') // trim leading/trailing dots and spaces
    .slice(0, 255)
}

export async function upsertMediaAsset(data: {
  id?: string
  filename: string
  storage_path: string
  public_url?: string
  mime_type?: string
  size_bytes?: number
  alt?: string
  tags?: string[]
}) {
  // Validate public_url when provided
  if (data.public_url) {
    try {
      const u = new URL(data.public_url)
      if (u.protocol !== 'https:') throw new Error('Only HTTPS URLs are allowed.')
    } catch {
      throw new Error('public_url must be a valid HTTPS URL.')
    }
  }

  const filename = sanitiseFilename(data.filename)
  if (!filename) throw new Error('Název souboru je neplatný.')

  const mime_type = data.mime_type?.trim() || mimeFromExtension(filename)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const payload = {
    ...data,
    filename,
    mime_type,
    uploaded_by: user?.id,
  }

  const { error } = data.id
    ? await supabase.from('media_assets').update({ ...payload, id: undefined }).eq('id', data.id)
    : await supabase.from('media_assets').insert(payload)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/media')
}

export async function deleteMediaAsset(id: string) {
  const { deleteMediaAsset: deleteLib } = await import('@/lib/media')
  const { error } = await deleteLib(id)
  if (error) throw new Error(error)
  revalidatePath('/admin/media')
}

export async function checkMediaAssetUsage(
  assetUrl: string,
): Promise<{ usageCount: number; locations: string[] }> {
  const { checkMediaAssetUsage: checkLib } = await import('@/lib/media')
  return checkLib(assetUrl)
}
