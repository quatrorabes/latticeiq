/**
 * Cadence API Client
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

import { supabase } from '../lib/supabaseClient';

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
  };
}

export interface CadenceType {
  name: string;
  description: string;
  total_touches: number;
  duration_days: number;
}

export interface Touch {
  id: string;
  cadence_id: string;
  touch_number: number;
  touch_type: 'email' | 'call' | 'linkedin';
  variant_number: number;
  scheduled_for: string;
  executed_at: string | null;
  status: 'pending' | 'completed' | 'skipped' | 'cancelled';
  response_received: boolean;
  notes: string | null;
}

export interface Cadence {
  id: string;
  type: string;
  name: string;
  status: string;
  started_at: string;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  next_touch: Touch | null;
  touches: Touch[];
}

export interface Activity {
  id: string;
  contact_id: string;
  activity_type: string;
  channel: string;
  variant_used: number | null;
  status: string;
  message: string;
  metadata: Record<string, any>;
  created_at: string;
}

// Get available cadence types
export async function getCadenceTypes(): Promise<Record<string, CadenceType>> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/v3/cadences/types`, { headers });
  if (!res.ok) throw new Error('Failed to fetch cadence types');
  const data = await res.json();
  return data.cadences;
}

// Start a cadence for a contact
export async function startCadence(
  contactId: string, 
  cadenceType: string = 'standard'
): Promise<{ cadence_id: string; touches_scheduled: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/v3/cadences/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contact_id: contactId,
      cadence_type: cadenceType
    })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to start cadence');
  }
  return res.json();
}

// Get cadence for a contact
export async function getContactCadence(contactId: string): Promise<{ active: boolean; cadence: Cadence | null }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/v3/cadences/${contactId}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch cadence');
  return res.json();
}

// Stop a cadence
export async function stopCadence(contactId: string, reason: string = 'manual'): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/v3/cadences/${contactId}/stop?reason=${reason}`, {
    method: 'POST',
    headers
  });
  if (!res.ok) throw new Error('Failed to stop cadence');
}

// Pause a cadence
export async function pauseCadence(contactId: string, reason: string = ''): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/v3/cadences/${contactId}/pause?reason=${reason}`, {
    method: 'POST',
    headers
  });
  if (!res.ok) throw new Error('Failed to pause cadence');
}

// Resume a cadence
export async function resumeCadence(contactId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/v3/cadences/${contactId}/resume`, {
    method: 'POST',
    headers
  });
  if (!res.ok) throw new Error('Failed to resume cadence');
}

// Complete a touch
export async function completeTouch(
  touchId: string, 
  notes: string = '', 
  responseReceived: boolean = false
): Promise<{ status: string; next_touch: Touch | null }> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_URL}/api/v3/cadences/touches/${touchId}/complete?notes=${encodeURIComponent(notes)}&response_received=${responseReceived}`, 
    {
      method: 'POST',
      headers
    }
  );
  if (!res.ok) throw new Error('Failed to complete touch');
  return res.json();
}

// Get today's touches
export async function getTodaysTouches(): Promise<{ total: number; touches: any[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/v3/cadences/pending/today`, { headers });
  if (!res.ok) throw new Error('Failed to fetch today\'s touches');
  return res.json();
}

// Get activity history
export async function getActivities(contactId: string, limit: number = 50): Promise<Activity[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/v3/cadences/activities/${contactId}?limit=${limit}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch activities');
  const data = await res.json();
  return data.activities;
}

// Get cadence stats
export async function getCadenceStats(): Promise<{
  active_cadences: number;
  completed_cadences: number;
  pending_touches: number;
  touches_today: number;
  response_rate: number;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/v3/cadences/stats`, { headers });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}
