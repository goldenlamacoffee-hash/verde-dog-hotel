'use client'

import { useState, useTransition } from 'react'
import { updateReservationStatus } from '@/lib/admin/actions'

const TRANSITIONS: Record<string, { label: string; next: string; danger?: boolean }[]> = {
  inquiry:    [{ label: 'Potvrdit', next: 'confirmed' }, { label: 'Zrušit', next: 'cancelled', danger: true }],
  confirmed:  [{ label: 'Ubytovat (check-in)', next: 'checked_in' }, { label: 'Zrušit', next: 'cancelled', danger: true }],
  checked_in: [{ label: 'Odhlásit (check-out)', next: 'checked_out' }],
  checked_out:[],
  cancelled:  [],
  no_show:    [],
}

interface Props { reservationId: string; currentStatus: string }

export function ReservationActions({ reservationId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  const actions = TRANSITIONS[currentStatus] ?? []

  if (!actions.length) {
    return <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>Žádné dostupné akce.</p>
  }

  function handleAction(next: string) {
    startTransition(async () => {
      await updateReservationStatus(reservationId, next)
      setDone(true)
    })
  }

  return (
    <div className="space-y-2">
      {actions.map(a => (
        <button
          key={a.next}
          disabled={isPending}
          onClick={() => handleAction(a.next)}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-60"
          style={{
            background: a.danger ? '#fee2e2' : 'var(--admin-accent-light)',
            color: a.danger ? 'var(--admin-danger)' : 'var(--admin-accent)',
            border: `1px solid ${a.danger ? '#fecaca' : 'transparent'}`,
          }}
        >
          {isPending ? 'Ukládám…' : a.label}
        </button>
      ))}
      {done && (
        <p className="text-xs pt-1" style={{ color: 'var(--admin-success)' }}>Stav aktualizován.</p>
      )}
    </div>
  )
}
