export interface Contact {
  id: string;
  user_id: string;
  first_name: string;     // ✅ FIXED
  last_name: string;      // ✅ FIXED
  email: string;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
  website?: string | null;
  enrichment_status: "pending" | "processing" | "completed" | "failed";
  enrichment_data?: Record<string, unknown> | null;
  apex_score?: number | null;
  mdc_score?: number | null;
  rss_score?: number | null;
  notes?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
}
