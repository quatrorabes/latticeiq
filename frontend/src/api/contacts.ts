import { supabase } from '../supabaseClient';

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
  enrichment_data?: Record<string, any>;
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
