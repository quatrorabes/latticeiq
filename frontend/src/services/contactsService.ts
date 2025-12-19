// frontend/src/services/contactsService.ts
import { supabase } from '../lib/supabaseClient';
import { Contact, ContactFormData } from '../types/contact';

const API_URL = import.meta.env.VITE_API_URL;

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

// Fetch all contacts
export async function getContacts(): Promise<Contact[]> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch contacts' }));
    throw new Error(error.detail || 'Failed to fetch contacts');
  }
  
  return response.json();
}

// Alias for backward compatibility
export const fetchContacts = getContacts;

// Get single contact
export async function getContact(id: number): Promise<Contact> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts/${id}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Contact not found' }));
    throw new Error(error.detail || 'Contact not found');
  }
  
  return response.json();
}

// Create contact
export async function createContact(data: ContactFormData): Promise<Contact> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to create contact' }));
    throw new Error(error.detail || 'Failed to create contact');
  }
  
  return response.json();
}

// Update contact
export async function updateContact(id: number, data: Partial<ContactFormData>): Promise<Contact> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to update contact' }));
    throw new Error(error.detail || 'Failed to update contact');
  }
  
  return response.json();
}

// Delete single contact
export async function deleteContact(id: number): Promise<void> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts/${id}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to delete contact' }));
    throw new Error(error.detail || 'Failed to delete contact');
  }
}

// Delete multiple contacts
export async function deleteContacts(ids: number[]): Promise<void> {
  const headers = await getAuthHeaders();
  
  // Delete each contact sequentially
  for (const id of ids) {
    const response = await fetch(`${API_URL}/api/contacts/${id}`, {
      method: 'DELETE',
      headers,
    });
    
    if (!response.ok) {
      console.error(`Failed to delete contact ${id}`);
    }
  }
}

// Export all functions
export {
  getContacts as default,
};
