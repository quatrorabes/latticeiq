
import { ScoreResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await (await import('../lib/supabaseClient')).supabase.auth.getSession();
  return session?.access_token || '';
}

export async function getScoringConfig(framework: 'mdcp' | 'bant' | 'spice'): Promise<any> {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/api/v3/scoring/config/${framework}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
  return response.json();
}

export async function calculateContactScore(contactId: string, contactData?: any): Promise<ScoreResponse> {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/api/v3/scoring/calculate-all/${contactId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: contactData ? JSON.stringify({ contact_data: contactData }) : '{}',
  });
  if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
  return response.json();
}

export async function saveScoringConfig(framework: 'mdcp' | 'bant' | 'spice', config: any): Promise<any> {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/api/v3/scoring/config/${framework}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
  return response.json();
}