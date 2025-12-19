// Contact Type Definitions
export interface Contact {
  id: number;
  user_id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  company: string;
  title?: string;
  linkedin_url?: string;
  website?: string;
  vertical?: string;
  persona_type?: string;
  enrichment_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
  enrichment_data?: EnrichmentData;
  enriched_at?: string;
  apex_score?: number;
  mdcp_score?: number;
  rss_score?: number;
  bant_score?: number;
  spice_score?: number;
  created_at: string;
  updated_at: string;
}

export interface EnrichmentData {
  executive_summary?: string;
  role_responsibilities?: string;
  company_intelligence?: string;
  deal_triggers?: string[];
  objection_handlers?: string[];
  connection_angles?: string[];
  raw_domains?: {
    company?: any;
    person?: any;
    industry?: any;
    news?: any;
    open_ended?: any;
  };
}

export interface ContactFormData {
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  company: string;
  title?: string;
  linkedin_url?: string;
  website?: string;
  vertical?: string;
}
