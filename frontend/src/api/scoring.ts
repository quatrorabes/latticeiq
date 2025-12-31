// ============================================================================
// FILE: frontend/src/api/scoring.ts
// API client for scoring operations
// ============================================================================

import { ScoreResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await (await import('../lib/supabaseClient')).supabase.auth.getSession();
  return session?.access_token || '';
}

export async function getScoringConfig(framework: 'mdcp' | 'bant' | 'spice'): Promise<any> {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/api/v3/scoring/config/${framework}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch scoring config: ${response.statusText}`);
  }

  return response.json();
}

export async function calculateContactScore(contactId: string, contactData?: any): Promise<ScoreResponse> {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/api/v3/scoring/calculate-all/${contactId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: contactData ? JSON.stringify({ contact_data: contactData }) : '{}',
  });

  if (!response.ok) {
    throw new Error(`Failed to calculate score: ${response.statusText}`);
  }

  return response.json();
}

export async function saveScoringConfig(framework: 'mdcp' | 'bant' | 'spice', config: any): Promise<any> {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/api/v3/scoring/config/${framework}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Failed to save scoring config: ${response.statusText}`);
  }

  return response.json();
}
