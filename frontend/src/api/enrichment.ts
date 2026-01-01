import { apiClient } from './client';

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

export async function enrichContact(contactId: string): Promise<EnrichmentResult> {
  return apiClient.post<EnrichmentResult>(`/api/v3/enrichment/quick-enrich/${contactId}`);
}

export async function enrichContacts(contactIds: string[]): Promise<{ results: EnrichmentResult[] }> {
  return apiClient.post<{ results: EnrichmentResult[] }>('/api/v3/enrichment/batch', {
    contact_ids: contactIds
  });
}

export async function getEnrichmentStatus(contactId: string): Promise<{ status: string; result?: any }> {
  return apiClient.get<{ status: string; result?: any }>(`/api/v3/enrichment/${contactId}/status`);
}
