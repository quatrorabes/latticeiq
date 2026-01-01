import { apiClient } from './client';

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  title?: string;
  phone?: string;
  linkedin_url?: string;
  website?: string;
  mdcp_score?: number;
  mdcp_tier?: string;
  bant_score?: number;
  bant_tier?: string;
  spice_score?: number;
  spice_tier?: string;
  overall_score?: number;
  overall_tier?: string;
  enrichment_status?: string;
  enrichment_data?: any;
  pipeline_stage?: string;
  deal_value?: number;
  created_at: string;
  updated_at?: string;
}

export interface ContactsResponse {
  contacts: Contact[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchContacts(limit = 100, offset = 0): Promise<ContactsResponse> {
  try {
    return await apiClient.get<ContactsResponse>(`/api/v3/contacts?limit=${limit}&offset=${offset}`);
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    throw error;
  }
}

export async function fetchContact(id: string): Promise<Contact> {
  return apiClient.get<Contact>(`/api/v3/contacts/${id}`);
}

export async function createContact(contact: Partial<Contact>): Promise<Contact> {
  return apiClient.post<Contact>('/api/v3/contacts', contact);
}

export async function updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
  return apiClient.put<Contact>(`/api/v3/contacts/${id}`, updates);
}

export async function deleteContact(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/v3/contacts/${id}`);
}

export async function deleteContacts(ids: string[]): Promise<void> {
  return apiClient.post<void>('/api/v3/contacts/bulk-delete', { contact_ids: ids });
}
