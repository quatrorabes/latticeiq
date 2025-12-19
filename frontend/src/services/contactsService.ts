// frontend/src/services/contactsService.ts
import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL;

export interface Contact {
  id: number;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedin_url?: string;
  website?: string;
  vertical?: string;
  persona_type?: string;
  enrichment_status: 'pending' | 'processing' | 'completed' | 'failed';
  enrichment_data?: Record<string, unknown>;
  enriched_at?: string;
  apex_score?: number;
  mdcp_score?: number;
  rss_score?: number;
  match_tier?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContactFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedin_url?: string;
  website?: string;
}

export interface EnrichmentResult {
  success: boolean;
  contact_id: number;
  status: string;
  txt_file: string;
  enrichment_data: Record<string, unknown>;
}

export interface EnrichmentStatus {
  contact_id: number;
  status: string;
  enriched_at?: string;
  apex_score?: number;
  has_txt_file: boolean;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };
}

export const contactsService = {
  // ========== CONTACT CRUD ==========
  
  async getContacts(): Promise<Contact[]> {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_URL}/api/contacts`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch contacts');
    }
    
    return response.json();
  },
  
  async getContact(id: number): Promise<Contact> {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_URL}/api/contacts/${id}`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch contact');
    }
    
    return response.json();
  },
  
  async createContact(data: ContactFormData): Promise<Contact> {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_URL}/api/contacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to create contact');
    }
    
    return response.json();
  },
  
  async deleteContact(id: number): Promise<void> {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_URL}/api/contacts/${id}`, {
      method: 'DELETE',
      headers
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete contact');
    }
  },
  
  // ========== ENRICHMENT ==========
  
  async enrichContact(contactId: number, synthesize: boolean = true): Promise<EnrichmentResult> {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_URL}/api/v3/enrichment/enrich`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contact_id: contactId,
        synthesize
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to enrich contact');
    }
    
    return response.json();
  },
  
  async getEnrichmentStatus(contactId: number): Promise<EnrichmentStatus> {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_URL}/api/v3/enrichment/enrich/${contactId}/status`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error('Failed to get enrichment status');
    }
    
    return response.json();
  },
  
  async downloadEnrichmentTxt(contactId: number): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    
    // Open download in new tab with auth
    const downloadUrl = `${API_URL}/api/v3/enrichment/enrich/${contactId}/download`;
    
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to download enrichment file');
    }
    
    // Create blob and download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enrichment_${contactId}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  
  async enrichBatch(contactIds?: number[], limit: number = 10): Promise<{
    success: boolean;
    enriched: number;
    total: number;
    txt_files: string[];
  }> {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_URL}/api/v3/enrichment/enrich/batch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contact_ids: contactIds || [],
        limit
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to batch enrich contacts');
    }
    
    return response.json();
  }
};

export default contactsService;
