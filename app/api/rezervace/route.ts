import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { draft, estimate } = body

    if (!draft || !estimate) {
      return NextResponse.json({ error: 'Missing payload' }, { status: 400 })
    }

    // Validate required fields
    if (!draft.arrival || !draft.departure || !draft.owner?.email) {
      return NextResponse.json({ error: 'Chybí povinné údaje.' }, { status: 422 })
    }

    const supabase = await createClient()

    // 1. Upsert customer
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .upsert(
        {
          first_name: draft.owner.firstName,
          last_name: draft.owner.lastName,
          email: draft.owner.email,
          phone: draft.owner.phone || null,
          address: draft.owner.address || null,
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (custErr || !customer) {
      console.error('[v0] customer upsert error:', custErr)
      return NextResponse.json({ error: 'Chyba při ukládání zákazníka.' }, { status: 500 })
    }

    // 2. Generate reference number
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
    const seq = String((count ?? 0) + 1).padStart(4, '0')
    const refNumber = `VER-${year}-${seq}`

    // 3. Create reservation
    const { data: reservation, error: resErr } = await supabase
      .from('reservations')
      .insert({
        customer_id: customer.id,
        ref_number: refNumber,
        arrival_date: draft.arrival,
        departure_date: draft.departure,
        total_price: estimate.total,
        deposit_amount: estimate.deposit,
        deposit_paid: false,
        paid_in_full: false,
        status: 'inquiry',
        source: 'web',
        notes: draft.owner.message || null,
      })
      .select('id')
      .single()

    if (resErr || !reservation) {
      console.error('[v0] reservation insert error:', resErr)
      return NextResponse.json({ error: 'Chyba při vytváření rezervace.' }, { status: 500 })
    }

    // 4. Upsert dogs + link to reservation
    for (const dog of draft.dogs) {
      if (!dog.name?.trim()) continue

      const { data: dogRow, error: dogErr } = await supabase
        .from('dogs')
        .insert({
          customer_id: customer.id,
          name: dog.name.trim(),
          breed_other: dog.breed || null,
          sex: dog.sex || null,
          neutered: dog.neutered ?? false,
          weight_kg: dog.weightKg ? parseFloat(dog.weightKg) : null,
          health_notes: [
            dog.feedingRegime ? `Krmení: ${dog.feedingRegime}` : '',
            dog.medications ? `Léky: ${dog.medications}` : '',
            dog.note || '',
          ].filter(Boolean).join('\n') || null,
          behavior_notes: dog.compatibility || null,
        })
        .select('id')
        .single()

      if (dogErr) {
        console.error('[v0] dog insert error:', dogErr)
        continue
      }

      await supabase.from('reservation_dogs').insert({
        reservation_id: reservation.id,
        dog_id: dogRow!.id,
      })
    }

    // 5. Link selected add-on services
    for (const serviceId of draft.selectedServices) {
      const { data: svc } = await supabase
        .from('services')
        .select('price, unit')
        .eq('id', serviceId)
        .single()
      if (!svc) continue

      const nights = estimate.nights
      const qty = ['night', 'day', 'per-night', 'per-day'].includes(svc.unit) ? Math.max(nights, 1) : 1

      await supabase.from('reservation_services').insert({
        reservation_id: reservation.id,
        service_id: serviceId,
        quantity: qty,
        unit_price: svc.price,
        total_price: qty * svc.price,
      })
    }

    return NextResponse.json({ refNumber, reservationId: reservation.id }, { status: 201 })
  } catch (err) {
    console.error('[v0] rezervace API error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 })
  }
}
