/**
 * lib/slug.ts
 *
 * Shared slug utilities for the VERDE service catalogue.
 *
 * Rules (match the DB unique constraint on services.slug):
 *  - Lowercase
 *  - Czech/diacritics stripped via unicode normalisation
 *  - Only [a-z0-9-] kept; spaces and non-alphanum → hyphens
 *  - No leading/trailing hyphens; no consecutive hyphens
 *  - Max 80 chars
 */

/**
 * Convert a human-readable service title to a URL-safe slug.
 *
 * Examples:
 *   "Individuální procházka" → "individualni-prochazka"
 *   "Přespání (1 noc)"      → "prepsani-1-noc"
 *   "  Grooming & Care  "   → "grooming-care"
 */
export function slugifyServiceName(title: string): string {
  return title
    .normalize('NFD')                          // decompose diacritics
    .replace(/[\u0300-\u036f]/g, '')           // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')            // non-alphanum → space
    .trim()
    .replace(/[\s-]+/g, '-')                   // collapse spaces/hyphens
    .slice(0, 80)
    .replace(/^-+|-+$/g, '')                   // trim leading/trailing -
}

/**
 * Generate a slug that does not collide with `existingSlugs`.
 * If the base slug is taken, appends "-2", "-3", … until a free slot is found.
 *
 * @param title         Human-readable title to derive slug from
 * @param existingSlugs Set (or array) of slugs already present in the DB
 */
export function slugifyServiceNameUnique(
  title: string,
  existingSlugs: string[] | Set<string>,
): string {
  const base = slugifyServiceName(title)
  const taken = existingSlugs instanceof Set ? existingSlugs : new Set(existingSlugs)

  if (!taken.has(base)) return base

  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}
