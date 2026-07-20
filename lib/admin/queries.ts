import { createClient } from '@/lib/supabase/server'

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
