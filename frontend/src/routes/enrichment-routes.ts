import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../lib/supabaseClient';

interface APEXScoringFactors {
  title_score: number;
  seniority_score: number;
  company_size_score: number;
  vertical_match_score: number;
}

// Import the scoring function
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

export async function setupEnrichmentRoutes(app: FastifyInstance) {
  // Enrich a single contact
  app.post<{ Params: { contactId: string } }>(
    '/enrich/:contactId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { contactId } = request.params as { contactId: string };

        // Get user from JWT
        const user = request.user as any;
        if (!user?.sub) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        // Get contact from database
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', contactId)
          .eq('user_id', user.sub)
          .single();

        if (contactError || !contact) {
          return reply.code(404).send({ error: 'Contact not found' });
        }

        // Call your enrichment AI service (e.g., OpenAI, Claude, custom service)
        const enrichmentData = await callEnrichmentService(contact);

        // Calculate APEX score
        const { score } = await calculateAPEXScore(enrichmentData, user.sub);

        // Update contact with enrichment data and score
        const { error: updateError } = await supabase
          .from('contacts')
          .update({
            enrichment_status: 'enriched',
            enrichment_data: enrichmentData,
            apex_score: score,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId);

        if (updateError) {
          throw updateError;
        }

        return reply.send({
          success: true,
          contact_id: contactId,
          enrichment_data: enrichmentData,
          apex_score: score,
        });
      } catch (err) {
        console.error('Enrichment error:', err);
        return reply.code(500).send({ error: (err as Error).message });
      }
    }
  );
}

// Call your enrichment service (replace with your actual implementation)
async function callEnrichmentService(contact: any) {
  // This is a placeholder - replace with actual API call to your enrichment service
  // Examples: OpenAI, Anthropic Claude, company-specific enrichment service, etc.

  const apiKey = process.env.ENRICHMENT_API_KEY;
  const apiUrl = process.env.ENRICHMENT_API_URL || 'https://api.openai.com/v1/chat/completions';

  if (!apiKey) {
    throw new Error('ENRICHMENT_API_KEY not configured');
  }

  // Example: OpenAI enrichment prompt
  const prompt = `Enrich this contact information with professional insights:
Name: ${contact.first_name} ${contact.last_name}
Email: ${contact.email}
Company: ${contact.company}
Title: ${contact.title}

Return a JSON object with these fields:
{
  "summary": "2-3 sentence professional summary",
  "inferred_title": "inferred job title based on context",
  "inferred_seniority": "executive/director/manager/individual contributor level",
  "company_overview": "brief company description",
  "company_size": "estimated company size category",
  "vertical": "industry/vertical",
  "talking_points": ["point 1", "point 2", "point 3"],
  "recent_news": "any recent news or activities",
  "recommended_approach": "suggested sales approach"
}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Enrichment API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse enrichment response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('Enrichment service error:', err);
    throw err;
  }
}
