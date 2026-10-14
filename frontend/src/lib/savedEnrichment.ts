/** Normalize stored snapshots without inventing a missing Quick or Deep result. */
export type EnrichmentMode = 'quick' | 'deep'
export interface SavedSnapshot {
  mode?: EnrichmentMode
  data?: Record<string, any>
  legacy?: Record<string, any> | null
  enriched_at?: string | null
  [key: string]: any
}
export interface SavedEnrichments {
  quick: SavedSnapshot | null
  deep: SavedSnapshot | null
}

export function normalizeSavedEnrichments(value: any): SavedEnrichments {
  const result: SavedEnrichments = { quick: null, deep: null }
  if (!value || typeof value !== 'object') return result
  for (const mode of ['quick', 'deep'] as const) {
    const snapshot = value.saved_results?.[mode]
    if (snapshot && typeof snapshot === 'object') result[mode] = snapshot
  }
  const data = value.data || value
  const candidate = value.mode || data.meta?.source
  const mode: EnrichmentMode | null = candidate === 'quick' || candidate === 'deep'
    ? candidate : data.summary || data.talking_points || data.openingline ? 'quick' : null
  if (mode && !result[mode]) result[mode] = value
  return result
}

export function snapshotTimestamp(snapshot: SavedSnapshot | null): string | null {
  const data = snapshot?.data || snapshot
  const timestamp = snapshot?.enriched_at || data?.meta?.generated_at
    || snapshot?.legacy?.generatedat || data?.generated_at || null
  // The existing backend produced naive UTC ISO timestamps. Avoid treating
  // these legacy values as the browser's local timezone.
  return timestamp && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timestamp)
    && !/(Z|[+-]\d{2}:\d{2})$/.test(timestamp) ? `${timestamp}Z` : timestamp
}
