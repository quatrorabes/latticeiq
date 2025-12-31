import { useState } from 'react'
import { Contact } from '@typings/index'
import { apiCall } from '@services/api'
import { API_ENDPOINTS } from '@lib/constants'

export function useEnrichment() {
  const [enriching, setEnriching] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const enrich = async (contactId: string) => {
    setEnriching(contactId)
    setError(null)
    try {
      const response = await apiCall<Contact>(
        API_ENDPOINTS.ENRICH(contactId),
        {
          method: 'POST',
          body: {},
        }
      )
      return response
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to enrich contact'
      setError(errorMsg)
      throw err
    } finally {
      setEnriching(null)
    }
  }

  const checkStatus = async (contactId: string) => {
    try {
      const response = await apiCall<{
        status: string
        progress?: number
      }>(API_ENDPOINTS.ENRICH_STATUS(contactId), {
        method: 'GET',
      })
      return response
    } catch (err: any) {
      console.error('Status check error:', err)
      return null
    }
  }

  return {
    enrich,
    enriching,
    error,
    checkStatus,
  }
}