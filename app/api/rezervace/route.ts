import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { computeServerEstimate } from '@/lib/server-pricing'

// ─── Zod validation schema ─────────────────────────────────────────────────────

const DogSchema = z.object({
  name:           z.string().min(1, 'Jméno psa je povinné').max(100),
  breed:          z.string().max(120).optional().default(''),
  ageOrBirth:     z.string().max(50).optional().default(''),
  sex:            z.enum(['male', 'female', '']).optional().default(''),
  neutered:       z.boolean().optional().default(false),
  weightKg:       z.string().max(10).optional().default(''),
  feedingRegime:  z.string().max(500).optional().default(''),
  medications:    z.string().max(500).optional().default(''),
  compatibility:  z.string().max(500).optional().default(''),
  note:           z.string().max(1000).optional().default(''),
})

const OwnerSchema = z.object({
  firstName:      z.string().min(1, 'Jméno je povinné').max(100),
  lastName:       z.string().min(1, 'Příjmení je povinné').max(100),
  email:          z.string().email('Neplatný e-mail'),
  phone:          z
    .string()
    .regex(/^[+\d\s\-()]{7,20}$/, 'Neplatné telefonní číslo')
    .optional()
    .or(z.literal('')),
  address:        z.string().max(300).optional().default(''),
  emergencyName:  z.string().max(100).optional().default(''),
  emergencyPhone: z.string().max(30).optional().default(''),
  message:        z.string().max(2000).optional().default(''),
})

// requiredCombined is the combined checkbox from the new 2-checkbox UI.
// The individual fields (truthfulness, stayConditions, cancellationConditions,
// personalData) remain required because they are what the RPC stores.
// The UI sets all four to true when requiredCombined is checked, so they
// always arrive together. requiredCombined itself is optional to stay
// backward-compatible with any client that populates only the individual fields.
const ConsentsSchema = z.object({
  requiredCombined:         z.literal(true).optional(),
  truthfulness:             z.literal(true, { error: 'Pro odeslání žádosti je nutné potvrdit povinný souhlas.' }),
  stayConditions:           z.literal(true, { error: 'Pro odeslání žádosti je nutné potvrdit povinný souhlas.' }),
  cancellationConditions:   z.literal(true, { error: 'Pro odeslání žádosti je nutné potvrdit povinný souhlas.' }),
  personalData:             z.literal(true, { error: 'Pro odeslání žádosti je nutné potvrdit povinný souhlas.' }),
  marketing:                z.boolean().optional().default(false),
})

