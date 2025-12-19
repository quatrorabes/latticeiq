// frontend/src/types/contact.ts
/**
 * Contact type definitions for LatticeIQ
 */

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
  enrichment_data?: EnrichmentData | null;
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

export interface EnrichmentData {
  synthesized?: {
    summary?: string;
    hooks?: string[];
    talking_points?: string[];
    objections?: Array<{
      objection: string;
      response: string;
    }>;
    bant?: {
      budget?: string;
      authority?: string;
      need?: string;
      timeline?: string;
    };
  };
  raw?: {
    company_data?: Record<string, unknown>;
    person_data?: Record<string, unknown>;
    news?: Array<{
      title: string;
      url: string;
      date?: string;
    }>;
  };
}

export interface ContactFormData {
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

export interface ContactCreateRequest extends ContactFormData {}

export interface ContactUpdateRequest extends Partial<ContactFormData> {}
