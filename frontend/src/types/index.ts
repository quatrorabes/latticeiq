
export type Contact = {
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
  overall_score?: number;
  mdcp_tier?: 'hot' | 'warm' | 'cold';
  bant_tier?: 'hot' | 'warm' | 'cold';
  spice_tier?: 'hot' | 'warm' | 'cold';
  apex_score?: number;
  created_at: string;
  updated_at: string;
};

export type EnrichmentData = {
  summary?: string;
  opening_line?: string;
  persona_type?: string;
  vertical?: string;
  inferred_title?: string;
  inferred_company_website?: string;
  inferred_location?: string;
  talking_points?: string[];
  provider?: string;
  model?: string;
  generated_at?: string;
  raw_text?: string;
  bant?: {
    budget?: number;
    authority?: number;
    need?: number;
    timeline?: number;
  };
};

export type ScoreResponse = {
  contact_id: string;
  mdcp_score: number;
  mdcp_tier: 'hot' | 'warm' | 'cold';
  bant_score: number;
  bant_tier: 'hot' | 'warm' | 'cold';
  spice_score: number;
  spice_tier: 'hot' | 'warm' | 'cold';
  overall_score: number;
};

export type User = {
  id: string;
  email: string;
};

export type ContactsTableProps = {
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
  onEnrichContact: (contactId: string) => void;
  onDeleteContact: (contactId: string) => void;
  enrichingIds: Set<string>;
};