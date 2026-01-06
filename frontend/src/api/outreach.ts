/**
 * LatticeIQ Outreach API Client
 * Email generation and business profile management
 */

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

// ============================================================================
// BUSINESS PROFILE
// ============================================================================

export async function getBusinessProfile(): Promise<{ profile: BusinessProfile | null; exists: boolean }> {
  const response = await fetch(`${API_BASE}/api/v3/outreach/business-profile`);
  if (!response.ok) {
    throw new Error('Failed to fetch business profile');
  }
  return response.json();
}

export async function saveBusinessProfile(profile: Omit<BusinessProfile, 'id' | 'is_default' | 'created_at' | 'updated_at'>): Promise<{ profile: BusinessProfile; message: string }> {
  const response = await fetch(`${API_BASE}/api/v3/outreach/business-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!response.ok) {
    const error = await response.json();
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
  const response = await fetch(`${API_BASE}/api/v3/outreach/generate-emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contact_id: contactId,
      num_variants: numVariants,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to generate emails');
  }
  
  return response.json();
}

export async function getContactEmails(contactId: string): Promise<{ emails: EmailVariant[]; count: number }> {
  const response = await fetch(`${API_BASE}/api/v3/outreach/emails/${contactId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch emails');
  }
  return response.json();
}

export async function deleteEmail(emailId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v3/outreach/emails/${emailId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete email');
  }
}

export async function toggleEmailFavorite(emailId: string): Promise<{ is_favorite: boolean }> {
  const response = await fetch(`${API_BASE}/api/v3/outreach/emails/${emailId}/favorite`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    throw new Error('Failed to toggle favorite');
  }
  return response.json();
}

export async function markEmailAsSent(emailId: string): Promise<{ message: string; sent_at: string }> {
  const response = await fetch(`${API_BASE}/api/v3/outreach/emails/${emailId}/sent`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    throw new Error('Failed to mark as sent');
  }
  return response.json();
}
