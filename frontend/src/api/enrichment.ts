/**
 * Enrichment API
 * Handles contact enrichment calls
 */

import { getAuthToken } from './contacts';

const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

export interface QuickEnrichResponse {
  status: string;
  contact_id: string;
  enrichment_data: {
    summary?: string;
    persona_type?: string;
    vertical?: string;
    talking_points?: string[];
    company_overview?: string;
    recommended_approach?: string;
    inferred_title?: string;
    inferred_company_website?: string;
    inferred_location?: string;
  };
  message: string;
}

export interface EnrichmentStatus {
  contact_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  enriched_at?: string;
  last_checked: string;
}

/**
 * Quick enrich a single contact using Perplexity AI
 */
export async function quickEnrichContact(contactId: string): Promise<QuickEnrichResponse> {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_BASE}/api/v3/quick-enrich/${contactId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Enrichment failed: ${error}`);
  }
  
  return response.json();
}

/**
 * Get enrichment status for a contact
 */
export async function getEnrichmentStatus(contactId: string): Promise<EnrichmentStatus> {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_BASE}/api/v3/quick-enrich/${contactId}/status`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Status check failed: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Bulk enrich multiple contacts
 * (For future full enrichment feature)
 */
export async function bulkEnrichContacts(contactIds: string[]): Promise<{ queued: number; errors: string[] }> {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_BASE}/api/v3/enrich/bulk`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contact_ids: contactIds }),
  });

  if (!response.ok) {
    throw new Error(`Bulk enrichment failed: ${response.statusText}`);
  }
  
  return response.json();
}

