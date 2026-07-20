'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: user?.id })
  if (error) throw new Error(error.message)
  revalidatePath('/')
  revalidatePath('/admin/obsah')
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
