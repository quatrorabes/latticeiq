import { useEffect, useState } from 'react'
import { Contact } from '@typings/index'
import { apiCall } from '@services/api'
import { API_ENDPOINTS } from '@lib/constants'

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchContacts = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiCall<Contact[]>(API_ENDPOINTS.CONTACTS_LIST, {
        method: 'GET',
      })
      setContacts(data)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch contacts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [])

  const deleteContact = async (id: string) => {
    try {
      await apiCall<void>(API_ENDPOINTS.CONTACTS_DELETE(id), {
        method: 'DELETE',
      })
      setContacts(contacts.filter(c => c.id !== id))
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
      setContacts([...contacts, newContact])
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