import { supabase } from '../lib/supabase'
import type { Contact, ContactFormData } from '../types/contact'

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com'

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  }
}

export async function fetchContacts(): Promise<Contact[]> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/contacts`, {
    method: 'GET',
    headers
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to fetch contacts: ${response.status}`)
  }
  
  const data = await response.json()
  
  // Handle different response formats from backend
  if (Array.isArray(data)) {
    return data
  } else if (data?.contacts && Array.isArray(data.contacts)) {
    return data.contacts
  } else if (data?.data && Array.isArray(data.data)) {
    return data.data
  }
  
  console.warn('Unexpected contacts response format:', data)
  return []
}

export async function fetchContact(id: number): Promise<Contact> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/contacts/${id}`, {
    method: 'GET',
    headers
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to fetch contact')
  }
  
  return response.json()
}

export async function createContact(data: ContactFormData): Promise<Contact> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to create contact')
  }
  
  return response.json()
}

export async function updateContact(id: number, data: Partial<ContactFormData>): Promise<Contact> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/contacts/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to update contact')
  }
  
  return response.json()
}

export async function deleteContact(id: number): Promise<void> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/contacts/${id}`, {
    method: 'DELETE',
    headers
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to delete contact')
  }
}

export async function deleteContacts(ids: number[]): Promise<void> {
  const headers = await getAuthHeaders()
  await Promise.all(ids.map(id => 
    fetch(`${API_URL}/api/contacts/${id}`, {
      method: 'DELETE',
      headers
    })
  ))
}
