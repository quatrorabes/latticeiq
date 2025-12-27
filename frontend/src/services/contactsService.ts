// src/services/contactService.ts
// Complete API wrapper for contacts, scoring, and enrichment

import { supabase } from '@/lib/supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ============================================================================
// TYPES
// ============================================================================

export interface Contact {
  id: string;
  userid: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  mobile?: string;
  company?: string;
  title?: string;
  vertical?: string;
  linkedinurl?: string;
  
  // Enrichment
  enrichmentstatus: 'pending' | 'enriching' | 'completed' | 'failed';
  enrichmentdata?: {
    perplexity?: {
      company_research?: string;
      person_research?: string;
      industry_trends?: string;
      news?: string;
      open_ended?: string;
    };
    gpt4?: {
      executive_summary?: string;
      role_responsibilities?: string;
      company_intelligence?: string;
      deal_triggers?: string;
      objection_handlers?: string;
      connection_angles?: string;
    };
  };
  enrichedat?: string;
  
  // Scoring
  mdcpscore?: number;
  bantscore?: number;
  spicescore?: number;
  apexscore?: number;
  matchtier?: 'hot' | 'warm' | 'cold';
  icpmatch?: number;
  
  created_at: string;
  updated_at: string;
}

export interface ContactListResponse {
  contacts: Contact[];
  total: number;
  limit: number;
  offset: number;
}

export interface EnrichmentStatus {
  contact_id: string;
  status: 'pending' | 'enriching' | 'completed' | 'failed';
  progress?: {
    current_stage: string;
    total_stages: number;
  };
  error?: string;
}

export interface ScoringResult {
  contact_id: string;
  mdcp: {
    score: number;
    tier: 'hot' | 'warm' | 'cold';
    breakdown: {
      money: number;
      decision_maker: number;
      champion: number;
      process: number;
    };
  };
  bant: {
    score: number;
    tier: 'hot' | 'warm' | 'cold';
    breakdown: {
      budget: number;
      authority: number;
      need: number;
      timeline: number;
    };
  };
  spice: {
    score: number;
    tier: 'hot' | 'warm' | 'cold';
    breakdown: {
      situation: number;
      problem: number;
      implication: number;
      critical_event: number;
      decision: number;
    };
  };
  unified: {
    score: number;
    tier: 'hot' | 'warm' | 'cold';
  };
}

// ============================================================================
// CONTACTS CRUD
// ============================================================================

export async function getContacts(
  limit = 50,
  offset = 0,
  filters?: {
    search?: string;
    vertical?: string;
    enrichment_status?: string;
    score_min?: number;
    score_max?: number;
  }
): Promise<ContactListResponse> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (filters?.search) params.append('search', filters.search);
    if (filters?.vertical) params.append('vertical', filters.vertical);
    if (filters?.enrichment_status) params.append('enrichment_status', filters.enrichment_status);
    if (filters?.score_min) params.append('score_min', filters.score_min.toString());
    if (filters?.score_max) params.append('score_max', filters.score_max.toString());

    const response = await fetch(`${API_BASE}/api/v3/contacts?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch contacts: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching contacts:', error);
    throw error;
  }
}

export async function getContact(id: string): Promise<Contact> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_BASE}/api/v3/contacts/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch contact: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching contact:', error);
    throw error;
  }
}

export async function createContact(
  contact: Partial<Contact>
): Promise<Contact> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_BASE}/api/v3/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contact),
    });

    if (!response.ok) {
      throw new Error(`Failed to create contact: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error creating contact:', error);
    throw error;
  }
}

export async function updateContact(
  id: string,
  updates: Partial<Contact>
): Promise<Contact> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_BASE}/api/v3/contacts/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update contact: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error updating contact:', error);
    throw error;
  }
}

// ============================================================================
// ENRICHMENT
// ============================================================================

export async function enrichContact(contactId: string): Promise<{ job_id: string }> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_BASE}/api/v3/enrich/quick`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contact_id: contactId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to enrich contact: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error enriching contact:', error);
    throw error;
  }
}

export async function getEnrichmentStatus(
  contactId: string
): Promise<EnrichmentStatus> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(
      `${API_BASE}/api/v3/enrich/status/${contactId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get enrichment status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error getting enrichment status:', error);
    throw error;
  }
}

export async function bulkEnrich(contactIds: string[]): Promise<{ job_id: string }> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_BASE}/api/v3/enrich/bulk`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contact_ids: contactIds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to bulk enrich: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error bulk enriching:', error);
    throw error;
  }
}

// ============================================================================
// SCORING
// ============================================================================

export async function scoreContact(
  contactId: string,
  framework: 'mdcp' | 'bant' | 'spice' | 'all'
): Promise<ScoringResult> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const endpoint =
      framework === 'all'
        ? `/api/v3/score/unified`
        : `/api/v3/score/${framework}`;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contact_id: contactId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to score contact: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error scoring contact:', error);
    throw error;
  }
}

export async function scoreAllContacts(
  framework: 'mdcp' | 'bant' | 'spice' | 'all' = 'all'
): Promise<{ job_id: string; total: number }> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const endpoint =
      framework === 'all'
        ? `/api/v3/score/batch-all`
        : `/api/v3/score/batch/${framework}`;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to batch score: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error batch scoring:', error);
    throw error;
  }
}
