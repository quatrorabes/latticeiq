import { useState } from 'react'
import { apiCall } from '@services/api'

export function useEnrichment() {
  const [enriching, setEnriching] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const enrich = async (contactId: string) => {
    setEnriching(contactId)
    setError(null)
    try {
      const result = await apiCall<any>('/api/v3/enrichment/enrich', {
        method: 'POST',
        body: { contact_id: contactId },
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
    enrich,
    enriching,  // string | null (the contact ID being enriched)
    error,
    getEnrichmentStatus,
  }
}
