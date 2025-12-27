export interface EnrichmentData {
  // New format (from current Perplexity enrichment)
  summary?: string;
  company_overview?: string;
  talking_points?: string[];
  persona_type?: string;
  vertical?: string;
  company_size?: string;
  inferred_title?: string;
  inferred_seniority?: string;
  recent_news?: string;
  recommended_approach?: string;
  tags?: string[];
  
  // Old format (legacy)
  openingline?: string;
  talkingpoints?: string[];
  personatype?: string;
  inferredtitle?: string;
  inferredcompanywebsite?: string;
  inferredlocation?: string;
  rawtext?: string;
  
  // Allow any additional fields
  [key: string]: any;
}

export interface Contact {
  id: string;
  workspace_id?: string | null;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  job_title?: string | null;
  linkedin_url?: string | null;
  website?: string | null;
  vertical?: string | null;
  persona_type?: string | null;
  annual_revenue?: number | null;
  enrichment_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
  enrichment_data?: EnrichmentData | null;
  enriched_at?: string | null;
  apex_score?: number | null;
  mdc_score?: number | null;
  rss_score?: number | null;
  mdcp_score?: number | null;
  bant_score?: number | null;
  spice_score?: number | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  crm_type?: string | null;
  external_id?: string | null;
  lifecycle_stage?: string | null;
  lead_status?: string | null;
}