export interface Contact {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  job_title?: string | null;
  linkedin_url?: string | null;
  website?: string | null;
  enrichment_status: string;
  enriched_at?: string | null;
  apex_score?: number | null;
  mdcp_score?: number | null;
  bant_score?: number | null;
  spice_score?: number | null;
  enrichment_data?: EnrichmentData | null;
  created_at?: string;
  updated_at?: string;
}

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
