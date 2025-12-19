// frontend/src/services/contactsService.ts
/**
 * LatticeIQ Contacts Service
 * Handles all contact CRUD and enrichment API calls
 */

import { createClient } from "@supabase/supabase-js";

const API_URL = import.meta.env.VITE_API_URL || "https://latticeiq-backend.onrender.com";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================================
// TYPES
// ============================================================================

export interface Contact {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
  website?: string | null;
  vertical?: string | null;
  persona_type?: string | null;
  enrichment_status: string;
  enrichment_data?: Record<string, unknown> | null;
  enriched_at?: string | null;
  apex_score?: number | null;
  mdc_score?: number | null;
  rss_score?: number | null;
  bant_budget_confirmed?: boolean | null;
  bant_authority_level?: string | null;
  bant_need?: string | null;
  bant_timeline?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactCreateRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedin_url?: string;
  website?: string;
  vertical?: string;
  persona_type?: string;
}

export interface ContactUpdateRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedin_url?: string;
  website?: string;
  vertical?: string;
  persona_type?: string;
}

export interface EnrichmentStatus {
  contact_id: string;
  enrichment_status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  current_stage?: string;
  error_message?: string;
  enriched_at?: string;
  estimated_completion_at?: string;
}

export interface EnrichmentProfile {
  contact_id: string;
  enrichment_status: string;
  profile_data?: {
    summary?: string;
    hooks?: string[];
    talking_points?: string[];
    objections?: Array<{ objection: string; response: string }>;
    bant?: {
      budget?: string;
      authority?: string;
      need?: string;
      timeline?: string;
    };
  };
  raw_data?: Record<string, unknown>;
  apex_score?: number;
  created_at: string;
}

// ============================================================================
// AUTH HELPER
// ============================================================================

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  
  return {
    "Authorization": `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

// ============================================================================
// CONTACTS CRUD
// ============================================================================

export async function getContacts(): Promise<Contact[]> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts`, {
    method: "GET",
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch contacts: ${response.status}`);
  }
  
  const data = await response.json();
  return data.contacts || [];
}

export async function getContact(contactId: string): Promise<Contact> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts/${contactId}`, {
    method: "GET",
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch contact: ${response.status}`);
  }
  
  return response.json();
}

export async function createContact(contact: ContactCreateRequest): Promise<Contact> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts`, {
    method: "POST",
    headers,
    body: JSON.stringify(contact),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create contact: ${response.status}`);
  }
  
  return response.json();
}

export async function updateContact(
  contactId: string,
  updates: ContactUpdateRequest
): Promise<Contact> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts/${contactId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update contact: ${response.status}`);
  }
  
  return response.json();
}

export async function deleteContact(contactId: string): Promise<void> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/contacts/${contactId}`, {
    method: "DELETE",
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete contact: ${response.status}`);
  }
}

// ============================================================================
// ENRICHMENT V3 API
// ============================================================================

/**
 * Trigger enrichment for a single contact
 * Returns immediately - enrichment runs in background
 */
export async function enrichContact(contactId: string): Promise<{ status: string; message: string }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/v3/enrichment/enrich`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      contact_id: contactId,
      synthesize: true,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Enrichment failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Poll enrichment status for a contact
 */
export async function getEnrichmentStatus(contactId: string): Promise<EnrichmentStatus> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(
    `${API_URL}/api/v3/enrichment/enrich/${contactId}/status`,
    {
      method: "GET",
      headers,
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch enrichment status: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Get enrichment profile (synthesized data) for a contact
 */
export async function getEnrichmentProfile(contactId: string): Promise<EnrichmentProfile> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(
    `${API_URL}/api/v3/enrichment/enrich/${contactId}/profile`,
    {
      method: "GET",
      headers,
    }
  );
  
  if (!response.ok) {
    if (response.status === 202) {
      throw new Error("Enrichment not yet completed");
    }
    throw new Error(`Failed to fetch enrichment profile: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Subscribe to enrichment progress via SSE (Server-Sent Events)
 * Returns an EventSource that emits progress updates
 */
export function subscribeToEnrichmentProgress(
  contactId: string,
  onProgress: (event: { progress: number; stage: string; message?: string }) => void,
  onComplete: (data: Record<string, unknown>) => void,
  onError: (error: string) => void
): EventSource {
  const eventSource = new EventSource(
    `${API_URL}/api/v3/enrichment/enrich/${contactId}/stream`
  );
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.event === "progress") {
        onProgress({
          progress: data.progress || 0,
          stage: data.stage || "processing",
          message: data.message,
        });
      } else if (data.event === "completed") {
        onComplete(data.data || {});
        eventSource.close();
      } else if (data.event === "error" || data.error) {
        onError(data.message || data.error || "Enrichment failed");
        eventSource.close();
      }
    } catch (e) {
      console.error("Failed to parse SSE event:", e);
    }
  };
  
  eventSource.onerror = () => {
    onError("Connection to enrichment stream lost");
    eventSource.close();
  };
  
  return eventSource;
}

/**
 * Batch enrich multiple contacts
 */
export async function batchEnrichContacts(
  contactIds: string[],
  limit: number = 10
): Promise<{ queued_count: number; skipped_count: number; error_count: number }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/v3/enrichment/batch`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      contact_ids: contactIds,
      limit,
      synthesize: true,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Batch enrichment failed: ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// POLLING HELPER
// ============================================================================

/**
 * Poll enrichment status until completion or failure
 * Returns the final enrichment profile when done
 */
export async function pollEnrichmentUntilComplete(
  contactId: string,
  onProgress?: (status: EnrichmentStatus) => void,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<EnrichmentProfile> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const status = await getEnrichmentStatus(contactId);
    
    if (onProgress) {
      onProgress(status);
    }
    
    if (status.enrichment_status === "completed") {
      return getEnrichmentProfile(contactId);
    }
    
    if (status.enrichment_status === "failed") {
      throw new Error(status.error_message || "Enrichment failed");
    }
    
    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;
  }
  
  throw new Error("Enrichment timed out");
}

// ============================================================================
// EXPORT DEFAULT SERVICE OBJECT
// ============================================================================

const contactsService = {
  getContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  enrichContact,
  getEnrichmentStatus,
  getEnrichmentProfile,
  subscribeToEnrichmentProgress,
  batchEnrichContacts,
  pollEnrichmentUntilComplete,
};

export default contactsService;