const ReservationBodySchema = z.object({
  draft: z.object({
    arrival:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Neplatné datum příjezdu'),
    departure:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Neplatné datum odjezdu'),
    // Ceiling of 10 is a safety limit; actual availability is enforced by the
    // server-side RPC capacity engine, not by this static Zod max.
    dogCount:         z.number().int().min(1).max(10),
    dogs:             z.array(DogSchema).min(1).max(10),
    // Frontend sends DB UUIDs (service.id). Slugs are no longer used client-side.
    selectedServices: z.array(z.string().uuid('Neplatný identifikátor služby')).max(20).optional().default([]),
    owner:            OwnerSchema,
    consents:         ConsentsSchema,
  }),
})

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Rate limiting — 5 submissions per IP per minute
  const ip = getClientIp(req)
  const limit = rateLimit(ip, { maxRequests: 5, windowMs: 60_000 })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Příliš mnoho požadavků. Zkuste to za chvíli.' },
      {
        status: 429,
        headers: {
          'Retry-After':           String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit':     '5',
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  // 2. Parse + Zod validate body
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Neplatný formát požadavku.' }, { status: 400 })
  }

  const parsed = ReservationBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    const issues = parsed.error.issues
    // Build a flat path→messages map for the response
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of issues) {
      const key = issue.path.join('.')
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
    }

    // Derive a human-readable message from the issue paths
    let humanError = 'Neplatná data formuláře.'
    const paths = issues.map((i) => i.path.join('.'))
    const consentKeys = ['truthfulness', 'stayConditions', 'cancellationConditions', 'personalData', 'requiredCombined']
    const hasConsentError = paths.some((p) => consentKeys.some((k) => p.includes(k)))
    const hasDogError     = paths.some((p) => p.startsWith('draft.dogs'))
    const hasServiceError = paths.some((p) => p.includes('selectedServices'))

    if (hasConsentError) {
      humanError = 'Pro odeslání žádosti je nutné potvrdit povinný souhlas.'
    } else if (hasDogError) {
      humanError = 'Zkontrolujte prosím údaje u všech psů.'
    } else if (hasServiceError) {
      humanError = 'Jedna z vybraných služeb již není dostupná.'
    } else if (issues.length > 0) {
      humanError = issues[0].message
    }

    console.error('[verde] 422 issues:', JSON.stringify(fieldErrors))
    return NextResponse.json(
      { error: humanError, fieldErrors },
      { status: 422 }
    )
  }

  const { draft } = parsed.data

  // 3. Business-logic date validation
  const arrivalDate   = new Date(draft.arrival)
  const departureDate = new Date(draft.departure)
  const today         = new Date()
  today.setHours(0, 0, 0, 0)

  if (arrivalDate < today) {
    return NextResponse.json({ error: 'Datum příjezdu nemůže být v minulosti.' }, { status: 422 })
  }
  if (departureDate <= arrivalDate) {
    return NextResponse.json({ error: 'Datum odjezdu musí být po datu příjezdu.' }, { status: 422 })
  }
  const nights = Math.round(
    (departureDate.getTime() - arrivalDate.getTime()) / 86_400_000
  )

  // Load the optional maximum-stay setting from CMS.
  // null / missing / 0 → no maximum enforced.
  // Positive integer   → reject stays longer than this value.
  {
    const supabaseForSettings = createServiceRoleClient()
    const { data: maxStaySetting } = await supabaseForSettings
      .from('site_settings')
      .select('value')
      .eq('key', 'maximumStayNights')
      .maybeSingle()
    const rawNights = (maxStaySetting?.value as Record<string, unknown> | null)?.nights
    const maxStayNights =
      typeof rawNights === 'number' && Number.isInteger(rawNights) && rawNights >= 1
        ? rawNights
        : null

    if (maxStayNights !== null && nights > maxStayNights) {
      return NextResponse.json(
        {
          error: `Maximální délka pobytu je ${maxStayNights} nocí.`,
          code: 'MAXIMUM_STAY_EXCEEDED',
        },
        { status: 422 }
      )
    }
  }

  // 4. Build RPC payload — map form shape to DB shape
  const userAgent = req.headers.get('user-agent') ?? ''

  // Dogs: map form fields to RPC jsonb shape
  const dogsPayload = draft.dogs
    .filter((d) => d.name?.trim())
    .map((d) => ({
      name:          d.name.trim(),
      breed_other:   d.breed     || null,
      sex:           d.sex       || null,
      date_of_birth: null,  // form uses ageOrBirth text, not ISO date
      weight_kg:     d.weightKg ? parseFloat(d.weightKg) : null,
    }))

  // 4b. Validate that submitted UUIDs are active, non-archived, in-reservation services
  // and compute the authoritative server-side estimate + snapshots.
  let serviceIds: string[] = []
  let serviceSnapshots: import('@/lib/server-pricing').ServiceSnapshot[] = []

  if (draft.selectedServices.length > 0) {
    const supabaseForValidation = createServiceRoleClient()
    const { data: validRows, error: svcErr } = await supabaseForValidation
      .from('services')
      .select('id')
      .in('id', draft.selectedServices)
      .eq('active', true)
      .is('archived_at', null)
      .eq('available_in_reservation', true)
    if (svcErr) {
      console.error('[verde] services validation error:', svcErr.message)
      return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 })
    }
    const validIds = new Set((validRows ?? []).map((r) => r.id))
    serviceIds = draft.selectedServices.filter((id) => validIds.has(id))
    if (serviceIds.length !== draft.selectedServices.length) {
      return NextResponse.json(
        { error: 'Jedna z vybraných služeb již není dostupná.' },
        { status: 422 }
      )
    }
  }

  // Compute authoritative server-side pricing — ignores all client prices
  const { estimate: serverEstimate, snapshots } = await computeServerEstimate(
    draft.arrival,
    draft.departure,
    draft.dogCount,
    serviceIds,
  )
  serviceSnapshots = snapshots

  // Consents jsonb
  const consentsPayload = {
    truthfulness:           draft.consents.truthfulness,
    stayConditions:         draft.consents.stayConditions,
    cancellationConditions: draft.consents.cancellationConditions,
    personalData:           draft.consents.personalData,
    marketing:              draft.consents.marketing ?? false,
  }

  // 5. Single atomic RPC call — availability + pricing + all inserts in one transaction
  const supabase = createServiceRoleClient()

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'create_reservation',
    {
      p_arrival:       draft.arrival,
      p_departure:     draft.departure,
      p_dog_count:     draft.dogCount,
      p_first_name:    draft.owner.firstName,
      p_last_name:     draft.owner.lastName,
      p_email:         draft.owner.email,
      p_phone:         draft.owner.phone  || '',
      p_customer_note: draft.owner.message || '',
      p_dogs:          dogsPayload,
      p_service_ids:   serviceIds,
      p_consents:      consentsPayload,
      p_ip_address:    ip,
      p_user_agent:    userAgent,
    }
  )

  if (rpcError) {
    const msg  = rpcError.message ?? ''
    const code = (rpcError as { code?: string }).code ?? ''

    // P0003 — night is unreleased (month not published)
    // P0004 — night is explicitly closed by admin
    // Both are user-actionable "not available" conditions → 409 Conflict.
    if (code === 'P0003' || code === 'P0004') {
      return NextResponse.json(
        { error: msg || 'Požadovaný termín není k dispozici.', code: code === 'P0003' ? 'UNRELEASED' : 'CLOSED' },
        { status: 409 },
      )
    }

    // P0002 — capacity exceeded → 409
    if (code === 'P0002') {
      return NextResponse.json(
        { error: msg || 'Požadovaný termín není k dispozici.', code: 'CAPACITY_EXCEEDED' },
        { status: 409 },
      )
    }

    // P0001 — basic validation (dates, dog count) → 422
    if (code === 'P0001') {
      return NextResponse.json(
        { error: msg || 'Neplatná data formuláře.' },
        { status: 422 },
      )
    }

    // Legacy UNAVAILABLE: prefix format (kept for backwards-compat)
    if (msg.includes('UNAVAILABLE:')) {
      const reason = msg.replace(/.*UNAVAILABLE:\s*/, '').trim()
      return NextResponse.json(
        { error: reason || 'Požadovaný termín není k dispozici.' },
        { status: 409 },
      )
    }

    // MAXIMUM_STAY_EXCEEDED: prefix format (kept for backwards-compat)
    if (msg.includes('MAXIMUM_STAY_EXCEEDED:')) {
      const reason = msg.replace(/.*MAXIMUM_STAY_EXCEEDED:\s*/, '').trim()
      return NextResponse.json(
        { error: reason || 'Maximální délka pobytu byla překročena.', code: 'MAXIMUM_STAY_EXCEEDED' },
        { status: 422 },
      )
    }

    console.error('[verde] create_reservation RPC error:', code, msg)
    return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 })
  }

  const result = rpcResult as {
    ref_number:      string
    reservation_id:  string
    total_price:     number
    deposit_amount:  number
    spots_remaining: number
  }

  // Write snapshot fields (service_title, service_unit, currency) to each
  // reservation_services row — these are set server-side only, never from
  // client input, so the historical record is always authoritative.
  if (serviceSnapshots.length > 0) {
    const supabaseSnap = createServiceRoleClient()
    await Promise.all(
      serviceSnapshots.map((snap) =>
        supabaseSnap
          .from('reservation_services')
          .update({
            service_title: snap.service_title,
            service_unit:  snap.service_unit,
            currency:      snap.currency,
            // Overwrite price_at_booking with the server-authoritative value
            price_at_booking: snap.price_at_booking,
          })
          .eq('reservation_id', result.reservation_id)
          .eq('service_id', snap.service_id)
      )
    )
  }

  return NextResponse.json(
    {
      refNumber:      result.ref_number,
      reservationId:  result.reservation_id,
      // Return the server-authoritative total, not the RPC's stored value,
      // so the confirmation screen always shows what the pricing engine computed.
      totalPrice:     serverEstimate.total,
      depositAmount:  serverEstimate.deposit,
    },
    { status: 201 }
  )
}
