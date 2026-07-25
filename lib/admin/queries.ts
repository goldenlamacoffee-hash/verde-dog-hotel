import { createClient } from '@/lib/supabase/server'
import type { AppRole } from '@/lib/auth/roles'

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [reservations, customers, checkedIn, upcoming] = await Promise.all([
    supabase.from('reservations').select('id', { count: 'exact', head: true }),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'checked_in'),
    supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('arrival_date', today),
  ])

  return {
    totalReservations: reservations.count ?? 0,
    totalCustomers: customers.count ?? 0,
    checkedIn: checkedIn.count ?? 0,
    upcoming: upcoming.count ?? 0,
  }
}

// ─── Reservations ─────────────────────────────────────────────────────────────

export async function getReservations(opts?: {
  status?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  let q = supabase
    .from('reservations')
    .select(`
      id, ref_number, status, arrival_date, departure_date,
      total_price, deposit_paid, source, created_at,
      customer:customers(id, first_name, last_name, email, phone),
      reservation_dogs(
        dog:dogs(id, name, breed_id, dog_breeds(name))
      )
    `)
    .order('arrival_date', { ascending: false })

  if (opts?.status) q = q.eq('status', opts.status)
  if (opts?.from) q = q.gte('arrival_date', opts.from)
  if (opts?.to) q = q.lte('arrival_date', opts.to)
  if (opts?.limit) q = q.limit(opts.limit)
  if (opts?.offset) q = q.range(opts.offset, (opts.offset + (opts.limit ?? 50)) - 1)

  return q
}

export async function getReservationById(id: string) {
  const supabase = await createClient()
  return supabase
    .from('reservations')
    .select(`
      *,
      customer:customers(*),
      reservation_dogs(
        id, box_number, notes,
        dog:dogs(*, dog_breeds(name))
      ),
      reservation_services(
        id, quantity, unit_price, total_price, notes,
        service:services(id, title, unit)
      )
    `)
    .eq('id', id)
    .single()
}

// ─── Customers ────────────────────────────────────────────────────────────────

export async function getCustomers(opts?: { search?: string; limit?: number; offset?: number }) {
  const supabase = await createClient()
  let q = supabase
    .from('customers')
    .select('*, dogs(id, name)', { count: 'exact' })
    .order('last_name')

  if (opts?.search) {
    q = q.or(`first_name.ilike.%${opts.search}%,last_name.ilike.%${opts.search}%,email.ilike.%${opts.search}%`)
  }
  if (opts?.limit) q = q.limit(opts.limit)
  if (opts?.offset) q = q.range(opts.offset, (opts.offset + (opts.limit ?? 50)) - 1)
  return q
}

export async function getCustomerById(id: string) {
  const supabase = await createClient()
  return supabase
    .from('customers')
    .select(`*, dogs(*, dog_breeds(name)), reservations(id, ref_number, status, arrival_date, departure_date, total_price)`)
    .eq('id', id)
    .single()
}

// ─── Dogs ─────────────────────────────────────────────────────────────────────

export async function getDogs(customerId?: string) {
  const supabase = await createClient()
  let q = supabase
    .from('dogs')
    .select('*, dog_breeds(name), customers(first_name, last_name)')
    .order('name')
  if (customerId) q = q.eq('customer_id', customerId)
  return q
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function getAdminServices() {
  const supabase = await createClient()
  return supabase
    .from('services')
    .select('*, service_categories(name, slug)')
    .order('sort_order')
}

// ─── CMS ──────────────────────────────────────────────────────────────────────

export async function getSiteSetting(key: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('site_settings').select('value').eq('key', key).single()
  return data?.value ?? null
}

export async function getAdminFaq() {
  const supabase = await createClient()
  return supabase.from('faq_items').select('*').order('sort_order')
}

export async function getAdminTestimonials() {
  const supabase = await createClient()
  return supabase.from('testimonials').select('*').order('sort_order')
}

export async function getAdminGallery() {
  const supabase = await createClient()
  return supabase.from('gallery_items').select('*').order('sort_order')
}

export async function getAdminRoles() {
  const supabase = await createClient()
  return supabase.from('admin_roles').select('*, profiles(full_name, avatar_url)').order('created_at')
}

/**
 * List ALL admin users — joins auth.users via the service-role client so RLS
 * (admin_roles_select_self) does not filter out other users' rows.
 *
 * Returns a denormalised view: admin_roles fields + email + invite/auth state.
 * Only call this from server-side code (Server Actions, Route Handlers, RSC).
 */
export async function getAdminUsersWithAuth(): Promise<AdminUserRow[]> {
  const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
  const admin = createServiceRoleClient()

  // Service-role bypasses RLS — fetches all rows
  const { data: roles, error: rolesErr } = await admin
    .from('admin_roles')
    .select('user_id, role, full_name, active, created_at')
    .order('created_at')

  if (rolesErr || !roles?.length) return []

  // Batch-fetch auth.users for the collected user_ids
  const userIds = roles.map((r) => r.user_id)
  const { data: { users: authUsers }, error: authErr } =
    await admin.auth.admin.listUsers({ perPage: 1000 })

  const authMap = new Map<string, AuthUserShape>()
  if (!authErr && authUsers) {
    for (const u of authUsers) {
      if (userIds.includes(u.id)) {
        authMap.set(u.id, {
          email:        u.email ?? '',
          invited_at:   u.invited_at ?? null,
          confirmed_at: u.confirmed_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
        })
      }
    }
  }

  return roles.map((r) => {
    const auth = authMap.get(r.user_id)
    return {
      user_id:         r.user_id,
      role:            r.role as AppRole,
      full_name:       r.full_name ?? null,
      active:          r.active,
      created_at:      r.created_at,
      email:           auth?.email ?? '',
      invited_at:      auth?.invited_at ?? null,
      confirmed_at:    auth?.confirmed_at ?? null,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
    }
  })
}

export interface AuthUserShape {
  email: string
  invited_at: string | null
  confirmed_at: string | null
  last_sign_in_at: string | null
}

export interface AdminUserRow {
  user_id: string
  role: AppRole
  full_name: string | null
  active: boolean
  created_at: string
  email: string
  invited_at: string | null
  confirmed_at: string | null
  last_sign_in_at: string | null
}

// ─── Calendar / Capacity ──────────────────────────────────────────────────────

export async function getReservationsForRange(from: string, to: string) {
  const supabase = await createClient()
  return supabase
    .from('reservations')
    .select(`
      id, ref_number, status, arrival_date, departure_date,
      customer:customers(first_name, last_name),
      reservation_dogs(dog:dogs(name))
    `)
    .lte('arrival_date', to)
    .gte('departure_date', from)
    .not('status', 'in', '("cancelled","no_show")')
    .order('arrival_date')
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function getPaymentsForReservation(reservationId: string) {
  const supabase = await createClient()
  return supabase
    .from('payments')
    .select('*')
    .eq('reservation_id', reservationId)
    .order('paid_at', { ascending: false })
}

// ─── Capacity overrides ───────────────────────────────────────────────────────

export async function getCapacityOverrides(opts?: { from?: string; to?: string }) {
  const supabase = await createClient()
  let q = supabase
    .from('capacity_overrides')
    .select('*')
    .order('date_from')
  if (opts?.from) q = q.gte('date_to', opts.from)
  if (opts?.to) q = q.lte('date_from', opts.to)
  return q
}

// ─── Pricing rules ────────────────────────────────────────────────────────────

export async function getAdminPricingRules() {
  const supabase = await createClient()
  return supabase
    .from('pricing_rules')
    .select('*')
    .order('sort_order')
}

// ─── Page sections (CMS) ─────────────────────────────────────────────────────

export async function getPageSections(page?: string) {
  const supabase = await createClient()
  let q = supabase
    .from('page_sections')
    .select('*')
    .order('sort_order')
  if (page) q = q.eq('page', page)
  return q
}

export async function getPageSection(page: string, sectionKey: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('page_sections')
    .select('*')
    .eq('page', page)
    .eq('section_key', sectionKey)
    .single()
  return data
}

// ─── Media assets ─────────────────────────────────────────────────────────────

export async function getMediaAssets(opts?: {
  search?: string
  tag?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  let q = supabase
    .from('media_assets')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (opts?.search) q = q.ilike('filename', `%${opts.search}%`)
  if (opts?.tag) q = q.contains('tags', [opts.tag])
  if (opts?.limit) q = q.limit(opts.limit)
  if (opts?.offset) q = q.range(opts.offset, (opts.offset + (opts.limit ?? 48)) - 1)
  return q
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export async function getReservationDocuments(reservationId: string) {
  const supabase = await createClient()
  return supabase
    .from('reservation_documents')
    .select('id, filename, label, mime_type, size_bytes, created_at, document_type, dog_id')
    .eq('reservation_id', reservationId)
    .order('created_at', { ascending: true })
}

export async function getAuditLog(opts?: {
  tableName?: string
  recordId?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  let q = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('changed_at', { ascending: false })
  if (opts?.tableName) q = q.eq('table_name', opts.tableName)
  if (opts?.recordId)  q = q.eq('record_id',  opts.recordId)
  if (opts?.limit)     q = q.limit(opts.limit)
  if (opts?.offset)    q = q.range(opts.offset, (opts.offset + (opts.limit ?? 50)) - 1)
  return q
}
