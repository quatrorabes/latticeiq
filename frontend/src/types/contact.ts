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
  enrichment_status: "pending" | "processing" | "completed" | "failed";
  enrichment_data?: {
    summary?: string;
    openingline?: string;
    talkingpoints?: string[];
    personatype?: string;
    vertical?: string;
    inferredtitle?: string;
    inferredcompanywebsite?: string;
    inferredlocation?: string;
    rawtext?: string;
  } | null;
  apex_score?: number | null;
  mdc_score?: number | null;
  rss_score?: number | null;
  created_at?: string;
  updated_at?: string;
}
