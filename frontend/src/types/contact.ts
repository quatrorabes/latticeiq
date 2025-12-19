// frontend/src/types/contact.ts
export interface Contact {
  id: number;
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  industry?: string;
  enrichment_status?: string | null;
  enrichment_data?: string | object | null;
  enriched_at?: string | null;
  apex_score?: number | null;
  mdcp_score?: number | null;
  rss_score?: number | null;
  match_tier?: string | null;
  bant_total_score?: number | null;
  bant_budget_score?: number | null;
  bant_authority_score?: number | null;
  bant_need_score?: number | null;
  bant_timeline_score?: number | null;
  spice_total_score?: number | null;
  persona_type?: string | null;
  persona_confidence?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContactFormData {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company: string;
  title?: string;
  industry?: string;
}
