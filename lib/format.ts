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

const adminDateTimeFmt = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: 'Europe/Prague',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const adminDateTimeSecFmt = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: 'Europe/Prague',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/**
 * Format a UTC timestamp for admin UI display.
 *
 * Converts to Europe/Prague (handles CET/CEST automatically via the IANA tz db).
 * Returns Czech format: "24. 7. 2026, 14:37"
 * Returns "—" for null / undefined / invalid values.
 *
 * @param value  ISO string, Date, null, or undefined
 * @param opts.withSeconds  If true, returns full precision including seconds (for tooltips)
 */
export function formatAdminDateTime(
  value: string | Date | null | undefined,
  opts?: { withSeconds?: boolean },
): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return opts?.withSeconds ? adminDateTimeSecFmt.format(d) : adminDateTimeFmt.format(d)
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
