import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface ICPCriteria {
  industries: string[];
  personas: string[];
  min_company_size?: number;
  max_company_size?: number;
}

export interface ICP {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  criteria: ICPCriteria;
  scoring_weights: {
    industry_weight: number;
    persona_weight: number;
    company_size_weight: number;
  };
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ContactMatch {
  contact_id: string;
  icp_id: string;
  score: number;
  tier: 'hot' | 'warm' | 'cold';
  matched_criteria: Record<string, boolean>;
}

export const icpApi = {
  async list(): Promise<ICP[]> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/icps`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch ICPs');
    const data = await response.json();
    return data.icps;
  },

  async create(icp: Partial<ICP>): Promise<ICP> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/icps`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(icp),
    });

    if (!response.ok) throw new Error('Failed to create ICP');
    return response.json();
  },

  async update(id: string, icp: Partial<ICP>): Promise<ICP> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/icps/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(icp),
    });

    if (!response.ok) throw new Error('Failed to update ICP');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/icps/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to delete ICP');
  },

  async matchContacts(
    icpId: string,
    contactIds?: string[],
    minScore: number = 40
  ): Promise<ContactMatch[]> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/icps/${icpId}/match`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        icp_id: icpId,
        contact_ids: contactIds,
        min_score: minScore,
        limit: 100,
      }),
    });

    if (!response.ok) throw new Error('Failed to match contacts');
    const data = await response.json();
    return data.results;
  },

  async getMatches(
    icpId: string,
    minScore: number = 60,
    limit: number = 100
  ): Promise<any> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(
      `${API_URL}/api/v3/icps/${icpId}/matches?min_score=${minScore}&limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) throw new Error('Failed to get matches');
    return response.json();
  },
};
