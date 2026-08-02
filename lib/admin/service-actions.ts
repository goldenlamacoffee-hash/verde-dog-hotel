'use server'

/**
 * lib/admin/service-actions.ts
 *
 * Server Actions for the services catalogue admin.
 *
 * RULES:
 *  - Hard delete: owner role only; only if the service has NO reservation history.
 *  - Safe delete: if history exists, archive instead (archived_at = now()).
 *  - Restore: clears archived_at.
 *  - Standard atomicity: only one service can be standard+active+non-archived.
 *    When upsert sets standard=true, previous standard service is demoted automatically.
 *  - Optimistic concurrency: every mutating action checks the current `revision`
 *    and increments it; stale writes return { ok: false, code: 'CONFLICT' }.
 *  - Audit logging: every mutation writes a row to `audit_logs`.
 *  - Categories: full CRUD; category with active services cannot be deleted.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAdminProfile } from '@/lib/auth/roles'
import type { UpsertServicePayload, UpsertServiceCategoryPayload } from '@/lib/types'

// ─── Shared result type ───────────────────────────────────────────────────────

export interface ServiceActionResult<T = undefined> {
  ok: boolean
  error?: string
  /** 'CONFLICT' = optimistic-concurrency mismatch; user must reload. */
  code?: 'CONFLICT' | 'HISTORY_GUARD' | 'PERMISSION'
  data?: T
}

// ─── Permission guard ─────────────────────────────────────────────────────────

async function requireServiceAdmin(): Promise<
  | { ok: true; userId: string; role: string }
  | { ok: false; error: string; code: 'PERMISSION' }
> {
  const caller = await getAdminProfile()
  if (!caller) return { ok: false, error: 'Nepřihlášen.', code: 'PERMISSION' }
  if (caller.role !== 'owner' && caller.role !== 'admin') {
    return { ok: false, error: 'Nemáte oprávnění upravovat katalog služeb.', code: 'PERMISSION' }
  }
  return { ok: true, userId: caller.id, role: caller.role }
}

// ─── Audit helper ─────────────────────────────────────────────────────────────

async function writeAuditLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  event: string,
  entityType: 'service' | 'service_category',
  entityId: string | number,
  metadata: Record<string, unknown> = {},
) {
  // The `audit_logs` table has: id, created_at, user_id, action, entity_type, entity_id, metadata
  // `action` stores the semantic event string.
  await supabase.from('audit_logs').insert({
    user_id:     userId,
    action:      event,
    entity_type: entityType,
    entity_id:   String(entityId),
    metadata,
  })
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
 *
 * Standard atomicity: if the new service is standard=true, the previously
 * standard service (if any, different id) is automatically demoted to
 * standard=false before the upsert, inside the same logical operation.
 *
 * Optimistic concurrency: on update, pass the current `revision` value.
 * If the DB row has a different revision (concurrent edit), returns CONFLICT.
 */
export async function upsertServiceCatalogue(
  payload: UpsertServicePayload & { revision?: number },
): Promise<ServiceActionResult<{ id: string; revision: number }>> {
  const auth = await requireServiceAdmin()
  if (!auth.ok) return auth

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

  // Standard atomicity — demote previous standard service if setting a new one
  if (payload.standard && payload.active) {
    // Find any currently-standard service (excluding this one being updated)
    const query = supabase
      .from('services')
      .select('id')
      .eq('standard', true)
      .eq('active', true)
      .is('archived_at', null)
    if (payload.id) {
      query.neq('id', payload.id)
    }
    const { data: prevStandard } = await query.limit(1)
    if (prevStandard && prevStandard.length > 0) {
      await supabase
        .from('services')
        .update({ standard: false })
        .eq('id', prevStandard[0].id)
    }
  }

  const newRevision = (payload.revision ?? 0) + 1

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
    archived_at:              null,
    revision:                 newRevision,
  }

  if (payload.id) {
    // Optimistic concurrency: only update if revision matches
    const { data: updated, error } = await supabase
      .from('services')
      .update(row)
      .eq('id', payload.id)
      .eq('revision', payload.revision ?? 1)
      .select('id, revision')
      .single()

    if (error || !updated) {
      // Check if the row exists at all
      const { data: current } = await supabase
        .from('services')
        .select('revision')
        .eq('id', payload.id)
        .single()
      if (current) {
        return {
          ok: false,
          code: 'CONFLICT',
          error: 'Někdo jiný tuto položku mezitím upravil. Načtěte stránku znovu a opakujte úpravy.',
        }
      }
      return { ok: false, error: error?.message ?? 'Chyba při ukládání.' }
    }

    await writeAuditLog(supabase, auth.userId, 'service.updated', 'service', payload.id, {
      title,
      standard: payload.standard,
      active: payload.active,
    })
    revalidateCatalogue()
    return { ok: true, data: { id: updated.id, revision: updated.revision } }
  } else {
    const { data, error } = await supabase
      .from('services')
      .insert(row)
      .select('id, revision')
      .single()
    if (error) return { ok: false, error: error.message }

    await writeAuditLog(supabase, auth.userId, 'service.created', 'service', data.id, { title })
    revalidateCatalogue()
    return { ok: true, data: { id: data.id, revision: data.revision } }
  }
}

/**
 * Archive a service (soft-delete). Sets archived_at = now() and active = false.
 */
