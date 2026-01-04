import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  icp_id: string;
  email_template_id?: string;
  call_template_id?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  min_icp_score: number;
  max_contacts?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface EmailTemplate {
  id: string;
  workspace_id: string;
  name: string;
  subject: string;
  body: string;
  variables_used: string[];
  category?: string;
  is_active: boolean;
  created_at: string;
}

export interface CampaignPreview {
  contact_id: string;
  contact_name: string;
  icp_score: number;
  email_subject: string;
  email_body: string;
  variables_resolved: Record<string, string>;
}

export const campaignApi = {
  async list(): Promise<Campaign[]> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch campaigns');
    const data = await response.json();
    return data.campaigns;
  },

  async create(campaign: Partial<Campaign>): Promise<Campaign> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/campaigns`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(campaign),
    });

    if (!response.ok) throw new Error('Failed to create campaign');
    return response.json();
  },

  async preview(campaignId: string, sampleSize: number = 5): Promise<CampaignPreview[]> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(
      `${API_URL}/api/v3/campaigns/${campaignId}/preview?sample_size=${sampleSize}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) throw new Error('Failed to preview campaign');
    const data = await response.json();
    return data.previews;
  },

  async activate(campaignId: string): Promise<void> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/campaigns/${campaignId}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to activate campaign');
  },
};

export const templateApi = {
  async listEmail(): Promise<EmailTemplate[]> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/templates/email`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch templates');
    const data = await response.json();
    return data.templates;
  },

  async createEmail(template: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/templates/email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(template),
    });

    if (!response.ok) throw new Error('Failed to create template');
    return response.json();
  },
};
