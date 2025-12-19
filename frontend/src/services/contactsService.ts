// frontend/src/services/contactsService.ts
import { supabase } from '../lib/supabaseClient';
import type { Contact, ContactFormData } from '../types/contact';

const API_URL = import.meta.env.VITE_API_URL;

export interface EnrichmentResult {
  success: boolean;
  contact_id: number;
  status: string;
  txt_file: string;
  enrichment_data: Record<string, unknown>;
}

export interface EnrichmentStatus {
  contact_id: number;
  status: string;
  enriched_at?: string;
  apex_score?: number;
  has_txt_file: boolean;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };
}

// ========== CONTACT CRUD (Named Exports) ==========

export async function getContacts(): Promise<Contact[]> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts`, {
    method: 'GET',
    headers
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch contacts');
  }
  
  return response.json();
}

export async function getContact(id: number): Promise<Contact> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts/${id}`, {
    method: 'GET',
    headers
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch contact');
  }
  
  return response.json();
}

export async function createContact(data: ContactFormData): Promise<Contact> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error('Failed to create contact');
  }
  
  return response.json();
}

export async function deleteContact(id: number): Promise<void> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts/${id}`, {
    method: 'DELETE',
    headers
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete contact');
  }
}

export async function deleteContacts(ids: number[]): Promise<void> {
  const headers = await getAuthHeaders();
  
  // Delete contacts one by one (or implement batch endpoint)
  await Promise.all(ids.map(id => 
    fetch(`${API_URL}/api/contacts/${id}`, {
      method: 'DELETE',
      headers
    })
  ));
}

// ========== ENRICHMENT ==========

export async function enrichContact(contactId: number, synthesize: boolean = true): Promise<EnrichmentResult> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/v3/enrichment/enrich`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contact_id: contactId,
      synthesize
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to enrich contact');
  }
  
  return response.json();
}

export async function getEnrichmentStatus(contactId: number): Promise<EnrichmentStatus> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/v3/enrichment/enrich/${contactId}/status`, {
    method: 'GET',
    headers
  });
  
  if (!response.ok) {
    throw new Error('Failed to get enrichment status');
  }
  
  return response.json();
}

export async function downloadEnrichmentTxt(contactId: number): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  
  const downloadUrl = `${API_URL}/api/v3/enrichment/enrich/${contactId}/download`;
  
  const response = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to download enrichment file');
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `enrichment_${contactId}.txt`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function enrichBatch(contactIds?: number[], limit: number = 10): Promise<{
  success: boolean;
  enriched: number;
  total: number;
  txt_files: string[];
}> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/v3/enrichment/enrich/batch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contact_ids: contactIds || [],
      limit
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to batch enrich contacts');
  }
  
  return response.json();
}

// ========== SERVICE OBJECT (Default Export) ==========

export const contactsService = {
  getContacts,
  getContact,
  createContact,
  deleteContact,
  deleteContacts,
  enrichContact,
  getEnrichmentStatus,
  downloadEnrichmentTxt,
  enrichBatch
};

export default contactsService;
