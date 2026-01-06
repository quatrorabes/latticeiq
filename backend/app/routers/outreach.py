"""
LatticeIQ Outreach Module - AI-Powered Email Generation
Generates hyper-personalized outreach using deep enrichment + business profile
"""

import os
import re
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v3/outreach", tags=["outreach"])

# Initialize OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class CaseStudy(BaseModel):
    client: str
    challenge: Optional[str] = None
    result: str
    metric: Optional[str] = None


class BusinessProfileCreate(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=200)
    tagline: Optional[str] = Field(None, max_length=300)
    what_you_do: str = Field(..., min_length=10, max_length=1000)
    target_audience: str = Field(..., min_length=10, max_length=500)
    primary_value_prop: str = Field(..., min_length=10, max_length=500)
    unique_approach: Optional[str] = Field(None, max_length=1000)
    key_features: List[str] = Field(default_factory=list)
    case_studies: List[CaseStudy] = Field(default_factory=list)
    notable_clients: List[str] = Field(default_factory=list)
    tone: str = Field(default="professional")
    sender_name: Optional[str] = None
    sender_title: Optional[str] = None
    sender_email: Optional[str] = None
    calendar_link: Optional[str] = None


class BusinessProfileResponse(BusinessProfileCreate):
    id: str
    is_default: bool
    created_at: str
    updated_at: str


class EmailVariant(BaseModel):
    id: Optional[str] = None
    variant_number: int
    style: str
    style_description: str
    subject: str
    body: str
    quality_score: float
    quality_notes: str


class GenerateEmailsRequest(BaseModel):
    contact_id: str
    business_profile_id: Optional[str] = None
    num_variants: int = Field(default=3, ge=1, le=5)


class GenerateEmailsResponse(BaseModel):
    contact_id: str
    contact_name: str
    company: str
    title: str
    variants: List[EmailVariant]
    generated_at: str
    model_used: str
    total_tokens: int
    estimated_cost: float


class RegenerateEmailRequest(BaseModel):
    contact_id: str
    style: str
    custom_instructions: Optional[str] = None


# ============================================================================
# SUPABASE CLIENT
# ============================================================================

def get_supabase():
    """Get Supabase client"""
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(url, key)


# ============================================================================
# OUTREACH GENERATOR ENGINE
# ============================================================================

class OutreachGenerator:
    """
    AI-powered outreach content generator
    Uses deep enrichment data + business profile for hyper-personalization
    """
    
    def __init__(self):
        self.client = openai_client
        self.model = "gpt-4o"
        self.cost_per_1k_tokens = 0.005  # GPT-4o pricing
    
    def _build_prospect_context(self, contact: Dict, enrichment: Dict) -> str:
        """Build rich prospect context from contact + enrichment data"""
        
        context = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROSPECT INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTACT:
