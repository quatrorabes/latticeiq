import { useState, useEffect, useCallback } from 'react'
import type { Contact } from '../types/contact'
import { fetchContacts, deleteContact, deleteContacts } from '../services/contactsService'

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])  // Ensure empty array default
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadContacts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchContacts()
      // Ensure we always set an array
      setContacts(Array.isArray(data) ? data : data?.contacts || data?.data || [])
    } catch (err) {
      console.error('Load contacts error:', err)
      setError(err instanceof Error ? err : new Error('Failed to load contacts'))
      setContacts([])  // Reset to empty array on error
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadContacts()
  }, [loadContacts])

  const removeContact = useCallback(async (id: number) => {
    try {
      await deleteContact(id)
      setContacts(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      throw err
    }
  }, [])

  const removeContacts = useCallback(async (ids: number[]) => {
    try {
      await deleteContacts(ids)
      setContacts(prev => prev.filter(c => !ids.includes(c.id)))
    } catch (err) {
      throw err
    }
  }, [])

  const refetch = useCallback(() => {
    loadContacts()
  }, [loadContacts])

  return {
    contacts,
    isLoading,
    error,
    refetch,
    removeContact,
    removeContacts
  }
}
