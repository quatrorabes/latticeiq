// Enrichment V3 API Service
import { supabase } from '../lib/supabase';

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

export interface EnrichmentResponse {
  enrichment_id: string;
  contact_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
}

export interface EnrichmentStatus {
  enrichment_id: string;
  contact_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  domains_completed: string[];
  domains_pending: string[];
  error?: string;
}

export interface EnrichmentProfile {
  contact_id: number;
  profile: {
    executive_summary: string;
    role_responsibilities: string;
    company_intelligence: string;
    deal_triggers: string[];
    objection_handlers: string[];
    connection_angles: string[];
    raw_domains: {
      company: any;
      person: any;
      industry: any;
      news: any;
      open_ended: any;
    };
  };
  scores: {
    apex_score: number;
    mdcp_score: number;
    rss_score: number;
    bant_score: number;
    spice_score: number;
  };
  enriched_at: string;
}

// Trigger enrichment for a single contact
export async function enrichContact(contactId: number): Promise<EnrichmentResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/v3/enrichment/enrich`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contact_id: contactId })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to start enrichment');
  }
  
  return response.json();
}

// Trigger batch enrichment
export async function enrichContactsBatch(contactIds: number[]): Promise<EnrichmentResponse[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/v3/enrichment/enrich/batch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contact_ids: contactIds })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to start batch enrichment');
  }
  
  return response.json();
}

// Poll enrichment status
export async function getEnrichmentStatus(contactId: number): Promise<EnrichmentStatus> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/v3/enrichment/enrich/${contactId}/status`, {
    method: 'GET',
    headers
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get enrichment status');
  }
  
  return response.json();
}

// Get enriched profile
export async function getEnrichmentProfile(contactId: number): Promise<EnrichmentProfile> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/v3/enrichment/enrich/${contactId}/profile`, {
    method: 'GET',
    headers
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get enrichment profile');
  }
  
  return response.json();
}
