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

        // Call enrichment service
        const result = await callEnrichmentService(contact);
        const enrichmentData = result.data;

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
          provider_used: result.provider,
          both_results: result.both_results, // If using 'both', include both analyses
        });
      } catch (err) {
        console.error('Enrichment error:', err);
        return reply.code(500).send({ error: (err as Error).message });
      }
    }
  );
}

// Call enrichment service (supports OpenAI, Perplexity, or both)
async function callEnrichmentService(contact: any) {
  const provider = process.env.ENRICHMENT_PROVIDER || 'openai';
  const openaiKey = process.env.OPENAI_API_KEY || process.env.ENRICHMENT_API_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY || process.env.ENRICHMENT_API_KEY;

  if (!openaiKey && !perplexityKey) {
    throw new Error('No API keys configured: set OPENAI_API_KEY and/or PERPLEXITY_API_KEY');
  }

  const prompt = `Enrich this contact information with professional insights:
Name: ${contact.first_name} ${contact.last_name}
Email: ${contact.email}
Company: ${contact.company}
Title: ${contact.title}

Return ONLY a JSON object with these fields (no markdown, no code blocks):
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
    if (provider === 'openai') {
      const data = await callOpenAI(openaiKey, prompt);
      return { data, provider: 'openai' };
    } 
    else if (provider === 'perplexity') {
      const data = await callPerplexity(perplexityKey, prompt);
      return { data, provider: 'perplexity' };
    } 
    else if (provider === 'both') {
      // Call both providers in parallel
      const [openaiData, perplexityData] = await Promise.all([
        callOpenAI(openaiKey, prompt),
        callPerplexity(perplexityKey, prompt),
      ]);

      // Merge results (prefer OpenAI as primary, use Perplexity to fill gaps)
      const mergedData = {
        summary: openaiData.summary || perplexityData.summary,
        inferred_title: openaiData.inferred_title || perplexityData.inferred_title,
        inferred_seniority: openaiData.inferred_seniority || perplexityData.inferred_seniority,
        company_overview: openaiData.company_overview || perplexityData.company_overview,
        company_size: openaiData.company_size || perplexityData.company_size,
        vertical: openaiData.vertical || perplexityData.vertical,
        talking_points: [...new Set([...openaiData.talking_points, ...perplexityData.talking_points])].slice(0, 5),
        recent_news: openaiData.recent_news || perplexityData.recent_news,
        recommended_approach: openaiData.recommended_approach || perplexityData.recommended_approach,
      };

      return { 
        data: mergedData, 
        provider: 'both',
        both_results: {
          openai: openaiData,
          perplexity: perplexityData,
        }
      };
    } 
    else {
      throw new Error(`Unknown enrichment provider: ${provider}`);
    }
  } catch (err) {
    console.error('Enrichment service error:', err);
    throw err;
  }
}

// OpenAI enrichment
async function callOpenAI(apiKey: string, prompt: string) {
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a professional contact enrichment specialist. Return ONLY valid JSON, no markdown, no code blocks.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse enrichment response from OpenAI');
  }

  return JSON.parse(jsonMatch[0]);
}

// Perplexity enrichment
async function callPerplexity(apiKey: string, prompt: string) {
  if (!apiKey) {
    throw new Error('Perplexity API key not configured');
  }

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'pplx-70b-online',
      messages: [
        {
          role: 'system',
          content: 'You are a professional contact enrichment specialist. Return ONLY valid JSON, no markdown, no code blocks.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse enrichment response from Perplexity');
  }

  return JSON.parse(jsonMatch[0]);
}
