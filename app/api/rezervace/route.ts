import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { computeServerEstimate } from '@/lib/server-pricing'
import { checkAvailability } from '@/lib/server-availability'
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
    selectedServices: z.array(z.string().uuid()).max(20).optional().default([]),
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
          'Retry-After':       String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': '5',
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
  const arrival   = new Date(draft.arrival)
  const departure = new Date(draft.departure)
  const today     = new Date()
  today.setHours(0, 0, 0, 0)

  if (arrival < today) {
    return NextResponse.json({ error: 'Datum příjezdu nemůže být v minulosti.' }, { status: 422 })
  }
  if (departure <= arrival) {
    return NextResponse.json({ error: 'Datum odjezdu musí být po datu příjezdu.' }, { status: 422 })
  }
  const nights = Math.round((departure.getTime() - arrival.getTime()) / 86_400_000)
  if (nights > 30) {
    return NextResponse.json({ error: 'Maximální délka pobytu je 30 nocí.' }, { status: 422 })
  }

  // 4. Availability check — must pass before any DB writes
  const availability = await checkAvailability(
    draft.arrival,
    draft.departure,
    draft.dogCount,
  )
  if (!availability.available) {
    return NextResponse.json(
      { error: availability.reason ?? 'Požadovaný termín není k dispozici.' },
      { status: 409 }
    )
  }

  // 5. Server-side authoritative price calculation
  const estimate = await computeServerEstimate(
    draft.arrival,
    draft.departure,
    draft.dogCount,
    draft.selectedServices,
  )

  // 6. Persist to DB using service-role client (bypasses RLS)
  const supabase = createServiceRoleClient()

  try {
    // 6a. Upsert customer
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .upsert(
        {
          first_name: draft.owner.firstName,
          last_name:  draft.owner.lastName,
          email:      draft.owner.email,
          phone:      draft.owner.phone  || null,
          address:    draft.owner.address || null,
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (custErr || !customer) {
      console.error('[verde] customer upsert error:', custErr?.message)
      return NextResponse.json({ error: 'Chyba při ukládání zákazníka.' }, { status: 500 })
    }

    // 6b. Generate collision-free reference number via DB sequence
    const { data: refData, error: refErr } = await supabase
      .rpc('next_reservation_ref')
    if (refErr || !refData) {
      console.error('[verde] ref RPC error:', refErr?.message)
      return NextResponse.json({ error: 'Chyba při generování čísla rezervace.' }, { status: 500 })
    }
    const refNumber = refData as string

    // 6c. Create reservation (using server-computed price)
    const { data: reservation, error: resErr } = await supabase
      .from('reservations')
      .insert({
        customer_id:    customer.id,
        ref_number:     refNumber,
        arrival_date:   draft.arrival,
        departure_date: draft.departure,
        total_price:    estimate.total,
        deposit_amount: estimate.deposit,
        deposit_paid:   false,
        paid_in_full:   false,
        status:         'inquiry',
        source:         'web',
        notes:          draft.owner.message || null,
      })
      .select('id')
      .single()

    if (resErr || !reservation) {
      console.error('[verde] reservation insert error:', resErr?.message)
      return NextResponse.json({ error: 'Chyba při vytváření rezervace.' }, { status: 500 })
    }

    // 6d. Upsert dogs + link to reservation
    for (const dog of draft.dogs) {
      if (!dog.name?.trim()) continue

      const { data: dogRow, error: dogErr } = await supabase
        .from('dogs')
        .insert({
          customer_id:    customer.id,
          name:           dog.name.trim(),
          breed_other:    dog.breed    || null,
          sex:            dog.sex      || null,
          neutered:       dog.neutered ?? false,
          weight_kg:      dog.weightKg ? parseFloat(dog.weightKg) : null,
          health_notes: [
            dog.feedingRegime ? `Krmení: ${dog.feedingRegime}` : '',
            dog.medications   ? `Léky: ${dog.medications}`     : '',
            dog.note          || '',
          ].filter(Boolean).join('\n') || null,
          behavior_notes: dog.compatibility || null,
        })
        .select('id')
        .single()

      if (dogErr || !dogRow) continue

      await supabase.from('reservation_dogs').insert({
        reservation_id: reservation.id,
        dog_id:         dogRow.id,
      })
    }

    // 6e. Link selected add-on services
    for (const serviceId of draft.selectedServices) {
      const { data: svc } = await supabase
        .from('services')
        .select('price, unit')
        .eq('id', serviceId)
        .single()
      if (!svc) continue

      const unit = svc.unit ?? ''
      const qty  = ['night', 'day', 'per-night', 'per-day'].includes(unit)
        ? Math.max(nights, 1)
        : 1

      await supabase.from('reservation_services').insert({
        reservation_id: reservation.id,
        service_id:     serviceId,
        quantity:       qty,
        unit_price:     svc.price,
        total_price:    qty * svc.price,
      })
    }

    // 6f. Insert consent records
    const ip        = getClientIp(req)
    const userAgent = req.headers.get('user-agent') ?? ''
    const consentRows = [
      { type: 'truthfulness',           accepted: draft.consents.truthfulness          },
      { type: 'stay_conditions',        accepted: draft.consents.stayConditions        },
      { type: 'cancellation_conditions', accepted: draft.consents.cancellationConditions },
      { type: 'gdpr',                   accepted: draft.consents.personalData          },
      { type: 'marketing',              accepted: draft.consents.marketing ?? false    },
    ].map((c) => ({
      reservation_id: reservation.id,
      type:           c.type,
      accepted:       c.accepted,
      ip_address:     ip,
      user_agent:     userAgent,
    }))

    await supabase.from('consents').insert(consentRows)

    // 6g. Mark customer as GDPR-consented when personalData accepted
    if (draft.consents.personalData) {
      await supabase
        .from('customers')
        .update({ gdpr_consent: true, gdpr_consent_at: new Date().toISOString() })
        .eq('id', customer.id)
    }

    return NextResponse.json({ refNumber, reservationId: reservation.id }, { status: 201 })
  } catch (err) {
    console.error('[verde] rezervace API unexpected error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 })
  }
}
