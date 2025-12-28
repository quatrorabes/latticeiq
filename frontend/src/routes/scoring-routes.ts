import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../lib/supabaseClient';

interface ScoringRequest {
  contact_id: string;
  enrichment_data: any;
  user_id: string;
}

interface APEXScoringFactors {
  title_score: number;
  seniority_score: number;
  company_size_score: number;
  vertical_match_score: number;
}

// Scoring logic
async function calculateAPEXScore(
  enrichment_data: any,
  user_id: string
): Promise<{ score: number; factors: APEXScoringFactors }> {
  // Load user's ICP settings
  const { data: settingsData } = await supabase
    .from('icp_settings')
    .select('settings')
    .eq('user_id', user_id)
    .single();

  const settings = settingsData?.settings || {
    apex_title_weight: 0.25,
    apex_seniority_weight: 0.25,
    apex_company_size_weight: 0.2,
    apex_vertical_match_weight: 0.3,
  };

  const factors: APEXScoringFactors = {
    title_score: 0,
    seniority_score: 0,
    company_size_score: 0,
    vertical_match_score: 0,
  };

  // TITLE SCORING (0-100)
  const title = enrichment_data.inferred_title?.toLowerCase() || '';
  const titleKeywords = {
    executive: { keywords: ['ceo', 'cto', 'cfo', 'president', 'vp', 'vice president'], score: 100 },
    director: { keywords: ['director', 'head of'], score: 80 },
    manager: { keywords: ['manager', 'lead', 'senior'], score: 60 },
    individual: { keywords: ['analyst', 'specialist', 'engineer', 'coordinator'], score: 40 },
  };

  for (const [, { keywords, score }] of Object.entries(titleKeywords)) {
    if (keywords.some((kw) => title.includes(kw))) {
      factors.title_score = score;
      break;
    }
  }

  // SENIORITY SCORING (0-100)
  const seniority = enrichment_data.inferred_seniority?.toLowerCase() || '';
  if (seniority.includes('executive') || seniority.includes('c-level')) {
    factors.seniority_score = 100;
  } else if (seniority.includes('director') || seniority.includes('vp')) {
    factors.seniority_score = 80;
  } else if (seniority.includes('manager') || seniority.includes('lead')) {
    factors.seniority_score = 60;
  } else if (seniority.includes('senior')) {
    factors.seniority_score = 50;
  } else {
    factors.seniority_score = 30;
  }

  // COMPANY SIZE SCORING (0-100)
  const companySize = enrichment_data.company_size?.toLowerCase() || '';
  if (companySize.includes('enterprise') || companySize.includes('5000+') || companySize.includes('10000+')) {
    factors.company_size_score = 100;
  } else if (companySize.includes('large') || companySize.includes('1000') || companySize.includes('500')) {
    factors.company_size_score = 75;
  } else if (companySize.includes('mid') || companySize.includes('100')) {
    factors.company_size_score = 50;
  } else if (companySize.includes('small') || companySize.includes('startup')) {
    factors.company_size_score = 30;
  } else {
    factors.company_size_score = 40;
  }

  // VERTICAL MATCH SCORING (0-100)
  // This would typically use your ICP's target verticals
  const vertical = enrichment_data.vertical?.toLowerCase() || '';
  const targetVerticals = ['technology', 'software', 'saas', 'fintech', 'healthcare', 'enterprise'];
  
  if (targetVerticals.some((v) => vertical.includes(v))) {
    factors.vertical_match_score = 100;
  } else if (vertical.length > 0) {
    factors.vertical_match_score = 50;
  } else {
    factors.vertical_match_score = 20;
  }

  // Calculate weighted APEX score
  const apexScore =
    factors.title_score * (settings.apex_title_weight as number) +
    factors.seniority_score * (settings.apex_seniority_weight as number) +
    factors.company_size_score * (settings.apex_company_size_weight as number) +
    factors.vertical_match_score * (settings.apex_vertical_match_weight as number);

  return {
    score: Math.round(apexScore),
    factors,
  };
}

export async function setupScoringRoutes(app: FastifyInstance) {
  // Calculate APEX score for a contact
  app.post<{ Params: { contactId: string } }>(
    '/api/v3/score/:contactId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { contactId } = request.params as { contactId: string };

        // Get user from JWT
        const user = request.user as any;
        if (!user?.sub) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        // Get contact
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', contactId)
          .eq('user_id', user.sub)
          .single();

        if (contactError || !contact) {
          return reply.code(404).send({ error: 'Contact not found' });
        }

        // Get enrichment data
        const enrichmentData = contact.enrichment_data || {};

        // Calculate score
        const { score, factors } = await calculateAPEXScore(enrichmentData, user.sub);

        // Update contact with score
        await supabase
          .from('contacts')
          .update({ apex_score: score })
          .eq('id', contactId);

        return reply.send({
          success: true,
          contact_id: contactId,
          apex_score: score,
          scoring_breakdown: factors,
        });
      } catch (err) {
        console.error('Scoring error:', err);
        return reply.code(500).send({ error: (err as Error).message });
      }
    }
  );

  // Bulk score contacts
  app.post<{ Body: { contact_ids?: string[] } }>(
    '/api/v3/score-bulk',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as any;
        if (!user?.sub) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { contact_ids } = request.body as { contact_ids?: string[] };

        // Get all contacts for user if no specific IDs provided
        let query = supabase.from('contacts').select('*').eq('user_id', user.sub);

        if (contact_ids && contact_ids.length > 0) {
          query = query.in('id', contact_ids);
        }

        const { data: contacts, error: contactsError } = await query;

        if (contactsError || !contacts) {
          return reply.code(500).send({ error: contactsError?.message });
        }

        // Score each contact
        const results = [];
        for (const contact of contacts) {
          try {
            const enrichmentData = contact.enrichment_data || {};
            const { score } = await calculateAPEXScore(enrichmentData, user.sub);

            // Update contact
            await supabase
              .from('contacts')
              .update({ apex_score: score })
              .eq('id', contact.id);

            results.push({
              contact_id: contact.id,
              name: `${contact.first_name} ${contact.last_name}`,
              apex_score: score,
            });
          } catch (err) {
            console.error(`Error scoring contact ${contact.id}:`, err);
            results.push({
              contact_id: contact.id,
              name: `${contact.first_name} ${contact.last_name}`,
              error: (err as Error).message,
            });
          }
        }

        return reply.send({
          success: true,
          total_scored: contacts.length,
          results,
        });
      } catch (err) {
        console.error('Bulk scoring error:', err);
        return reply.code(500).send({ error: (err as Error).message });
      }
    }
  );
}
