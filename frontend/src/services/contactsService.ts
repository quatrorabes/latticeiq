// frontend/src/services/contactsService.ts
import { supabase } from '../lib/supabaseClient';
import type { Contact, ContactFormData } from '../types/contact';

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

export const fetchContacts = getContacts;

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

export async function deleteContacts(ids: number[]): Promise<void> {
  const headers = await getAuthHeaders();
  
  for (const id of ids) {
    await fetch(`${API_URL}/api/contacts/${id}`, {
      method: 'DELETE',
      headers,
    });
  }
}
