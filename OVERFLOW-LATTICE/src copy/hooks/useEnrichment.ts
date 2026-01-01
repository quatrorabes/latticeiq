import { useState } from 'react'
import { apiCall } from '@services/api'

export function useEnrichment() {
  const [enriching, setEnriching] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Quick enrich - fast, uses Perplexity only
  const enrich = async (contactId: string) => {
    setEnriching(contactId)
    setError(null)
    try {
      // Correct endpoint: /api/v3/enrichment/quick-enrich/{contact_id}
      const result = await apiCall<any>(`/api/v3/enrichment/quick-enrich/${contactId}`, {
        method: 'POST',
      })
      return result
    } catch (err: any) {
      setError(err.message || 'Failed to enrich contact')
      throw err
    } finally {
      setEnriching(null)
    }
  }

  // Full enrich - deeper analysis (future)
  const fullEnrich = async (contactId: string) => {
    setEnriching(contactId)
    setError(null)
    try {
      const result = await apiCall<any>(`/api/v3/enrich/${contactId}`, {
        method: 'POST',
      })
      return result
    } catch (err: any) {
      setError(err.message || 'Failed to enrich contact')
      throw err
    } finally {
      setEnriching(null)
    }
  }

  const getEnrichmentStatus = async (contactId: string) => {
    try {
      const result = await apiCall<any>(`/api/v3/enrichment/${contactId}/status`, {
        method: 'GET',
      })
      return result
    } catch (err: any) {
      setError(err.message || 'Failed to get enrichment status')
      throw err
    }
  }

  return {
    enrich,        // Quick enrich (default, button click)
    fullEnrich,    // Full enrich (future premium feature)
    enriching,
    error,
    getEnrichmentStatus,
  }
}
