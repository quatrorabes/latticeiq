import { supabase } from '../supabaseClient';

export interface EnrichmentResult {
  contact_id: string;
  status: string;
  result: {
    summary?: string;
    opening_line?: string;
    persona_type?: string;
    vertical?: string;
    talking_points?: string[];
    [key: string]: any;
  };
  scores?: {
    mdcp_score: number;
    mdcp_tier: string;
    bant_score: number;
    bant_tier: string;
    spice_score: number;
    spice_tier: string;
    overall_score: number;
    overall_tier: string;
  };
  raw_text?: string;
  model: string;
}

// Queue single contact for enrichment
export async function enrichContact(contactId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Update contact status to pending
    await supabase
      .from('contacts')
      .update({ 
        enrichment_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId);

    // Try to insert into enrichment queue (will fail if already queued)
    const { error } = await supabase
      .from('enrichment_queue')
      .insert({
        contact_id: contactId,
        user_id: user.id,
        status: 'pending',
        priority: 10 // High priority for single enrichment
      });

    if (error && !error.message.includes('duplicate')) {
      console.error('Queue error:', error);
    }

    console.log('Contact queued for enrichment:', contactId);
  } catch (error: any) {
    console.error('Failed to queue enrichment:', error);
    throw error;
  }
}

// Queue multiple contacts for enrichment
export async function enrichContacts(contactIds: string[]): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Update all contacts to pending
    await supabase
      .from('contacts')
      .update({ 
        enrichment_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .in('id', contactIds);

    // Queue all contacts
    const queueItems = contactIds.map(contactId => ({
      contact_id: contactId,
      user_id: user.id,
      status: 'pending',
      priority: 5 // Normal priority for batch
    }));

    const { error } = await supabase
      .from('enrichment_queue')
      .insert(queueItems);

    if (error && !error.message.includes('duplicate')) {
      console.error('Batch queue error:', error);
      throw error;
    }

    console.log(`Queued ${contactIds.length} contacts for enrichment`);
  } catch (error: any) {
    console.error('Failed to queue batch enrichment:', error);
    throw error;
  }
}

// Get enrichment status
export async function getEnrichmentStatus(contactId: string): Promise<{ status: string; result?: any }> {
  const { data } = await supabase
    .from('contacts')
    .select('enrichment_status, enrichment_data, mdcp_score, bant_score, spice_score')
    .eq('id', contactId)
    .single();

  return {
    status: data?.enrichment_status || 'pending',
    result: data?.enrichment_data
  };
}

// Mock enrichment for testing (simulates AI enrichment)
export async function mockEnrichContact(contactId: string): Promise<void> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single();

  if (!contact) throw new Error('Contact not found');

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Generate mock enrichment data
  const mockEnrichmentData = {
    summary: `${contact.first_name} ${contact.last_name} is a ${contact.title || 'professional'} at ${contact.company || 'their company'}. Based on their profile, they show strong indicators of being a qualified lead.`,
    opening_line: `Hi ${contact.first_name}, I noticed your work at ${contact.company || 'your company'} and thought you might be interested in learning how we help ${contact.title || 'professionals'} like you achieve better results.`,
    persona_type: contact.title?.toLowerCase().includes('vp') || contact.title?.toLowerCase().includes('director') ? 'Executive' : 'Manager',
    vertical: contact.company ? 'Technology' : 'General Business',
    talking_points: [
      `Experience in ${contact.title || 'their field'}`,
      `Current role at ${contact.company || 'their organization'}`,
      'Strong potential for partnership',
      'High engagement likelihood'
    ],
    company_description: `${contact.company || 'The company'} is a forward-thinking organization in their industry.`,
    company_size: '50-200 employees',
    industry: 'Technology & Software',
    recent_news: 'Company recently announced growth initiatives'
  };

  // Calculate mock scores
  const mdcp_score = Math.floor(Math.random() * 40) + 60; // 60-100
  const bant_score = Math.floor(Math.random() * 40) + 50; // 50-90
  const spice_score = Math.floor(Math.random() * 40) + 55; // 55-95
  const overall_score = Math.floor((mdcp_score + bant_score + spice_score) / 3);

  const getTier = (score: number) => {
    if (score >= 80) return 'hot';
    if (score >= 60) return 'warm';
    return 'cold';
  };

  // Update contact with enrichment data
  await supabase
    .from('contacts')
    .update({
      enrichment_status: 'completed',
      enrichment_data: mockEnrichmentData,
      mdcp_score,
      mdcp_tier: getTier(mdcp_score),
      bant_score,
      bant_tier: getTier(bant_score),
      spice_score,
      spice_tier: getTier(spice_score),
      overall_score,
      overall_tier: getTier(overall_score),
      updated_at: new Date().toISOString()
    })
    .eq('id', contactId);

  // Remove from queue
  await supabase
    .from('enrichment_queue')
    .delete()
    .eq('contact_id', contactId);

  console.log('Mock enrichment completed for:', contactId);
}
