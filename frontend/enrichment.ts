// frontend/src/api/enrichment.ts

import { supabase } from '../lib/supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Trigger quick enrichment for a contact
 */
export async function enrichContact(contactId: string): Promise<{ status: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v3/enrichment/quick-enrich/${contactId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Enrichment failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Trigger deep enrichment for a contact
 * Returns status: pending, processing, or completed
 */
export async function deepEnrichContact(
  contactId: string,
  token?: string
): Promise<{ status: string; error?: string }> {
  let authToken = token;

  if (!authToken) {
    const { data: { session } } = await supabase.auth.getSession();
    authToken = session?.access_token;
  }

  if (!authToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v3/enrichment/deep-enrich/${contactId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Deep enrichment failed: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Get enrichment result for a contact
 * Returns the full UnifiedEnrichmentResult schema
 */
export async function getEnrichmentResult(
  contactId: string,
  token?: string
): Promise<any> {
  let authToken = token;

  if (!authToken) {
    const { data: { session } } = await supabase.auth.getSession();
    authToken = session?.access_token;
  }

  if (!authToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v3/enrichment/deep-enrich/${contactId}/result`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to fetch enrichment result: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Get enrichment status for a contact
 */
export async function getEnrichmentStatus(
  contactId: string,
  token?: string
): Promise<{ status: string; progress?: number }> {
  let authToken = token;

  if (!authToken) {
    const { data: { session } } = await supabase.auth.getSession();
    authToken = session?.access_token;
  }

  if (!authToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v3/enrichment/deep-enrich/${contactId}/status`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch status: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Poll for enrichment completion
 * Checks status every 2 seconds up to maxAttempts (default 30 = 60 seconds)
 */
export async function pollEnrichmentComplete(
  contactId: string,
  token?: string,
  maxAttempts: number = 30
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await getEnrichmentStatus(contactId, token);
      if (status.status === 'completed') {
        return true;
      }
      if (status.status === 'failed') {
        return false;
      }
    } catch (err) {
      console.error('Error checking status:', err);
    }

    // Wait 2 seconds before next check
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return false;
}

/**
 * Helper: Wait for enrichment result with improved polling
 * Used by ContactDetailModal to track deep enrichment progress
 * Polls every 2 seconds for up to 60 seconds
 */
export async function waitForEnrichmentResult(
  contactId: string,
  token?: string,
  timeoutSeconds: number = 60
): Promise<any> {
  const startTime = Date.now();
  const timeoutMs = timeoutSeconds * 1000;
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await getEnrichmentResult(contactId, token);
      if (result && result.contact_profile) {
        return result; // Successfully got complete enrichment data
      }
    } catch (err) {
      lastError = err as Error;
      console.log('Waiting for enrichment result...');
    }

    // Wait 2 seconds before retry
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (lastError) {
    throw new Error(`Enrichment timeout after ${timeoutSeconds}s: ${lastError.message}`);
  }
  throw new Error(`Enrichment timeout after ${timeoutSeconds}s`);
}
