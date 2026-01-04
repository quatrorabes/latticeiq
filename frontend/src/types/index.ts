// frontend/src/types/index.ts

export interface EnrichmentData {
  summary?: string;
  opening_line?: string;
  persona_type?: string;
  vertical?: string;
  talking_points?: string | string[];
  company_description?: string;
  company_size?: string;
  industry?: string;
  recent_news?: string;
  provider?: string;
  generated_at?: string;
}

export interface Contact {
  id: string;
  workspace_id?: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  phone?: string;
  title?: string;
  job_title?: string;
  linkedin_url?: string;
  website?: string;
  vertical?: string;
  persona_type?: string;
  industry?: string;
  company_size?: string;
  
  // Scores
  mdcp_score?: number;
  mdcp_tier?: 'hot' | 'warm' | 'cold';
  bant_score?: number;
  bant_tier?: 'hot' | 'warm' | 'cold';
  spice_score?: number;
  spice_tier?: 'hot' | 'warm' | 'cold';
  overall_score?: number;
  overall_tier?: 'hot' | 'warm' | 'cold';
  
  // Enrichment
  enrichment_status?: 'pending' | 'processing' | 'completed' | 'failed';
  enrichment_data?: EnrichmentData;
  enrichment_full_profile?: string;
  enrichment_last_deep_enriched_at?: string;
  enrichment_deep_quality_score?: number;
  
  // Pipeline
  pipeline_stage?: string;
  lead_status?: string;
  lifecycle_stage?: string;
  
  // CRM
  hubspot_id?: string;
  hubspot_metadata?: Record<string, any>;
  source?: string;
  
  // Timestamps
  created_at: string;
  updated_at?: string;
}

export interface ContactFilters {
  search?: string;
  tier?: 'hot' | 'warm' | 'cold';
  enrichmentStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  minScore?: number;
}

export interface ScoreResponse {
  contact_id: string;
  mdcp_score: number;
  mdcp_tier: 'hot' | 'warm' | 'cold';
  bant_score: number;
  bant_tier: 'hot' | 'warm' | 'cold';
  spice_score: number;
  spice_tier: 'hot' | 'warm' | 'cold';
  overall_score: number;
}

export interface ScoringConfig {
  framework: 'mdcp' | 'bant' | 'spice';
  weights: Record<string, number>;
  thresholds: {
    hot: number;
    warm: number;
  };
}
