/**
 * LatticeIQ Outreach API Client
 * Email generation and business profile management
 */

import { supabase } from '../lib/supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';


// ============================================================================
// TYPES
// ============================================================================


export interface CaseStudy {
  client: string;
  challenge?: string;
  result: string;
  metric?: string;
}


export interface BusinessProfile {
  id?: string;
  company_name: string;
  tagline?: string;
  what_you_do: string;
  target_audience: string;
  primary_value_prop: string;
  unique_approach?: string;
  key_features: string[];
  case_studies: CaseStudy[];
  notable_clients: string[];
  tone: 'professional' | 'casual' | 'bold' | 'friendly';
  sender_name?: string;
  sender_title?: string;
  sender_email?: string;
  calendar_link?: string;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}


export interface EmailVariant {
  id?: string;
  variant_number: number;
  style: string;
  style_description: string;
  subject: string;
  body: string;
  quality_score: number;
  quality_notes: string;
  is_favorite?: boolean;
  is_sent?: boolean;
  sent_at?: string;
  created_at?: string;
}


export interface GenerateEmailsResponse {
  contact_id: string;
  contact_name: string;
  company: string;
  title: string;
  variants: EmailVariant[];
  generated_at: string;
  model_used: string;
  total_tokens: number;
  estimated_cost: number;
}


export interface CallScriptVariant {
  id?: string;
  variant_number: number;
  style: string;
  style_description: string;
  opener: string;
  body: string;
  closer: string;
  quality_score: number;
  quality_notes: string;
  is_favorite?: boolean;
  created_at?: string;
}


export interface GenerateCallScriptsResponse {
  contact_id: string;
  contact_name: string;
  company: string;
  title: string;
  variants: CallScriptVariant[];
  generated_at: string;
  model_used: string;
  total_tokens: number;
  estimated_cost: number;
}


// ============================================================================
// AUTH HELPER
// ============================================================================


async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}


// ============================================================================
// BUSINESS PROFILE
// ============================================================================


export async function getBusinessProfile(): Promise<{ profile: BusinessProfile | null; exists: boolean }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/api/v3/outreach/business-profile`, {
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch business profile');
  }
  
  return response.json();
}


export async function saveBusinessProfile(
  profile: Omit<BusinessProfile, 'id' | 'is_default' | 'created_at' | 'updated_at'>
): Promise<{ profile: BusinessProfile; message: string }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/api/v3/outreach/business-profile`, {
    method: 'POST',
    headers,
    body: JSON.stringify(profile),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to save business profile');
  }
  
  return response.json();
}


// ============================================================================
// EMAIL GENERATION
// ============================================================================


export async function generateEmails(
  contactId: string,
  numVariants: number = 3
): Promise<GenerateEmailsResponse> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/api/v3/outreach/generate-emails`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contact_id: contactId,
      num_variants: numVariants,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to generate emails');
  }
  
  return response.json();
}


export async function getContactEmails(contactId: string): Promise<{ emails: EmailVariant[]; count: number }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/api/v3/outreach/emails/${contactId}`, {
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch emails');
  }
  
  return response.json();
}


export async function deleteEmail(emailId: string): Promise<void> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/api/v3/outreach/emails/${emailId}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to delete email');
  }
}


export async function toggleEmailFavorite(emailId: string): Promise<{ is_favorite: boolean }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/api/v3/outreach/emails/${emailId}/favorite`, {
    method: 'PATCH',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to toggle favorite');
  }
  
  return response.json();
}


export async function markEmailAsSent(emailId: string): Promise<{ message: string; sent_at: string }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/api/v3/outreach/emails/${emailId}/sent`, {
    method: 'PATCH',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to mark as sent');
  }
  
  return response.json();
}


// ============================================================================
// CALL SCRIPT GENERATION
// ============================================================================


export async function generateCallScripts(
  contactId: string,
  numVariants: number = 3
): Promise<GenerateCallScriptsResponse> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/api/v3/outreach/generate-call-scripts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contact_id: contactId,
      num_variants: numVariants,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to generate call scripts');
  }
  
  return response.json();
}


export async function getContactCallScripts(contactId: string): Promise<{ scripts: CallScriptVariant[]; count: number }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/api/v3/outreach/call-scripts/${contactId}`, {
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch call scripts');
  }
  
  return response.json();
}


// ============================================================================
// HEALTH CHECK
// ============================================================================


export async function checkOutreachHealth(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/v3/outreach/health`);
  
  if (!response.ok) {
    throw new Error('Outreach service unavailable');
  }
  
  return response.json();
}
