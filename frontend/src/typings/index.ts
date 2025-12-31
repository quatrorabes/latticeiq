export interface Contact {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string
  company: string | null
  title: string | null
  phone: string | null
  linkedin_url: string | null
  enrichment_status: 'pending' | 'processing' | 'completed' | 'failed'
  apex_score: number | null
  enrichment_data: EnrichmentData | null
  created_at: string
  updated_at: string
  enriched_at: string | null
}

export interface EnrichmentData {
  summary?: string
  opening_line?: string
  talking_points?: string[]
  bant?: {
    budget?: string
    authority?: string
    need?: string
    timeline?: string
  }
  mdcp?: {
    metrics?: string
    decision_criteria?: string
    champion?: string
    process?: string
  }
  spice?: {
    specific_situation?: string
    positive_perception?: string
    identified_critical_event?: string
    champion?: string
    established_relationship?: string
  }
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface EnrichmentResponse {
  id: string
  status: 'completed' | 'processing' | 'failed'
  data?: EnrichmentData
  error?: string
}
