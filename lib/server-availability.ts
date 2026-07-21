/**
 * lib/server-availability.ts
 *
 * Thin adapter: re-exports the canonical availability check from lib/capacity.ts.
 * Kept as a separate file so existing imports (@/lib/server-availability) still
 * compile without changes to the API route and other callers.
 *
 * The actual per-night logic lives in checkRangeAvailability (lib/capacity.ts),
 * which delegates to the get_nightly_occupancy Postgres RPC so the check uses
 * the same status list and capacity settings as the booking RPC.
 */

export type { AvailabilityResult } from '@/lib/capacity'
export { checkRangeAvailability as checkAvailability } from '@/lib/capacity'
