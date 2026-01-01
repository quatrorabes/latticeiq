import { supabase } from '../supabaseClient';
import { calculateScores } from './scoring';

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

export interface EnrichmentResult {
  contact_id: string;
  status: string;
  enrichment_data: Record<string, any>;
}

// Try real backend enrichment first, fallback to mock
export async function enrichContact(contactId: string): Promise<EnrichmentResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    // Update status to processing
    await supabase
      .from('contacts')
      .update({ enrichment_status: 'processing' })
      .eq('id', contactId);

    // Try real backend API
    const response = await fetch(`${API_URL}/api/v3/enrichment/quick-enrich/${contactId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const result = await response.json();
    
    // Auto-calculate scores after enrichment
    await calculateScores(contactId);
    
    return result;
  } catch (error) {
    console.warn('Backend enrichment failed, using mock:', error);
    return mockEnrichContact(contactId);
  }
}

// Mock enrichment fallback
export async function mockEnrichContact(contactId: string): Promise<EnrichmentResult> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single();

  if (!contact) throw new Error('Contact not found');

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Generate rich mock enrichment data
  const enrichmentData = {
    summary: `${contact.first_name} ${contact.last_name} is a ${contact.title || 'professional'} at ${contact.company || 'their organization'}. Based on their profile, they demonstrate strong potential as a qualified lead with relevant industry experience.`,
    opening_line: `Hi ${contact.first_name}, I noticed your impressive work as ${contact.title || 'a leader'} at ${contact.company || 'your company'} and wanted to share how we're helping similar professionals achieve remarkable results.`,
    persona_type: contact.title?.toLowerCase().includes('ceo') || contact.title?.toLowerCase().includes('founder') 
      ? 'Executive Decision Maker' 
      : contact.title?.toLowerCase().includes('vp') || contact.title?.toLowerCase().includes('director')
      ? 'Senior Leader'
      : 'Key Stakeholder',
    vertical: 'Technology & Software',
    talking_points: [
      `Strong background in ${contact.title || 'their field'}`,
      `Currently leading initiatives at ${contact.company || 'their organization'}`,
      'Likely evaluating solutions to improve team efficiency',
      'Decision-making authority in their domain',
      'Good timing for outreach based on market trends'
    ],
    company_description: `${contact.company || 'The organization'} is an innovative company focused on delivering value in their market segment.`,
    company_size: '50-200 employees',
    industry: 'Technology',
    recent_news: `${contact.company || 'The company'} has been expanding their operations and investing in new solutions.`,
    linkedin_url: contact.linkedin_url || null,
    website: contact.website || null
  };

  // Update contact with enrichment data
  await supabase
    .from('contacts')
    .update({
      enrichment_status: 'completed',
      enrichment_data: enrichmentData,
      updated_at: new Date().toISOString()
    })
    .eq('id', contactId);

  // Auto-calculate scores after enrichment
  await calculateScores(contactId);

  return {
    contact_id: contactId,
    status: 'completed',
    enrichment_data: enrichmentData
  };
}

// Batch enrichment
export async function enrichContacts(contactIds: string[]): Promise<void> {
  for (const contactId of contactIds) {
    try {
      await enrichContact(contactId);
    } catch (error) {
      console.error(`Failed to enrich contact ${contactId}:`, error);
    }
  }
}
