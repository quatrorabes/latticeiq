import { supabase } from '../supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

export interface ScoringResult {
  contact_id: string;
  mdcp_score: number;
  mdcp_tier: string;
  bant_score: number;
  bant_tier: string;
  spice_score: number;
  spice_tier: string;
  overall_score: number;
  overall_tier: string;
}

// Calculate all scores for a contact via backend
export async function calculateScores(contactId: string): Promise<ScoringResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/v3/scoring/calculate-all/${contactId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Scoring API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Update contact in Supabase with new scores
    await supabase
      .from('contacts')
      .update({
        mdcp_score: result.mdcp_score,
        mdcp_tier: result.mdcp_tier,
        bant_score: result.bant_score,
        bant_tier: result.bant_tier,
        spice_score: result.spice_score,
        spice_tier: result.spice_tier,
        overall_score: result.overall_score,
        overall_tier: result.overall_tier,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId);

    return result;
  } catch (error) {
    console.warn('Backend scoring failed, using local calculation:', error);
    return calculateScoresLocally(contactId);
  }
}

// Local fallback scoring when backend is unavailable
export async function calculateScoresLocally(contactId: string): Promise<ScoringResult> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single();

  if (!contact) throw new Error('Contact not found');

  const enrichment = contact.enrichment_data || {};

  // MDCP Score calculation
  let mdcp = 50;
  if (contact.title?.toLowerCase().includes('ceo') || 
      contact.title?.toLowerCase().includes('vp') ||
      contact.title?.toLowerCase().includes('director')) mdcp += 20;
  if (contact.company) mdcp += 10;
  if (enrichment.company_size) mdcp += 10;
  if (enrichment.industry) mdcp += 10;
  mdcp = Math.min(100, mdcp);

  // BANT Score calculation  
  let bant = 45;
  if (contact.title?.toLowerCase().includes('ceo') || 
      contact.title?.toLowerCase().includes('founder')) bant += 25;
  if (enrichment.company_size?.includes('500') || 
      enrichment.company_size?.includes('1000')) bant += 15;
  if (contact.email?.includes('.com')) bant += 10;
  bant = Math.min(100, bant);

  // SPICE Score calculation
  let spice = 40;
  if (enrichment.recent_news) spice += 20;
  if (enrichment.talking_points?.length > 0) spice += 15;
  if (contact.linkedin_url) spice += 10;
  if (enrichment.persona_type) spice += 15;
  spice = Math.min(100, spice);

  const overall = Math.round((mdcp + bant + spice) / 3);

  const getTier = (score: number) => {
    if (score >= 75) return 'hot';
    if (score >= 50) return 'warm';
    return 'cold';
  };

  const result: ScoringResult = {
    contact_id: contactId,
    mdcp_score: mdcp,
    mdcp_tier: getTier(mdcp),
    bant_score: bant,
    bant_tier: getTier(bant),
    spice_score: spice,
    spice_tier: getTier(spice),
    overall_score: overall,
    overall_tier: getTier(overall)
  };

  // Save to Supabase
  await supabase
    .from('contacts')
    .update({
      mdcp_score: result.mdcp_score,
      mdcp_tier: result.mdcp_tier,
      bant_score: result.bant_score,
      bant_tier: result.bant_tier,
      spice_score: result.spice_score,
      spice_tier: result.spice_tier,
      overall_score: result.overall_score,
      overall_tier: result.overall_tier,
      updated_at: new Date().toISOString()
    })
    .eq('id', contactId);

  return result;
}
