export type Contact = {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedin_url?: string;
  enrichment_status?: string | null;
  enrichment_data?: any;
  apex_score?: number | null;
  created_at?: string;
  user_id?: string;
} & Record<string, any>;