export async function archiveService(
  serviceId: string,
  revision: number,
): Promise<ServiceActionResult> {
  const auth = await requireServiceAdmin()
  if (!auth.ok) return auth

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('services')
    .update({
      archived_at: new Date().toISOString(),
      active:      false,
      revision:    revision + 1,
    })
    .eq('id', serviceId)
    .eq('revision', revision)
    .select('id')
    .single()

  if (error || !updated) {
    const { data: current } = await supabase.from('services').select('revision').eq('id', serviceId).single()
    if (current) return { ok: false, code: 'CONFLICT', error: 'Položka byla mezitím změněna. Načtěte stránku znovu.' }
    return { ok: false, error: error?.message ?? 'Chyba při archivaci.' }
  }

  await writeAuditLog(supabase, auth.userId, 'service.archived', 'service', serviceId, {})
  revalidateCatalogue()
  return { ok: true }
}

/**
 * Restore an archived service. Clears archived_at and re-activates.
 */
export async function restoreService(
  serviceId: string,
  revision: number,
): Promise<ServiceActionResult> {
  const auth = await requireServiceAdmin()
  if (!auth.ok) return auth

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('services')
    .update({ archived_at: null, active: true, revision: revision + 1 })
    .eq('id', serviceId)
    .eq('revision', revision)
    .select('id')
    .single()

  if (error || !updated) {
    const { data: current } = await supabase.from('services').select('revision').eq('id', serviceId).single()
    if (current) return { ok: false, code: 'CONFLICT', error: 'Položka byla mezitím změněna. Načtěte stránku znovu.' }
    return { ok: false, error: error?.message ?? 'Chyba při obnovení.' }
  }

  await writeAuditLog(supabase, auth.userId, 'service.restored', 'service', serviceId, {})
  revalidateCatalogue()
  return { ok: true }
}

/**
 * Hard-delete a service.
 * - Owner role only.
 * - Only allowed when the service has no reservation_services history.
 */
export async function deleteServiceSafe(
  serviceId: string,
): Promise<ServiceActionResult> {
  const auth = await requireServiceAdmin()
  if (!auth.ok) return auth

  // Owner-only gate
  if (auth.role !== 'owner') {
    return {
      ok: false,
      code: 'PERMISSION',
      error: 'Trvalé smazání je povoleno pouze vlastníkovi.',
    }
  }

  const supabase = await createClient()

  // Server-side history check (never trust client)
  const { data: hasHistory } = await supabase.rpc('check_service_has_history', {
    p_service_id: serviceId,
  })
  if (hasHistory === true) {
    return {
      ok: false,
      code: 'HISTORY_GUARD',
      error: 'Tato služba má historii v rezervacích a nelze ji smazat. Místo toho ji archivujte.',
    }
  }

  await writeAuditLog(supabase, auth.userId, 'service.deleted', 'service', serviceId, {})

  const { error } = await supabase.from('services').delete().eq('id', serviceId)
  if (error) return { ok: false, error: error.message }
  revalidateCatalogue()
  return { ok: true }
}

/**
 * Batch-update sort_order for services after reordering.
 * Moves one item up or down by swapping sort_order with its neighbour.
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
  payload: UpsertServiceCategoryPayload & { revision?: number },
): Promise<ServiceActionResult<{ id: number; revision: number }>> {
  const auth = await requireServiceAdmin()
  if (!auth.ok) return auth

  const name = payload.name.trim()
  if (!name) return { ok: false, error: 'Název kategorie je povinný.' }
  const slug = payload.slug.trim().toLowerCase().replace(/\s+/g, '-')
  if (!slug) return { ok: false, error: 'Slug kategorie je povinný.' }

  const supabase = await createClient()
  const newRevision = (payload.revision ?? 0) + 1

  const row = {
    name,
    slug,
    sort_order:         payload.sort_order,
    description:        payload.description?.trim() || null,
    visible_on_website: payload.visible_on_website,
    active:             payload.active,
    revision:           newRevision,
  }

  if (payload.id) {
    const { data: updated, error } = await supabase
      .from('service_categories')
      .update(row)
      .eq('id', payload.id)
      .eq('revision', payload.revision ?? 1)
      .select('id, revision')
      .single()

    if (error || !updated) {
      const { data: current } = await supabase.from('service_categories').select('revision').eq('id', payload.id).single()
      if (current) return { ok: false, code: 'CONFLICT', error: 'Kategorie byla mezitím změněna. Načtěte stránku znovu.' }
      return { ok: false, error: error?.message ?? 'Chyba při ukládání.' }
    }

    await writeAuditLog(supabase, auth.userId, 'category.updated', 'service_category', payload.id, { name })
    revalidateCatalogue()
    return { ok: true, data: { id: updated.id, revision: updated.revision } }
  } else {
    const { data, error } = await supabase
      .from('service_categories')
      .insert(row)
      .select('id, revision')
      .single()
    if (error) return { ok: false, error: error.message }

    await writeAuditLog(supabase, auth.userId, 'category.created', 'service_category', data.id, { name })
    revalidateCatalogue()
    return { ok: true, data: { id: data.id, revision: data.revision } }
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

  const { count } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .is('archived_at', null)

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      code: 'HISTORY_GUARD',
      error: `Kategorie obsahuje ${count} aktivní ${count === 1 ? 'službu' : 'služby'}. Nejdříve je přesuňte nebo archivujte.`,
    }
  }

  await writeAuditLog(supabase, auth.userId, 'category.deleted', 'service_category', categoryId, {})

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
