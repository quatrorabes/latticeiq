import { apiClient } from './client';
import { supabase } from '../supabaseClient';

export interface EnrichmentResult {
  contact_id: string;
  status: string;
  result: {
    summary?: string;
    opening_line?: string;
    persona_type?: string;
    vertical?: string;
    talking_points?: string[];
    [key: string]: any;
  };
  scores?: {
    mdcp_score: number;
    mdcp_tier: string;
    bant_score: number;
    bant_tier: string;
    spice_score: number;
    spice_tier: string;
    overall_score: number;
    overall_tier: string;
  };
  raw_text?: string;
  model: string;
}

// Try backend first, fallback to marking as pending
export async function enrichContact(contactId: string): Promise<EnrichmentResult> {
  try {
    return await apiClient.post<EnrichmentResult>(`/api/v3/enrichment/quick-enrich/${contactId}`);
  } catch (error) {
    console.warn('Backend enrichment failed, marking as pending:', error);
    
    // Update contact to pending in Supabase
    await supabase
      .from('contacts')
      .update({ enrichment_status: 'pending' })
      .eq('id', contactId);
    
    throw new Error('Enrichment service temporarily unavailable. Contact marked as pending.');
  }
}

export async function enrichContacts(contactIds: string[]): Promise<{ results: EnrichmentResult[] }> {
  try {
    return await apiClient.post<{ results: EnrichmentResult[] }>('/api/v3/enrichment/batch', {
      contact_ids: contactIds
    });
  } catch (error) {
    console.warn('Backend batch enrichment failed:', error);
    
    // Mark all as pending
    await supabase
      .from('contacts')
      .update({ enrichment_status: 'pending' })
      .in('id', contactIds);
    
    throw new Error('Enrichment service temporarily unavailable.');
  }
}

export async function getEnrichmentStatus(contactId: string): Promise<{ status: string; result?: any }> {
  const { data } = await supabase
    .from('contacts')
    .select('enrichment_status, enrichment_data')
    .eq('id', contactId)
    .single();

  return {
    status: data?.enrichment_status || 'pending',
    result: data?.enrichment_data
  };
}
