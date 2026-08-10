/**
 * CMS source-of-truth helpers.
 *
 * Rule: once a `page_sections` row exists for a section, that row is the
 * SOLE source of truth for its fields. An empty/missing field on an
 * *existing* CMS row must render as empty — it must never silently fall
 * back to unrelated hardcoded static content, because that would hide the
 * fact that the field is editable and currently blank.
 *
 * Static fallback text/data may only be used to bootstrap a section that
 * has no CMS row at all (`cms` is null/undefined) — e.g. on first render
 * before a migration has ever populated the row.
 */

/** String field: static fallback only applies when the whole CMS row is missing. */
export function cmsField(
  cms: Record<string, unknown> | null | undefined,
  key: string,
  fallback: string,
): string {
  if (cms == null) return fallback
  const value = cms[key]
  return typeof value === 'string' ? value : ''
}

/** Optional string field: no static fallback at all, just undefined when absent. */
export function cmsOptionalField(
  cms: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const value = cms?.[key]
  return typeof value === 'string' ? value : undefined
}

/** Array field: static fallback only applies when the whole CMS row is missing. */
export function cmsList<T>(
  cms: Record<string, unknown> | null | undefined,
  key: string,
  fallback: T[],
): T[] {
  if (cms == null) return fallback
  const value = cms[key]
  return Array.isArray(value) ? (value as T[]) : []
}
