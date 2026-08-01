'use server'

/**
 * lib/admin/service-actions.ts
 *
 * Server Actions for the services catalogue admin.
 * All mutations require at minimum the 'admin' or 'owner' role
 * (checked via getAdminProfile / canManageServices).
 *
 * RULES:
 *  - Hard delete: only if the service has NO reservation_services history.
 *  - Safe delete: if it has history, archive instead (sets archived_at = now()).
 *  - Restore: clears archived_at.
 *  - Categories: full CRUD; a category with active services cannot be deleted.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAdminProfile } from '@/lib/auth/roles'
import type { UpsertServicePayload, UpsertServiceCategoryPayload } from '@/lib/types'

// ─── Shared result type ───────────────────────────────────────────────────────

export interface ServiceActionResult<T = undefined> {
  ok: boolean
  error?: string
  data?: T
}

// ─── Permission guard ─────────────────────────────────────────────────────────

async function requireServiceAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const caller = await getAdminProfile()
  if (!caller) return { ok: false, error: 'Nepřihlášen.' }
  // Only owner / admin may mutate the catalogue
  if (caller.role !== 'owner' && caller.role !== 'admin') {
    return { ok: false, error: 'Nemáte oprávnění upravovat katalog služeb.' }
  }
  return { ok: true, userId: caller.id }
}

// ─── Revalidate all affected paths ───────────────────────────────────────────

function revalidateCatalogue() {
  revalidatePath('/admin/sluzby')
  revalidatePath('/cenik')
  revalidatePath('/pece-a-ubytovani')
  revalidatePath('/rezervace')
}

// ─── Services ─────────────────────────────────────────────────────────────────

/**
 * Create or update a service.
 * On create, sort_order defaults to the current max + 10 if not supplied.
 */
export async function upsertServiceCatalogue(
  payload: UpsertServicePayload,
): Promise<ServiceActionResult<{ id: string }>> {
  const auth = await requireServiceAdmin()
  if (!auth.ok) return auth

  // Sanitise
  const title = payload.title.trim()
  if (!title) return { ok: false, error: 'Název služby je povinný.' }
  if (payload.price < 0) return { ok: false, error: 'Cena nesmí být záporná.' }

  const supabase = await createClient()

  // Auto sort_order for new services
  let sortOrder = payload.sort_order
  if (!payload.id && (!sortOrder || sortOrder === 0)) {
    const { data: maxRow } = await supabase
      .from('services')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()
    sortOrder = ((maxRow?.sort_order ?? 0) as number) + 10
  }

  const row = {
    title,
    description:              payload.description?.trim() || null,
    price:                    payload.price,
    unit:                     payload.unit,
    slug:                     payload.slug?.trim() || null,
    standard:                 payload.standard,
    active:                   payload.active,
    show_on_web:              payload.show_on_web,
    available_in_reservation: payload.available_in_reservation,
    sort_order:               sortOrder,
    category_id:              payload.category_id ?? null,
    internal_note:            payload.internal_note?.trim() || null,
    custom_unit_label:        payload.custom_unit_label?.trim() || null,
    // Restore from archive on explicit save
    archived_at:              null,
  }

  if (payload.id) {
    const { error } = await supabase.from('services').update(row).eq('id', payload.id)
    if (error) return { ok: false, error: error.message }
    revalidateCatalogue()
    return { ok: true, data: { id: payload.id } }
  } else {
    const { data, error } = await supabase
      .from('services')
      .insert(row)
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    revalidateCatalogue()
    return { ok: true, data: { id: data.id } }
  }
}

/**
 * Archive a service (soft-delete). Sets archived_at = now() and active = false.
 * Use when the service has reservation history and cannot be hard-deleted.
 */
export async function archiveService(
  serviceId: string,
): Promise<ServiceActionResult> {
  const auth = await requireServiceAdmin()
  if (!auth.ok) return auth

  const supabase = await createClient()
  const { error } = await supabase
    .from('services')
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq('id', serviceId)

  if (error) return { ok: false, error: error.message }
  revalidateCatalogue()
  return { ok: true }
}

/**
 * Restore an archived service. Clears archived_at and re-activates.
 */
