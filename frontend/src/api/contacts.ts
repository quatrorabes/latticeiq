// frontend/src/api/contacts.ts
import { supabase } from '../supabaseClient';
import { Contact } from '../types';  // CHANGED: Import from types instead of redefining
export type { Contact };

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';


export interface ContactsResponse {
  contacts: Contact[];
  total: number;
  limit: number;
  offset: number;
}


export async function fetchContacts(limit = 10000, offset = 0): Promise<ContactsResponse> {
  const { data, error, count } = await supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);


  if (error) throw new Error(error.message);


  return {
    contacts: data || [],
    total: count || 0,
    limit,
    offset
  };
}


export async function fetchContact(id: string): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single();


  if (error) throw new Error(error.message);
  return data;
}


export async function createContact(contact: Partial<Contact>): Promise<Contact> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...contact, user_id: user?.id })
    .select()
    .single();


  if (error) throw new Error(error.message);
  return data;
}


export async function updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();


  if (error) throw new Error(error.message);
  return data;
}


export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);


  if (error) throw new Error(error.message);
}


export async function deleteContacts(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .in('id', ids);


  if (error) throw new Error(error.message);
}


// ============================================================
// NEW: Batch Scoring API Functions (calls FastAPI backend)
// ============================================================

/**
 * Helper to get auth token for API calls
 */
async function getAuthToken(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData?.session?.access_token || null;
}


/**
 * Score ALL contacts in the workspace
 * Calls POST /api/v3/scoring/score-all
 */
export async function scoreAllContacts(): Promise<{
  success: boolean;
  scored_count: number;
  failures?: Array<{ contact_id: string; error: string }>;
}> {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_URL}/api/v3/scoring/score-all`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Scoring failed: ${response.statusText}`);
  }

  return response.json();
}


/**
 * Score specific contacts by ID
 * Calls POST /api/v3/scoring/batch-score
 */
export async function batchScoreContacts(contactIds: string[]): Promise<Array<{
  contact_id: string;
  mdcp_score: number;
  mdcp_tier: string;
  bant_score: number;
  bant_tier: string;
  spice_score: number;
  spice_tier: string;
  overall_score: number;
  overall_tier: string;
}>> {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_URL}/api/v3/scoring/batch-score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ contact_ids: contactIds }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Batch scoring failed: ${response.statusText}`);
  }

  return response.json();
}


/**
 * Score a single contact
 * Calls POST /api/v3/scoring/calculate-all/{contact_id}
 */
export async function scoreContact(contactId: string): Promise<{
  contact_id: string;
  mdcp_score: number;
  mdcp_tier: string;
  bant_score: number;
  bant_tier: string;
  spice_score: number;
  spice_tier: string;
  overall_score: number;
  overall_tier: string;
}> {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_URL}/api/v3/scoring/calculate-all/${contactId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Scoring failed: ${response.statusText}`);
  }

  return response.json();
}
