
export interface Contact {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  company: string
  title: string
  phone: string | null
  linkedin_url: string | null
  website: string | null
  vertical: string | null
  persona_type: string | null
  enrichment_status: 'pending' | 'processing' | 'completed' | 'failed'
  enrichment_data: EnrichmentData | null
  apex_score: number | null
  mdcp_score: number | null
  bant_score: number | null
  spice_score: number | null
  enriched_at: string | null
  created_at: string
  updated_at: string
}
