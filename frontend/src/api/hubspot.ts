// frontend/src/api/hubspot.ts
// NEW FILE

import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL;

export interface HubSpotImportRequest {
  filters: {
    lead_status_exclude: string[];
    lifecycle_status_exclude: string[];
  };
  properties_to_import: string[];
  auto_enrich: boolean;
}

export interface HubSpotImportResponse {
  total_contacts: number;
  imported: number;
  enrichment_queued: number;
  duplicates_skipped: number;
  errors: Record<string, string>;
}

export interface HubSpotIntegrationStatus {
  id: string;
  provider: string;
  is_connected: boolean;
  connected_email?: string;
  connected_at?: string;
}

/**
 * Get HubSpot integration status
 */
export async function getHubSpotStatus(): Promise<HubSpotIntegrationStatus | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${API_URL}/api/v3/hubspot/integration-status`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) return null;
  return response.json();
}

/**
 * Initiate HubSpot OAuth flow
 */
export async function initiateHubSpotAuth(): Promise<{ authorization_url: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${API_URL}/api/v3/hubspot/auth/authorize`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) throw new Error('Failed to initiate auth');
  return response.json();
}

/**
 * Disconnect HubSpot integration
 */
export async function disconnectHubSpot(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${API_URL}/api/v3/hubspot/disconnect`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) throw new Error('Failed to disconnect');
}

/**
 * Import contacts from HubSpot with filters and auto-enrich
 */
export async function importFromHubSpot(
  request: HubSpotImportRequest
): Promise<HubSpotImportResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${API_URL}/api/v3/hubspot/import`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Import failed');
  }

  return response.json();
}

/**
 * Handle OAuth callback (called from settings page after redirect)
 */
export async function handleHubSpotCallback(code: string, state: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${API_URL}/api/v3/hubspot/auth/callback`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, state }),
    }
  );

  if (!response.ok) throw new Error('Callback failed');
}
