import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

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

const ConsentsSchema = z.object({
  /** Combined required checkbox sent from the 2-checkbox UI */
  requiredCombined:         z.literal(true, { error: 'Povinný souhlas' }),
  /** Individual fields — derived from requiredCombined on the frontend, validated here for audit integrity */
  truthfulness:             z.literal(true, { error: 'Povinný souhlas' }),
  stayConditions:           z.literal(true, { error: 'Povinný souhlas' }),
  cancellationConditions:   z.literal(true, { error: 'Povinný souhlas' }),
  personalData:             z.literal(true, { error: 'Povinný souhlas' }),
  marketing:                z.boolean().optional().default(false),
})

const ReservationBodySchema = z.object({
  draft: z.object({
    arrival:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Neplatné datum příjezdu'),
    departure:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Neplatné datum odjezdu'),
    dogCount:         z.number().int().min(1).max(4),
    dogs:             z.array(DogSchema).min(1).max(4),
    // Frontend sends slugs (e.g. 'individual-walk') — resolved to UUIDs below
    selectedServices: z.array(z.string().max(80)).max(20).optional().default([]),
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
    const fieldErrors = parsed.error.flatten().fieldErrors
    return NextResponse.json(
      { error: 'Neplatná data formuláře.', fieldErrors },
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
  if (nights > 30) {
    return NextResponse.json({ error: 'Maximální délka pobytu je 30 nocí.' }, { status: 422 })
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

  // Resolve service slugs → UUIDs. The frontend sends slugs matching the
  // `slug` column in the `services` table; the RPC expects real UUIDs.
  let serviceIds: string[] = []
  if (draft.selectedServices.length > 0) {
    const supabaseForLookup = createServiceRoleClient()
    const { data: serviceRows, error: svcErr } = await supabaseForLookup
      .from('services')
      .select('id, slug')
      .in('slug', draft.selectedServices)
      .eq('active', true)
    if (svcErr) {
      console.error('[verde] services slug lookup error:', svcErr.message)
      return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 })
    }
    const slugToId = new Map((serviceRows ?? []).map((r) => [r.slug, r.id]))
    serviceIds = draft.selectedServices
      .map((slug) => slugToId.get(slug))
      .filter((id): id is string => Boolean(id))
  }

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
    const msg = rpcError.message ?? ''
    // The RPC raises UNAVAILABLE: <reason> for capacity errors
    if (msg.includes('UNAVAILABLE:')) {
      const reason = msg.replace(/.*UNAVAILABLE:\s*/, '').trim()
      return NextResponse.json(
        { error: reason || 'Požadovaný termín není k dispozici.' },
        { status: 409 }
      )
    }
    console.error('[verde] create_reservation RPC error:', msg)
    return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 })
  }

  const result = rpcResult as {
    ref_number:      string
    reservation_id:  string
    total_price:     number
    deposit_amount:  number
    spots_remaining: number
  }

  return NextResponse.json(
    {
      refNumber:     result.ref_number,
      reservationId: result.reservation_id,
      totalPrice:    result.total_price,
      depositAmount: result.deposit_amount,
    },
    { status: 201 }
  )
}
