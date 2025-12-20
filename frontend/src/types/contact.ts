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
  enrichment_status: "pending" | "processing" | "completed" | "failed";
  enrichment_data?: Record<string, unknown> | null;
  enriched_at?: string | null;
  apex_score?: number | null;
  mdc_score?: number | null;
  rss_score?: number | null;
  bant_budget?: number | null;
  bant_authority?: number | null;
  bant_need?: number | null;
  bant_timing?: number | null;
  bant_total_score?: number | null;
  notes?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EnrichmentData {
  synthesized?: {
    summary?: string;
    opening_line?: string;
    talking_points?: string[];
    objections?: Array<{ objection: string; response: string }>;
  };
  quick_enrich?: {
    summary?: string;
    opening_line?: string;
    persona_type?: string;
    vertical?: string;
    talking_points?: string[];
  };
}
