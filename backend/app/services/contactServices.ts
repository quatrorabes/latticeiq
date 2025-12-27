// frontend/src/services/contactsService.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

export interface Contact {
  id: string;
  userid: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedinurl?: string;
  website?: string;
  vertical?: string;
  personatype?: string;
  enrichmentstatus: 'pending' | 'processing' | 'completed' | 'failed';
  enrichmentdata?: Record<string, unknown>;
  apexscore?: number;
  mdcpscore?: number;
  rssscore?: number;
  enrichedat?: string;
}

class ContactsService {
  async getContacts(limit = 50, offset = 0): Promise<Contact[]> {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/v3/contacts?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch contacts: ${response.statusText}`);
    }

    const data = await response.json();
    return data.contacts || [];
  }

  async getContact(contactId: string): Promise<Contact> {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/v3/contacts/${contactId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch contact: ${response.statusText}`);
    }

    return response.json();
  }

  async enrichContact(contactId: string): Promise<Contact> {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/v3/enrichment/enrich/${contactId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ async_mode: true }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to enrich contact: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteContact(contactId: string): Promise<void> {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/v3/contacts/${contactId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete contact: ${response.statusText}`);
    }
  }

  async updateContact(contactId: string, updates: Partial<Contact>): Promise<Contact> {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/v3/contacts/${contactId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update contact: ${response.statusText}`);
    }

    return response.json();
  }
}

export const contactsService = new ContactsService();
