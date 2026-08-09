/**
 * lib/validate-url.ts
 * Server-side validation for admin-supplied external links.
 */

/** Hostnames that are always accepted regardless of path. */
const ALLOWED_GOOGLE_MAPS_HOSTNAMES = new Set([
  'maps.google.com',
  'maps.app.goo.gl',
  'goo.gl',
])

/**
 * Validates that a string is a safe, well-formed HTTPS URL pointing at a
 * legitimate Google Maps destination.
 *
 * Accepts:
 *   - https://maps.google.com/...
 *   - https://maps.app.goo.gl/...
 *   - https://goo.gl/maps/...
 *   - https://www.google.com/maps/... or https://google.com/maps/...
 *
 * Rejects: javascript:, data:, malformed URLs, non-https protocols, and any
 * hostname that isn't a recognised Google Maps domain.
 */
export function isValidGoogleMapsUrl(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false

  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return false
  }

  if (url.protocol !== 'https:') return false

  const host = url.hostname.toLowerCase()

  if (ALLOWED_GOOGLE_MAPS_HOSTNAMES.has(host)) return true

  if ((host === 'google.com' || host === 'www.google.com') && url.pathname.startsWith('/maps')) {
    return true
  }

  return false
}
