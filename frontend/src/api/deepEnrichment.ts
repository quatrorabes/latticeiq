// frontend/src/api/deepEnrichment.ts
import { ScoreResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface DeepEnrichRequest {
  contact_name: string;
  company_name: string;
  title: string;
  email?: string;
  linkedin_url?: string;
}

interface DeepEnrichResponse {
  success: boolean;
  job_id: string | null;
  status: string;
  contact_id: string;
  profile?: {
    raw: string;
    polished: string;
    generated_at: string;
  };
  scores?: ScoreResponse;
  error?: string;
}

interface DeepProfileResponse {
  success: boolean;
  contact_id: string;
  name: string;
  company: string;
  title: string;
  profile: string | null;
  last_enriched: string | null;
}

export async function deepEnrichContact(
  contactId: string,
  data: DeepEnrichRequest,
  workspaceId: string
): Promise<DeepEnrichResponse> {
  const response = await fetch(
    `${API_URL}/api/v3/enrichment/deep-enrich/${contactId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-workspace-id': workspaceId,
      },
      body: JSON.stringify(data),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Deep enrichment failed');
  }
  
  return response.json();
}

export async function getDeepProfile(
  contactId: string,
  workspaceId: string
): Promise<DeepProfileResponse> {
  const response = await fetch(
    `${API_URL}/api/v3/enrichment/deep-profile/${contactId}`,
    {
      headers: {
        'x-workspace-id': workspaceId,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch profile');
  }
  
  return response.json();
}

export async function getEnrichmentStatus(
  contactId: string,
  workspaceId: string
) {
  const response = await fetch(
    `${API_URL}/api/v3/enrichment/deep-enrich/${contactId}/status`,
    {
      headers: {
        'x-workspace-id': workspaceId,
      },
    }
  );
  
  return response.json();
}