• Name: {contact.get('firstname', '')} {contact.get('lastname', '')}
• Title: {contact.get('title') or 'Unknown'}
• Company: {contact.get('company') or 'Unknown'}
• Email: {contact.get('email', '')}
"""
        
        if not enrichment:
            return context
        
        # Contact Profile Section
        cp = enrichment.get('contact_profile') or {}
        if cp:
            context += "\n\nPROFESSIONAL BACKGROUND:"
            if cp.get('headline'):
                context += f"\n• Headline: {cp['headline']}"
            if cp.get('role_summary'):
                context += f"\n• Role: {cp['role_summary'][:300]}"
            if cp.get('seniority'):
                context += f"\n• Seniority: {cp['seniority']}"
            if cp.get('background_bullets'):
                context += "\n• Background:"
                for b in cp['background_bullets'][:4]:
                    text = b.get('text', '') if isinstance(b, dict) else str(b)
                    if text:
                        context += f"\n  - {text[:150]}"
        
        # Company Profile Section
        comp = enrichment.get('company_profile') or {}
        if comp:
            context += "\n\nCOMPANY INTELLIGENCE:"
            if comp.get('one_liner'):
                context += f"\n• About: {comp['one_liner']}"
            if comp.get('industry'):
                context += f"\n• Industry: {comp['industry']}"
            if comp.get('size_segment'):
                context += f"\n• Size: {comp['size_segment']}"
            if comp.get('region'):
                context += f"\n• Region: {comp['region']}"
            if comp.get('key_products_or_services'):
                products = []
                for p in comp['key_products_or_services'][:3]:
                    text = p.get('text', '') if isinstance(p, dict) else str(p)
                    if text:
                        products.append(text)
                if products:
                    context += f"\n• Products/Services: {', '.join(products)}"
        
        # Buying Signals Section (GOLD for personalization)
        signals = enrichment.get('buying_signals') or {}
        if signals:
            context += "\n\n🎯 BUYING SIGNALS (Use these for personalization!):"
            if signals.get('recent_news'):
                for n in signals['recent_news'][:2]:
                    text = n.get('text', '') if isinstance(n, dict) else str(n)
                    if text:
                        context += f"\n• Recent News: {text[:200]}"
            if signals.get('timing_triggers'):
                for t in signals['timing_triggers'][:2]:
                    text = t.get('text', '') if isinstance(t, dict) else str(t)
                    if text:
                        context += f"\n• Timing Trigger: {text[:200]}"
            if signals.get('hiring_signals'):
                for h in signals['hiring_signals'][:2]:
                    text = h.get('text', '') if isinstance(h, dict) else str(h)
                    if text:
                        context += f"\n• Hiring Signal: {text[:150]}"
            if signals.get('tech_changes'):
                for tc in signals['tech_changes'][:2]:
                    text = tc.get('text', '') if isinstance(tc, dict) else str(tc)
                    if text:
                        context += f"\n• Tech Change: {text[:150]}"
        
        # Current Focus Section
        focus = enrichment.get('current_focus') or {}
        if focus:
            context += "\n\nSTRATEGIC PRIORITIES:"
            if focus.get('strategic_initiatives'):
                for i in focus['strategic_initiatives'][:2]:
                    text = i.get('text', '') if isinstance(i, dict) else str(i)
                    if text:
                        context += f"\n• Initiative: {text[:200]}"
            if focus.get('primary_kpis'):
                for k in focus['primary_kpis'][:2]:
                    text = k.get('text', '') if isinstance(k, dict) else str(k)
                    if text:
                        context += f"\n• KPI Focus: {text[:150]}"
        
        # Risks & Objections (helps craft messaging)
        risks = enrichment.get('risks_and_objections') or {}
        if risks:
            context += "\n\n⚠️ LIKELY OBJECTIONS (Address proactively):"
            if risks.get('likely_objections'):
                for o in risks['likely_objections'][:2]:
                    text = o.get('text', '') if isinstance(o, dict) else str(o)
                    if text:
                        context += f"\n• {text[:150]}"
        
        # Messaging hints from enrichment
        messaging = enrichment.get('messaging') or {}
        if messaging:
            context += "\n\n💡 AI-SUGGESTED ANGLES:"
            if messaging.get('cold_openers'):
                for op in messaging['cold_openers'][:2]:
                    text = op.get('text', '') if isinstance(op, dict) else str(op)
                    if text:
                        context += f"\n• Opener idea: {text[:150]}"
            if messaging.get('value_props'):
                for vp in messaging['value_props'][:2]:
                    text = vp.get('text', '') if isinstance(vp, dict) else str(vp)
                    if text:
                        context += f"\n• Value angle: {text[:150]}"
        
        return context
    
    def _build_business_context(self, profile: Dict) -> str:
        """Build business context from user's profile"""
        
        context = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR BUSINESS (Use this to craft value propositions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Company: {profile.get('company_name', 'Your Company')}
"""
        if profile.get('tagline'):
            context += f"Tagline: {profile['tagline']}\n"
        
        context += f"""
What You Do: {profile.get('what_you_do', '')}
Who You Serve: {profile.get('target_audience', '')}
Key Value Prop: {profile.get('primary_value_prop', '')}
"""
        
        if profile.get('unique_approach'):
            context += f"Unique Approach: {profile['unique_approach']}\n"
        
        if profile.get('key_features'):
            features = profile['key_features'][:5]
            if features:
                context += f"Key Features: {', '.join(features)}\n"
        
        # Case studies are powerful
        case_studies = profile.get('case_studies', [])
        if case_studies:
            context += "\nPROOF POINTS (Reference these for credibility):"
            for cs in case_studies[:3]:
                if isinstance(cs, dict):
                    client = cs.get('client', 'Client')
                    result = cs.get('result', '')
                    metric = cs.get('metric', '')
                    context += f"\n• {client}: {result}"
                    if metric:
                        context += f" ({metric})"
        
        if profile.get('notable_clients'):
            clients = profile['notable_clients'][:5]
            if clients:
                context += f"\n\nNotable Clients: {', '.join(clients)}"
        
        context += f"\n\nTone: {profile.get('tone', 'professional')}"
        
        if profile.get('sender_name'):
            context += f"\n\nSender: {profile['sender_name']}"
            if profile.get('sender_title'):
                context += f", {profile['sender_title']}"
        
        return context
    
    def _get_email_approaches(self, num_variants: int) -> List[Dict]:
        """Define email generation approaches - each is a proven framework"""
        
        approaches = [
            {
                "style": "problem_agitate_solve",
                "name": "Problem-Agitate-Solve",
                "description": "Lead with a relevant problem, acknowledge its impact, present your solution",
                "emoji": "🎯",
                "instructions": """
FRAMEWORK: Problem → Agitate → Solve

1. PROBLEM: Open with a specific problem they likely face based on their role/industry
   - Use intel from their profile to make it relevant
   - Be specific, not generic

2. AGITATE: Briefly acknowledge the impact (1 sentence max)
   - What does this problem cost them? Time? Revenue? Stress?

3. SOLVE: Mention how similar companies addressed this
   - Reference your proof points if relevant
   - Don't pitch hard - hint at the solution

4. CTA: End with a soft, low-pressure question
   - "Is this something you're thinking about?"
   - "Worth a quick chat?"
"""
            },
            {
                "style": "social_proof",
                "name": "Social Proof Lead",
                "description": "Lead with relevant success story, build credibility through results",
                "emoji": "🏆",
                "instructions": """
FRAMEWORK: Similar Success → Connection → Offer

1. HOOK: Reference a similar company/person success story
   - Make it relevant to THEIR industry/role/situation
   - Include a specific metric if possible

2. CONNECT: Bridge that success to their situation
   - "Noticed [company] is also..." 
   - Show you understand their world

3. RELEVANCE: Why this matters to them specifically
   - Reference something from their profile/company

4. CTA: Offer to share more details
   - "Happy to share how they did it if useful"
   - "Would the playbook be helpful?"
"""
            },
            {
                "style": "value_first",
                "name": "Value-First Consultative", 
                "description": "Lead with genuine value, no strings attached, build rapport",
                "emoji": "🎁",
                "instructions": """
FRAMEWORK: Give → Relate → Ask

1. GIVE: Offer something genuinely useful upfront
   - An insight about their industry
   - A resource that would help them
   - A benchmark or data point
   - An intro to someone (if you can)
   - NO STRINGS ATTACHED

2. RELATE: Show you understand their situation
   - Reference something specific from their profile
   - Demonstrate you did real research

3. ASK: Simple question to gauge interest
   - "Would this be valuable?"
   - "Curious if this resonates?"
   - NOT "Can we schedule a call?"
"""
            },
            {
                "style": "trigger_event",
                "name": "Trigger Event Response",
                "description": "Reference specific recent news/event as natural conversation starter",
                "emoji": "📰",
                "instructions": """
FRAMEWORK: Event → Implication → Bridge → Question

1. EVENT: Reference a SPECIFIC recent trigger
   - Recent news about their company
   - New role/promotion
   - Funding announcement
   - Hiring surge
   - Product launch
   - USE THE BUYING SIGNALS FROM THEIR PROFILE

2. IMPLICATION: What this might mean for them
   - New challenges they might face
   - Opportunities to capitalize on

3. BRIDGE: How you've helped others in similar moments
   - Brief, not pitchy

4. QUESTION: Thoughtful question about their priorities
   - "How are you thinking about X given [event]?"
"""
            },
            {
                "style": "curiosity_gap",
                "name": "Curiosity Gap",
                "description": "Create intrigue with a pattern interrupt, make them want to know more",
                "emoji": "🤔",
                "instructions": """
FRAMEWORK: Pattern Interrupt → Intrigue → Payoff Hint

1. PATTERN INTERRUPT: Start with something unexpected
   - A surprising stat relevant to them
   - A counterintuitive observation
   - Something that makes them think "wait, what?"

2. INTRIGUE: Build curiosity without giving everything away
   - "Most [their role] assume X, but..."
   - "The companies growing fastest in [industry] are doing something different..."

3. PAYOFF HINT: Suggest you have the answer
   - Don't reveal everything
   - Make them want to respond to learn more

4. CTA: Invite them to satisfy their curiosity
   - "Curious if you've seen this too?"
   - "Happy to share what we found"
"""
            }
        ]
        
        return approaches[:num_variants]
    
    async def generate_emails(
        self,
        contact: Dict,
        enrichment: Dict,
        business_profile: Dict,
        num_variants: int = 3
    ) -> Tuple[List[EmailVariant], int]:
        """Generate email variants for a contact"""
        
        if not self.client:
            raise HTTPException(
                status_code=500, 
                detail="OpenAI API key not configured. Add OPENAI_API_KEY to environment."
            )
        
        prospect_context = self._build_prospect_context(contact, enrichment)
        business_context = self._build_business_context(business_profile)
        approaches = self._get_email_approaches(num_variants)
        
        first_name = contact.get('firstname', 'there')
        sender_name = business_profile.get('sender_name', 'Your Name')
        
        variants = []
        total_tokens = 0
        
        for i, approach in enumerate(approaches, 1):
            prompt = f"""
You are a world-class B2B sales copywriter known for emails that get 40%+ reply rates.
Your emails are hyper-personalized, concise, and sound like a real human wrote them.

{prospect_context}

{business_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL FRAMEWORK: {approach['emoji']} {approach['name']}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{approach['instructions']}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL REQUIREMENTS (Follow these exactly)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ DO:
• Reference something SPECIFIC from the prospect intelligence above
• Keep the body under 80 words (short emails get more replies)
• Use natural, conversational language
• End with a soft question (not a hard pitch for a meeting)
• Use "{first_name}" in greeting (first name only)
• Sign with just "{sender_name}" (no full signature block)

❌ DON'T:
• Use generic openers: "I hope this finds you well", "I wanted to reach out", "I came across your profile"
• Use corporate buzzwords: "synergy", "leverage", "world-class", "cutting-edge", "revolutionary"
• Make it about you: Start with "I" or "We" as the first word
• Be vague: Every sentence should have a specific detail
• Ask for a meeting in the first email: Earn the right first

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (Follow exactly)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subject: [5-8 words, compelling but not clickbait, lowercase except proper nouns]

[email body - conversational, personal, 60-80 words max]

{sender_name}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write the email now:
"""
            
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "system",
                            "content": """You write hyper-personalized B2B sales emails that consistently achieve 40%+ reply rates. 

Your secret: You never use templates. Every email is crafted specifically for that one person using real research about them and their company. You write like a helpful peer, not a salesperson.

Your emails are SHORT (under 80 words), SPECIFIC (reference real details), and HUMAN (conversational, not corporate)."""
                        },
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.75,
                    max_tokens=500
                )
                
                content = response.choices[0].message.content.strip()
                total_tokens += response.usage.total_tokens
                
                # Parse subject and body
                subject, body = self._parse_email(content, sender_name)
                
                # Validate quality
                quality_score, quality_notes = self._validate_email(subject, body, first_name)
                
                variants.append(EmailVariant(
                    variant_number=i,
                    style=approach['style'],
                    style_description=approach['description'],
                    subject=subject,
                    body=body,
                    quality_score=quality_score,
                    quality_notes=quality_notes
                ))
                
                logger.info(f"✅ Generated variant {i}/{num_variants}: {approach['name']} (score: {quality_score})")
                
            except Exception as e:
                logger.error(f"❌ Error generating {approach['name']}: {e}")
                variants.append(EmailVariant(
                    variant_number=i,
                    style=approach['style'],
                    style_description=approach['description'],
                    subject=f"Quick thought about {contact.get('company', 'your team')}",
                    body=f"Hi {first_name},\n\n[Generation failed - please retry]\n\n{sender_name}",
                    quality_score=0,
                    quality_notes=f"Generation failed: {str(e)}"
                ))
        
        return variants, total_tokens
    
    def _parse_email(self, content: str, sender_name: str) -> Tuple[str, str]:
        """Parse subject and body from generated content"""
        subject = ""
        body_lines = []
        in_body = False
        
        lines = content.strip().split('\n')
        
        for line in lines:
            line_lower = line.lower().strip()
            
            # Find subject line
            if line_lower.startswith('subject:'):
                subject = line.split(':', 1)[1].strip()
                in_body = True
                continue
            
            # Skip empty lines right after subject
            if in_body and not body_lines and not line.strip():
                continue
            
            # Collect body lines
            if in_body:
                body_lines.append(line)
        
        body = '\n'.join(body_lines).strip()
        
        # Clean up
        if not subject:
            subject = "Quick thought"
        
        # Remove any markdown formatting
        subject = re.sub(r'\*\*|\*|__|_', '', subject)
        body = re.sub(r'\*\*|\*|__|_', '', body)
        
        # Ensure signature
        if sender_name and sender_name not in body:
            body = body.rstrip() + f"\n\n{sender_name}"
        
        return subject.strip(), body.strip()
    
    def _validate_email(self, subject: str, body: str, first_name: str) -> Tuple[float, str]:
        """Validate email quality, return (score 0-100, notes)"""
        
        score = 100.0
        issues = []
        bonuses = []
        
        body_lower = body.lower()
        subject_lower = subject.lower()
        full_text = f"{subject_lower} {body_lower}"
        
        # === PENALTIES ===
        
        # Generic openers (MAJOR penalty - these kill response rates)
        generic_openers = [
            ('i hope this email finds you', -30),
            ('i hope this finds you', -30),
            ('i hope you are doing well', -25),
            ('i hope you\'re doing well', -25),
            ('i am reaching out', -25),
            ('i\'m reaching out', -25),
            ('i wanted to reach out', -25),
            ('i came across your profile', -20),
            ('i came across your company', -20),
            ('i noticed your profile', -15),
            ('we help companies', -20),
            ('we work with companies', -15),
        ]
        
        for phrase, penalty in generic_openers:
            if phrase in body_lower:
                score += penalty
                issues.append(f"Generic opener: '{phrase}'")
                break  # Only penalize once for openers
        
        # Corporate buzzwords
        buzzwords = [
            ('synergy', -15),
            ('leverage', -10),
            ('world-class', -15),
            ('best-in-class', -15),
            ('industry-leading', -15),
            ('cutting-edge', -10),
            ('revolutionary', -15),
            ('game-changing', -10),
            ('disruptive', -10),
            ('robust solution', -10),
        ]
        
        for word, penalty in buzzwords:
            if word in full_text:
                score += penalty
                issues.append(f"Buzzword: '{word}'")
        
        # Starting with "I" or "We" (self-centered)
        body_stripped = body.strip()
        if body_stripped:
            # Get first word after greeting
            lines = body_stripped.split('\n')
            for line in lines:
                if line.strip() and not line.strip().lower().startswith(('hi', 'hey', 'hello', first_name.lower())):
                    first_word = line.strip().split()[0].lower() if line.strip().split() else ''
                    if first_word in ['i', 'i\'m', 'i\'ve', 'we', 'we\'re', 'we\'ve', 'my', 'our']:
                        score -= 10
                        issues.append(f"Starts with '{first_word}' (self-centered)")
                    break
        
        # Length penalties
        word_count = len(body.split())
        if word_count > 120:
            score -= 20
            issues.append(f"Too long ({word_count} words, aim for <80)")
        elif word_count > 100:
            score -= 10
            issues.append(f"Slightly long ({word_count} words)")
        elif word_count < 30:
            score -= 15
            issues.append(f"Too short ({word_count} words)")
        
        # No question/CTA
        if '?' not in body:
            score -= 15
            issues.append("No question or soft CTA")
        
        # No personalization detected (basic check)
        personalization_signals = [first_name.lower(), 'your company', 'your team', 'your role', 'noticed', 'saw that', 'congrats']
        has_personalization = any(sig in body_lower for sig in personalization_signals)
        if not has_personalization:
            score -= 10
            issues.append("Low personalization detected")
        
        # === BONUSES ===
        
        # Concise (sweet spot is 60-80 words)
        if 50 <= word_count <= 80:
            score += 5
            bonuses.append("Great length (60-80 words)")
        
        # Has specific details (numbers, names, etc.)
        if re.search(r'\d+%|\$\d+|\d+ (year|month|day|week)', body_lower):
            score += 5
            bonuses.append("Includes specific metrics")
        
        # Personalized greeting
        if first_name.lower() in body_lower[:50]:
            score += 3
            bonuses.append("Personalized greeting")
        
        # Soft CTA (not pushy)
        soft_ctas = ['worth', 'curious', 'thoughts', 'resonate', 'relevant', 'helpful', 'interested']
        if any(cta in body_lower for cta in soft_ctas):
            score += 5
            bonuses.append("Soft CTA detected")
        
        # Cap score
        score = max(0, min(100, score))
        
        # Build notes
        notes_parts = []
        if issues:
            notes_parts.append("Issues: " + "; ".join(issues))
        if bonuses:
            notes_parts.append("Good: " + "; ".join(bonuses))
        if not notes_parts:
            notes_parts.append("✓ Looks good!")
        
        return round(score, 1), " | ".join(notes_parts)


# ============================================================================
# API ENDPOINTS - BUSINESS PROFILE
# ============================================================================

@router.get("/business-profile")
async def get_business_profile():
    """Get the default business profile"""
    try:
        supabase = get_supabase()
        
        res = supabase.table("business_profiles")\
            .select("*")\
            .eq("is_default", True)\
            .execute()
        
        if res.data:
            return {"profile": res.data[0], "exists": True}
        return {"profile": None, "exists": False}
        
    except Exception as e:
        logger.error(f"Error fetching business profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/business-profile")
async def save_business_profile(profile: BusinessProfileCreate):
    """Create or update the default business profile"""
    try:
        supabase = get_supabase()
        
        data = {
            "company_name": profile.company_name,
            "tagline": profile.tagline,
            "what_you_do": profile.what_you_do,
            "target_audience": profile.target_audience,
            "primary_value_prop": profile.primary_value_prop,
            "unique_approach": profile.unique_approach,
            "key_features": profile.key_features,
            "case_studies": [cs.dict() for cs in profile.case_studies],
            "notable_clients": profile.notable_clients,
            "tone": profile.tone,
            "sender_name": profile.sender_name,
            "sender_title": profile.sender_title,
            "sender_email": profile.sender_email,
            "calendar_link": profile.calendar_link,
            "is_default": True,
            "updated_at": datetime.now().isoformat()
        }
        
        # Check if exists
        existing = supabase.table("business_profiles")\
            .select("id")\
            .eq("is_default", True)\
            .execute()
        
        if existing.data:
            res = supabase.table("business_profiles")\
                .update(data)\
                .eq("id", existing.data[0]["id"])\
                .execute()
        else:
            data["created_at"] = datetime.now().isoformat()
            res = supabase.table("business_profiles")\
                .insert(data)\
                .execute()
        
        return {"profile": res.data[0], "message": "Profile saved successfully"}
        
    except Exception as e:
        logger.error(f"Error saving business profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# API ENDPOINTS - EMAIL GENERATION
# ============================================================================

@router.post("/generate-emails", response_model=GenerateEmailsResponse)
async def generate_emails(request: GenerateEmailsRequest):
    """Generate personalized email variants for a contact"""
    try:
        supabase = get_supabase()
        
        # Fetch contact
        contact_res = supabase.table("contacts")\
            .select("*")\
            .eq("id", request.contact_id)\
            .execute()
        
        if not contact_res.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact = contact_res.data[0]
        
        # Extract enrichment data
        enrichment = {}
        if contact.get("enrichment_data"):
            ed = contact["enrichment_data"]
            # Handle nested structure
            if isinstance(ed, dict):
                if ed.get("data"):
                    enrichment = ed["data"]
                elif ed.get("contact_profile"):
                    enrichment = ed
        
        # Fetch business profile
        profile_res = supabase.table("business_profiles")\
            .select("*")\
            .eq("is_default", True)\
            .execute()
        
        if not profile_res.data:
            raise HTTPException(
                status_code=400,
                detail="No business profile found. Please complete your business profile in Settings first."
            )
        
        business_profile = profile_res.data[0]
        
        # Generate emails
        generator = OutreachGenerator()
        variants, total_tokens = await generator.generate_emails(
            contact=contact,
            enrichment=enrichment,
            business_profile=business_profile,
            num_variants=request.num_variants
        )
        
        # Save to database
        for variant in variants:
            supabase.table("outreach_content").insert({
                "contact_id": request.contact_id,
                "business_profile_id": business_profile["id"],
                "content_type": "email",
                "variant_number": variant.variant_number,
                "subject": variant.subject,
                "body": variant.body,
                "style": variant.style,
                "style_description": variant.style_description,
                "quality_score": variant.quality_score,
                "quality_notes": variant.quality_notes,
                "model_used": "gpt-4o",
                "tokens_used": total_tokens // request.num_variants
            }).execute()
        
        # Update contact
        supabase.table("contacts").update({
            "outreach_generated": True,
            "outreach_generated_at": datetime.now().isoformat(),
            "emails_generated": request.num_variants
        }).eq("id", request.contact_id).execute()
        
        # Calculate cost
        estimated_cost = (total_tokens / 1000) * 0.005
        
        return GenerateEmailsResponse(
            contact_id=request.contact_id,
            contact_name=f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip(),
            company=contact.get("company", "Unknown"),
            title=contact.get("title", "Unknown"),
            variants=variants,
            generated_at=datetime.now().isoformat(),
            model_used="gpt-4o",
            total_tokens=total_tokens,
            estimated_cost=round(estimated_cost, 4)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating emails: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/emails/{contact_id}")
async def get_contact_emails(contact_id: str):
    """Get all generated emails for a contact"""
    try:
        supabase = get_supabase()
        
        res = supabase.table("outreach_content")\
            .select("*")\
            .eq("contact_id", contact_id)\
            .eq("content_type", "email")\
            .order("created_at", desc=True)\
            .execute()
        
        return {"emails": res.data, "count": len(res.data)}
        
    except Exception as e:
        logger.error(f"Error fetching emails: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/emails/{email_id}")
async def delete_email(email_id: str):
    """Delete a generated email"""
    try:
        supabase = get_supabase()
        
        supabase.table("outreach_content")\
            .delete()\
            .eq("id", email_id)\
            .execute()
        
        return {"message": "Email deleted"}
        
    except Exception as e:
        logger.error(f"Error deleting email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/emails/{email_id}/favorite")
async def toggle_favorite(email_id: str):
    """Toggle favorite status for an email"""
    try:
        supabase = get_supabase()
        
        # Get current status
        current = supabase.table("outreach_content")\
            .select("is_favorite")\
            .eq("id", email_id)\
            .execute()
        
        if not current.data:
            raise HTTPException(status_code=404, detail="Email not found")
        
        new_status = not current.data[0].get("is_favorite", False)
        
        res = supabase.table("outreach_content")\
            .update({"is_favorite": new_status})\
            .eq("id", email_id)\
            .execute()
        
        return {"is_favorite": new_status}
        
    except Exception as e:
        logger.error(f"Error toggling favorite: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/emails/{email_id}/sent")
async def mark_as_sent(email_id: str):
    """Mark an email as sent"""
    try:
        supabase = get_supabase()
        
        res = supabase.table("outreach_content")\
            .update({
                "is_sent": True,
                "sent_at": datetime.now().isoformat()
            })\
            .eq("id", email_id)\
            .execute()
        
        return {"message": "Marked as sent", "sent_at": datetime.now().isoformat()}
        
    except Exception as e:
        logger.error(f"Error marking as sent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def outreach_health():
    """Check outreach module health"""
    return {
        "status": "ok",
        "openai_configured": OPENAI_API_KEY is not None,
        "model": "gpt-4o",
        "timestamp": datetime.now().isoformat()
    }