export async function restoreService(
  serviceId: string,
): Promise<ServiceActionResult> {
  const auth = await requireServiceAdmin()
  if (!auth.ok) return auth

  const supabase = await createClient()
  const { error } = await supabase
    .from('services')
    .update({ archived_at: null, active: true })
    .eq('id', serviceId)

  if (error) return { ok: false, error: error.message }
  revalidateCatalogue()
  return { ok: true }
}

/**
 * Hard-delete a service. Only allowed when the service has no reservation history.
 * The caller must confirm this by passing hasHistory = false, or the action will
 * re-check server-side and refuse.
 */
export async function deleteServiceSafe(
  serviceId: string,
): Promise<ServiceActionResult> {
  const auth = await requireServiceAdmin()
  if (!auth.ok) return auth

  const supabase = await createClient()

  // Server-side history check (cannot trust client)
  const { data: hasHistory } = await supabase.rpc('check_service_has_history', {
    p_service_id: serviceId,
  })
  if (hasHistory === true) {
    return {
      ok: false,
      error:
        'Tato služba má historii v rezervacích a nelze ji smazat. Místo toho ji archivujte.',
    }
  }

  const { error } = await supabase.from('services').delete().eq('id', serviceId)
  if (error) return { ok: false, error: error.message }
  revalidateCatalogue()
  return { ok: true }
}

/**
 * Batch-update sort_order for services after reordering.
 */
export async function reorderServices(
  items: { id: string; sort_order: number }[],
): Promise<ServiceActionResult> {
  const auth = await requireServiceAdmin()
  if (!auth.ok) return auth

  const supabase = await createClient()
  const updates = items.map(({ id, sort_order }) =>
    supabase.from('services').update({ sort_order }).eq('id', id),
  )
  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) return { ok: false, error: failed.error.message }
  revalidateCatalogue()
  return { ok: true }
}

// ─── Service categories ───────────────────────────────────────────────────────

export async function upsertServiceCategory(
  payload: UpsertServiceCategoryPayload,
): Promise<ServiceActionResult<{ id: number }>> {
  const auth = await requireServiceAdmin()
  if (!auth.ok) return auth

  const name = payload.name.trim()
  if (!name) return { ok: false, error: 'Název kategorie je povinný.' }

  const slug = payload.slug.trim().toLowerCase().replace(/\s+/g, '-')
  if (!slug) return { ok: false, error: 'Slug kategorie je povinný.' }

  const supabase = await createClient()

  const row = {
    name,
    slug,
    sort_order:         payload.sort_order,
    description:        payload.description?.trim() || null,
    visible_on_website: payload.visible_on_website,
    active:             payload.active,
  }

  if (payload.id) {
    const { error } = await supabase
      .from('service_categories')
      .update(row)
      .eq('id', payload.id)
    if (error) return { ok: false, error: error.message }
    revalidateCatalogue()
    return { ok: true, data: { id: payload.id } }
  } else {
    const { data, error } = await supabase
      .from('service_categories')
      .insert(row)
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    revalidateCatalogue()
    return { ok: true, data: { id: data.id } }
  }
}

/**
 * Delete a category. Refuses if any active (non-archived) services belong to it.
 */
export async function deleteServiceCategory(
  categoryId: number,
): Promise<ServiceActionResult> {
  const auth = await requireServiceAdmin()
  if (!auth.ok) return auth

  const supabase = await createClient()

  // Check for active services in this category
  const { count } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .is('archived_at', null)

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Kategorie obsahuje ${count} aktivní službu / ${count} aktivní služby. Nejdříve je přesuňte nebo archivujte.`,
    }
  }

  const { error } = await supabase
    .from('service_categories')
    .delete()
    .eq('id', categoryId)

  if (error) return { ok: false, error: error.message }
  revalidateCatalogue()
  return { ok: true }
}

/**
 * Batch-update sort_order for categories after reordering.
 */
export async function reorderServiceCategories(
  items: { id: number; sort_order: number }[],
): Promise<ServiceActionResult> {
  const auth = await requireServiceAdmin()
  if (!auth.ok) return auth

  const supabase = await createClient()
  const updates = items.map(({ id, sort_order }) =>
    supabase.from('service_categories').update({ sort_order }).eq('id', id),
  )
  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) return { ok: false, error: failed.error.message }
  revalidateCatalogue()
  return { ok: true }
}
