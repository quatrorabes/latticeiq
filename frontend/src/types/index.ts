// ============================================================================
// FILE: frontend/src/types/index.ts
// ============================================================================
export interface Contact {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedin_url?: string;
  website?: string;
  enrichment_status?: 'pending' | 'processing' | 'completed' | 'failed';
  enrichment_data?: EnrichmentData;
  enriched_at?: string;
  // Scoring fields
  mdcp_score?: number;
  bant_score?: number;
  spice_score?: number;
  mdcp_tier?: 'hot' | 'warm' | 'cold';
  bant_tier?: 'hot' | 'warm' | 'cold';
  spice_tier?: 'hot' | 'warm' | 'cold';
  created_at: string;
  updated_at: string;
}

export interface EnrichmentData {
  quick_enrich?: {
    summary?: string;
    opening_line?: string;
    persona_type?: string;
    vertical?: string;
    inferred_title?: string;
    inferred_company_website?: string;
    inferred_location?: string;
    talking_points?: string[];
  };
  provider?: string;
  model?: string;
  generated_at?: string;
  raw_text?: string;
}

export interface User {
  id: string;
  email: string;
}
