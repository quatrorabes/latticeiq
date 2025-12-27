import type { Contact } from '../types/contact';
import { supabase } from '../lib/supabase';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const contactsService = {
  async getContacts(): Promise<Contact[]> {
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    
    const response = await fetch(`${API_URL}/api/contacts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) throw new Error('Failed to fetch contacts');
    return response.json();
  },

  async deleteContact(id: string): Promise<void> {
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    
    const response = await fetch(`${API_URL}/api/contacts/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) throw new Error('Failed to delete contact');
  },

  async enrichContact(contactId: string): Promise<any> {
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    
    const response = await fetch(`${API_URL}/api/v3/enrichment/quickenrich/${contactId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) throw new Error('Failed to enrich contact');
    return response.json();
  }
};

export type { Contact };
