/**
 * src/types/index.ts - UPDATED WITH ScoreResponse
 * Type definitions for LatticeIQ frontend
 * 
 * Status: FINAL - All types included
 */

/**
 * Contact entity
 */
export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  phone?: string;
  title?: string;
  mdcp_score?: number;
  mdcp_tier?: 'hot' | 'warm' | 'cold';
  bant_score?: number;
  bant_tier?: 'hot' | 'warm' | 'cold';
  spice_score?: number;
  spice_tier?: 'hot' | 'warm' | 'cold';
  overall_score?: number;
  enrichment_status?: 'pending' | 'processing' | 'completed' | 'failed';
  enrichment_data?: EnrichmentData;
  created_at: string;
  updated_at?: string;
}

/**
 * Enrichment data from quick_enrich API
 */
export interface EnrichmentData {
  company_description?: string;
  company_size?: string;
  industry?: string;
  website?: string;
  linkedin_url?: string;
  talking_points?: string | string[];
  recent_news?: string;
  [key: string]: unknown;
}

/**
 * Score response from scoring endpoints
 */
export interface ScoreResponse {
  id: string;
  mdcp_score?: number;
  bant_score?: number;
  spice_score?: number;
  overall_score?: number;
  mdcp_tier?: 'hot' | 'warm' | 'cold';
  bant_tier?: 'hot' | 'warm' | 'cold';
  spice_tier?: 'hot' | 'warm' | 'cold';
  [key: string]: unknown;
}

/**
 * API response for list endpoints
 */
export interface ListResponse<T> {
  results?: T[];
  contacts?: T[];
  total?: number;
  count?: number;
  [key: string]: unknown;
}

/**
 * Scoring framework type
 */
export type ScoringFramework = 'mdcp' | 'bant' | 'spice';

/**
 * Pagination params
 */
export interface PaginationParams {
  limit: number;
  offset: number;
}

/**
 * Filter options
 */
export interface ContactFilters {
  search?: string;
  tier?: 'hot' | 'warm' | 'cold';
  enrichmentStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  minScore?: number;
}

/**
 * Batch operation progress
 */
export interface BatchProgress {
  completed: number;
  total: number;
  failed: number;
  errors?: { [key: string]: string };
}
