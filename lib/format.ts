import type { ServiceUnit } from './types'

const czk = new Intl.NumberFormat('cs-CZ', {
  style: 'currency',
  currency: 'CZK',
  maximumFractionDigits: 0,
})

export function formatPrice(value: number): string {
  return czk.format(value)
}

const unitLabels: Record<ServiceUnit, string> = {
  'per-stay': 'za pobyt',
  'per-night': 'za noc',
  'per-walk': 'za procházku',
  'per-day': 'za den',
  'one-off': 'jednorázově',
}

export function unitLabel(unit: ServiceUnit): string {
  return unitLabels[unit]
}

const dateFmt = new Intl.DateTimeFormat('cs-CZ', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return dateFmt.format(d)
}

/** Whole nights between two ISO date strings (Europe/Prague assumptions). */
export function nightsBetween(
  arrival: string | null,
  departure: string | null,
): number {
  if (!arrival || !departure) return 0
  const a = new Date(arrival)
  const b = new Date(departure)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000)
  return diff > 0 ? diff : 0
}
