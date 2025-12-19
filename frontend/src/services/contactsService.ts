// Contacts API Service
import { supabase } from '../lib/supabase';
import type { Contact, ContactFormData } from '../types/contact';

const API_URL = import.meta.env.VITE_API_URL;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };
}

// Fetch all contacts
export async function fetchContacts(): Promise<Contact[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/contacts`, {
    method: 'GET',
    headers
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch contacts');
  }
  
  return response.json();
}

// Fetch single contact
export async function fetchContact(id: number): Promise<Contact> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/contacts/${id}`, {
    method: 'GET',
    headers
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch contact');
  }
  
  return response.json();
}

// Create contact
export async function createContact(data: ContactFormData): Promise<Contact> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
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
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update contact');
  }
  
  return response.json();
}

// Delete contact
export async function deleteContact(id: number): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/contacts/${id}`, {
    method: 'DELETE',
    headers
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete contact');
  }
}

// Delete multiple contacts
export async function deleteContacts(ids: number[]): Promise<void> {
  const headers = await getAuthHeaders();
  await Promise.all(ids.map(id => 
    fetch(`${API_URL}/api/contacts/${id}`, {
      method: 'DELETE',
      headers
    })
  ));
}
