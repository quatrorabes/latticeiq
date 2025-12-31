import { useEffect, useState, useCallback } from 'react'
import { Contact } from '@typings/index'
import { apiCall } from '@services/api'
import { API_ENDPOINTS } from '@lib/constants'

interface ContactsResponse {
  contacts?: Contact[]
  data?: Contact[]
  total?: number
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiCall<Contact[] | ContactsResponse>(API_ENDPOINTS.CONTACTS_LIST, {
        method: 'GET',
      })
      
      // Handle both array and object responses
      if (Array.isArray(response)) {
        setContacts(response)
      } else if (response && typeof response === 'object') {
        // Backend returns {contacts: [...]} or {data: [...]}
        const contactsArray = (response as ContactsResponse).contacts || (response as ContactsResponse).data || []
        setContacts(Array.isArray(contactsArray) ? contactsArray : [])
      } else {
        setContacts([])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch contacts')
      setContacts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  const deleteContact = async (id: string) => {
    try {
      await apiCall<void>(API_ENDPOINTS.CONTACTS_DELETE(id), {
        method: 'DELETE',
      })
      setContacts(prev => prev.filter(c => c.id !== id))
    } catch (err: any) {
      setError(err.message || 'Failed to delete contact')
      throw err
    }
  }

  const createContact = async (contact: Partial<Contact>) => {
    try {
      const newContact = await apiCall<Contact>(API_ENDPOINTS.CONTACTS_CREATE, {
        method: 'POST',
        body: contact,
      })
      setContacts(prev => [...prev, newContact])
      return newContact
    } catch (err: any) {
      setError(err.message || 'Failed to create contact')
      throw err
    }
  }

  return {
    contacts,
    loading,
    error,
    fetchContacts,
    deleteContact,
    createContact,
  }
}
