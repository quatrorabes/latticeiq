
import { Contact } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

export async function getAuthToken(): Promise<string> {
  const { data: { session } } = await (await import('../lib/supabaseClient')).supabase.auth.getSession();
  return session?.access_token || '';
}

export async function fetchContacts(limit = 100, offset = 0): Promise<{ contacts: Contact[]; total: number }> {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/api/v3/contacts?limit=${limit}&offset=${offset}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
  return response.json();
}

export async function createContact(contact: Partial<Contact>): Promise<Contact> {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/api/v3/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contact),
  });

  if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
  return response.json();
}

export async function updateContact(contactId: string, updates: Partial<Contact>): Promise<Contact> {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/api/v3/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
  return response.json();
}

export async function deleteContact(contactId: string): Promise<boolean> {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/api/v3/contacts/${contactId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
  return true;
}