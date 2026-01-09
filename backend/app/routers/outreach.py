"""
LatticeIQ Outreach Module - AI-Powered Email & Call Script Generation
Generates hyper-personalized outreach using deep enrichment + business profile
"""

import os
import re
import json
import logging
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from openai import AsyncOpenAI
from fastapi.responses import JSONResponse



logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v3/outreach", tags=["outreach"])


# Initialize OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


# ============================================================================
# DISC PERSONALITY FRAMEWORK
# ============================================================================

DISC_APPROACHES = {
    "D": {
        "name": "Dominant",
        "opening": "Get to the point in 10 seconds",
        "pace": "Fast, efficient",
        "focus": "Results and ROI",
        "objection_style": "Direct counter with data",
        "avoid": "Small talk, long explanations",
        "mbti_maps": ["ENTJ", "ESTJ", "ESTP", "INTJ"]
    },
    "I": {
        "name": "Influential",
        "opening": "Build rapport first (20 seconds)",
        "pace": "Conversational, energetic",
        "focus": "People and relationships",
        "objection_style": "Story-based response",
        "avoid": "Too many details, being cold",
        "mbti_maps": ["ENFP", "ENFJ", "ESFP", "ESFJ"]
    },
    "S": {
        "name": "Steady",
        "opening": "Warm, ask about their team",
        "pace": "Patient, supportive",
        "focus": "Stability and support",
        "objection_style": "Reassurance and case studies",
        "avoid": "Pressure, rushing decisions",
        "mbti_maps": ["ISFJ", "ISFP", "INFP", "INFJ"]
    },
    "C": {
        "name": "Conscientious",
        "opening": "Professional, agenda-driven",
        "pace": "Methodical, detailed",
        "focus": "Data and accuracy",
        "objection_style": "Provide detailed proof",
        "avoid": "Vague claims, emotional appeals",
        "mbti_maps": ["ISTJ", "INTP", "ISTP", "INTJ"]
    }
}

SCRIPT_STYLES = {
    1: "Direct & Value-Focused",
    2: "Consultative & Rapport-Building",
    3: "Executive / Insight-Led"
}


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
    style: str = ""
    style_description: str = ""
    subject: str = ""
    body: str = ""
    quality_score: float = 0.0
    quality_notes: str = ""
    is_favorite: Optional[bool] = False
    is_sent: Optional[bool] = False
    sent_at: Optional[str] = None
    created_at: Optional[str] = None


class GenerateEmailsRequest(BaseModel):
    contact_id: str
    business_profile_id: Optional[str] = None
    num_variants: int = Field(default=3, ge=1, le=5)


class GenerateEmailsResponse(BaseModel):
    contact_id: str
    contact_name: str = ""
    company: Optional[str] = ""
    title: Optional[str] = ""
    variants: List[EmailVariant] = Field(default_factory=list)
    generated_at: str = ""
    model_used: str = ""
    total_tokens: int = 0
    estimated_cost: float = 0.0


class RegenerateEmailRequest(BaseModel):
    contact_id: str
    style: str
    custom_instructions: Optional[str] = None


# Call Script Models
class CallScriptVariant(BaseModel):
    id: Optional[str] = None
    variant_number: int
    style: str = ""
    style_description: str = ""
    opener: str = ""
    body: str = ""
    closer: str = ""
    quality_score: float = 0.0
    quality_notes: str = ""
    is_favorite: Optional[bool] = False
    created_at: Optional[str] = None


class PersonalityInfo(BaseModel):
    mbti: Optional[str] = None
    disc: str = ""
    disc_name: str = ""


class GenerateCallScriptsRequest(BaseModel):
    contact_id: str
    business_context: Optional[str] = None
    num_variants: int = Field(default=3, ge=1, le=5)


class GenerateCallScriptsResponse(BaseModel):
    success: bool = True
    contact_id: str
    contact_name: str = ""
    company: Optional[str] = ""
    title: Optional[str] = ""
    personality: Optional[PersonalityInfo] = None
    variants: List[CallScriptVariant] = Field(default_factory=list)
    generated_at: str = ""
    model_used: str = ""
    total_tokens: int = 0
    estimated_cost: float = 0.0



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
# CALL SCRIPT GENERATOR ENGINE
# ============================================================================


class CallScriptGenerator:
    """Generate DISC-optimized cold call scripts"""

    def __init__(self):
        self.perplexity_key = PERPLEXITY_API_KEY
        self.openai_key = OPENAI_API_KEY

    def map_mbti_to_disc(self, mbti: str) -> str:
        """Map Myers-Briggs type to DISC profile"""
        if not mbti:
            return "D"

        mbti = mbti.upper().strip()[:4]

        for disc_type, data in DISC_APPROACHES.items():
            if mbti in data["mbti_maps"]:
                return disc_type

        if mbti.startswith("E"):
            return "I" if "F" in mbti else "D"
        else:
            return "S" if "F" in mbti else "C"

    def extract_personality_from_enrichment(self, enrichment_data: Any) -> Dict:
        """Extract personality info from enrichment text"""
        result = {
            "mbti": None,
            "disc": "D",
            "personality_summary": "",
            "talking_points": []
        }

        if not enrichment_data:
            return result

        if isinstance(enrichment_data, dict):
            enrichment_data = json.dumps(enrichment_data)

        mbti_match = re.search(r'\b([EI][NS][TF][JP])\b', enrichment_data, re.IGNORECASE)
        if mbti_match:
            result["mbti"] = mbti_match.group(1).upper()
            result["disc"] = self.map_mbti_to_disc(result["mbti"])

        personality_section = re.search(
            r'(?:Personality Detail|Myers-Briggs|Personality Profile).*?(?=###|\Z)',
            enrichment_data,
            re.IGNORECASE | re.DOTALL
        )
        if personality_section:
            result["personality_summary"] = personality_section.group(0)[:500]

        talking_points_section = re.search(
            r'(?:Sales Opportunity|Talking Points).*?(?=###|---|\Z)',
            enrichment_data,
            re.IGNORECASE | re.DOTALL
        )
        if talking_points_section:
            points = re.findall(r'[-•]\s*(.+)', talking_points_section.group(0))
            result["talking_points"] = points[:5]

        return result

    def generate_script(self, contact: Dict, variant: int, business_context: str = "") -> str:
        """Generate a single call script variant"""

        name = f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip()
        if not name:
            name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        title = contact.get('title') or contact.get('job_title', '')
        company = contact.get('company', '')

        enrichment = contact.get('deep_enrichment_data') or contact.get('enrichment_data') or ""
        if isinstance(enrichment, dict):
            enrichment = json.dumps(enrichment)

        personality = self.extract_personality_from_enrichment(enrichment)
        disc = personality["disc"]
        approach = DISC_APPROACHES[disc]
        style = SCRIPT_STYLES[variant]

        intel = enrichment[:1500] if enrichment else f"{name} is {title} at {company}"

        prompt = f"""You are writing a {style} cold-call script for {name}, {title} at {company}.

PERSONALITY TYPE: {disc} ({approach['name']}) - {approach['focus']}
OPENING STYLE: {approach['opening']}
PACE: {approach['pace']}
MBTI: {personality.get('mbti', 'Unknown')}

INTELLIGENCE ON THIS CONTACT:
{intel}

BUSINESS CONTEXT (what we sell):
{business_context or "B2B sales intelligence and outreach platform"}

GOAL: Book a 15-minute discovery call.

Format your response EXACTLY as:

════════════════════════════════════════════════════════════════
CALL SCRIPT – {style}
{name} | {title} | {company}
Personality: {disc}-Type ({approach['name']})
════════════════════════════════════════════════════════════════

📞 OPENER (10 seconds):
[{approach['opening']} - use specific intel about them]

🎯 HOOK / VALUE PROP:
[1 sentence identifying their likely pain point]
[1 sentence showing outcome/benefit]

❓ DISCOVERY QUESTIONS:
• [Question 1 aligned with {disc} personality style]
• [Question 2 about their current process]
• [Question 3 about timing/urgency]

🛡️ OBJECTION HANDLING:

IF "Not interested":
→ [{approach['objection_style']}]

IF "Send me info":
→ [Response matching {disc} style - don't just comply]

IF "Too busy right now":
→ [Response respecting their {approach['pace']}]

IF "We already have a solution":
→ [Curious response, not defensive]

✅ CLOSE:
[Propose specific times - match {disc} preference]
[Alternative: softer next step if needed]

📝 PERSONALITY REMINDERS:
• DO: {approach['focus']}
• DON'T: {approach['avoid']}
• PACE: {approach['pace']}

════════════════════════════════════════════════════════════════
"""

        if self.perplexity_key:
            try:
                response = requests.post(
                    "https://api.perplexity.ai/chat/completions",
                    json={
                        "model": "sonar",
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 1000,
                        "temperature": 0.7
                    },
                    headers={"Authorization": f"Bearer {self.perplexity_key}"},
                    timeout=45
                )
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"].strip()
            except Exception as e:
                logger.warning(f"Perplexity call failed, trying OpenAI: {e}")

        if self.openai_key:
            try:
                import openai
                client = openai.OpenAI(api_key=self.openai_key)
                response = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=1000,
                    temperature=0.7
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                logger.error(f"OpenAI call failed: {e}")

        return self._fallback_script(name, title, company, variant, disc, approach)

    def _fallback_script(self, name: str, title: str, company: str,
                         variant: int, disc: str, approach: Dict) -> str:
        """Fallback template if APIs fail"""
        first_name = name.split()[0] if name else "there"
        return f"""
════════════════════════════════════════════════════════════════
CALL SCRIPT – {SCRIPT_STYLES[variant]}
{name} | {title} | {company}
Personality: {disc}-Type ({approach['name']})
════════════════════════════════════════════════════════════════

📞 OPENER:
"Hi {first_name}, this is [Your Name] with [Company]. I know you're busy so I'll be brief..."

🎯 HOOK / VALUE PROP:
"We help {title}s like yourself [specific benefit]. Companies like {company} typically see [outcome]."

❓ DISCOVERY QUESTIONS:
• "What's your current process for [area]?"
• "What would make the biggest impact for you right now?"
• "Who else should be involved in this conversation?"

🛡️ OBJECTION HANDLING:

IF "Not interested":
→ "{approach['objection_style']}"

IF "Send me info":
→ "Happy to - what specifically would be most relevant to you?"

IF "Too busy":
→ "Totally understand - when would be a better time?"

IF "We already have a solution":
→ "Makes sense - curious what you're using today?"

✅ CLOSE:
"Would Tuesday at 2pm or Wednesday at 10am work better for a quick 15-minute call?"

📝 PERSONALITY REMINDERS:
• DO: {approach['focus']}
• DON'T: {approach['avoid']}
• PACE: {approach['pace']}

════════════════════════════════════════════════════════════════
"""

    def generate_all_scripts(self, contact: Dict, business_context: str = "") -> Dict:
        """Generate all 3 script variants"""

        name = f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip()
        if not name:
            name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()

        enrichment = contact.get('deep_enrichment_data') or contact.get('enrichment_data') or ""
        if isinstance(enrichment, dict):
            enrichment = json.dumps(enrichment)
        personality = self.extract_personality_from_enrichment(enrichment)

        scripts = []

        for variant in [1, 2, 3]:
            try:
                script_content = self.generate_script(contact, variant, business_context)
                
                # Parse the script into opener/body/closer sections
                opener, body, closer = self._parse_script_sections(script_content)
                
                scripts.append(CallScriptVariant(
                    variant_number=variant,
                    style=SCRIPT_STYLES[variant],
                    style_description=self._get_style_description(variant),
                    opener=opener,
                    body=body,
                    closer=closer,
                    quality_score=8.0,
                    quality_notes="AI-generated DISC-optimized script"
                ))
                logger.info(f"✅ Generated call script variant {variant}")
            except Exception as e:
                logger.error(f"❌ Error generating variant {variant}: {e}")
                scripts.append(CallScriptVariant(
                    variant_number=variant,
                    style=SCRIPT_STYLES[variant],
                    style_description=self._get_style_description(variant),
                    opener=f"Error: {str(e)}",
                    body="Script generation failed. Please try again.",
                    closer="Thank you for your time.",
                    quality_score=0.0,
                    quality_notes=f"Error: {str(e)}"
                ))

        return {
            "success": True,
            "contact_name": name,
            "personality": PersonalityInfo(
                mbti=personality.get("mbti"),
                disc=personality.get("disc"),
                disc_name=DISC_APPROACHES[personality["disc"]]["name"]
            ),
            "scripts": scripts,
            "generated_at": datetime.utcnow().isoformat()
        }

    def _parse_script_sections(self, script_content: str) -> tuple:
        """Parse script content into opener, body, closer sections"""
        
        # Default fallback
        opener = ""
        body = script_content
        closer = ""
        
        # Try to extract sections based on markers
        import re
        
        # Look for OPENER section
        opener_match = re.search(r'(?:📞\s*OPENER|OPENER)[^\n]*\n(.*?)(?=🎯|HOOK|VALUE|❓|DISCOVERY|$)', script_content, re.DOTALL | re.IGNORECASE)
        if opener_match:
            opener = opener_match.group(1).strip()
        
        # Look for middle sections (HOOK + DISCOVERY) as body
        body_parts = []
        
        hook_match = re.search(r'(?:🎯\s*HOOK|HOOK|VALUE PROP)[^\n]*\n(.*?)(?=❓|DISCOVERY|🛡️|OBJECTION|📅|CLOSE|$)', script_content, re.DOTALL | re.IGNORECASE)
        if hook_match:
            body_parts.append(hook_match.group(1).strip())
        
        discovery_match = re.search(r'(?:❓\s*DISCOVERY|DISCOVERY QUESTIONS)[^\n]*\n(.*?)(?=🛡️|OBJECTION|📅|CLOSE|$)', script_content, re.DOTALL | re.IGNORECASE)
        if discovery_match:
            body_parts.append(discovery_match.group(1).strip())
        
        objection_match = re.search(r'(?:🛡️\s*OBJECTION|OBJECTION HANDLING)[^\n]*\n(.*?)(?=📅|CLOSE|$)', script_content, re.DOTALL | re.IGNORECASE)
        if objection_match:
            body_parts.append(objection_match.group(1).strip())
        
        if body_parts:
            body = "\n\n".join(body_parts)
        
        # Look for CLOSE section
        close_match = re.search(r'(?:📅\s*CLOSE|CLOSE|CLOSING)[^\n]*\n(.*?)$', script_content, re.DOTALL | re.IGNORECASE)
        if close_match:
            closer = close_match.group(1).strip()
        
        # If nothing parsed, split roughly into thirds
        if not opener and not closer:
            lines = script_content.strip().split('\n')
            total = len(lines)
            if total >= 6:
                opener = '\n'.join(lines[:total//3])
                body = '\n'.join(lines[total//3:2*total//3])
                closer = '\n'.join(lines[2*total//3:])
            else:
                opener = lines[0] if lines else ""
                body = '\n'.join(lines[1:-1]) if len(lines) > 2 else script_content
                closer = lines[-1] if len(lines) > 1 else ""
        
        return opener or "Hello, this is [Your Name].", body or script_content, closer or "Thank you for your time."

    def _get_style_description(self, variant: int) -> str:
        """Get description for script style"""
        descriptions = {
            1: "Get to the point quickly, focus on results and ROI",
            2: "Build rapport first, focus on relationship and understanding",
            3: "Lead with insights, position yourself as a strategic advisor"
        }
        return descriptions.get(variant, "")




# ============================================================================
# OUTREACH GENERATOR ENGINE (Emails)
# ============================================================================


class OutreachGenerator:
    """
    AI-powered outreach content generator
    Uses deep enrichment data + business profile for hyper-personalization
    """

    def __init__(self):
        self.client = openai_client
        self.model = "gpt-4o"
        self.cost_per_1k_tokens = 0.005

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

        risks = enrichment.get('risks_and_objections') or {}
        if risks:
            context += "\n\n⚠️ LIKELY OBJECTIONS (Address proactively):"
            if risks.get('likely_objections'):
                for o in risks['likely_objections'][:2]:
                    text = o.get('text', '') if isinstance(o, dict) else str(o)
                    if text:
                        context += f"\n• {text[:150]}"

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
        """Define email generation approaches"""

        approaches = [
            {
                "style": "problem_agitate_solve",
                "name": "Problem-Agitate-Solve",
                "description": "Lead with a relevant problem, acknowledge its impact, present your solution",
                "emoji": "🎯",
                "instructions": """
FRAMEWORK: Problem → Agitate → Solve

1. PROBLEM: Open with a specific problem they likely face based on their role/industry
2. AGITATE: Briefly acknowledge the impact (1 sentence max)
3. SOLVE: Mention how similar companies addressed this
4. CTA: End with a soft, low-pressure question
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
2. CONNECT: Bridge that success to their situation
3. RELEVANCE: Why this matters to them specifically
4. CTA: Offer to share more details
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
2. RELATE: Show you understand their situation
3. ASK: Simple question to gauge interest
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
2. IMPLICATION: What this might mean for them
3. BRIDGE: How you've helped others in similar moments
4. QUESTION: Thoughtful question about their priorities
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
2. INTRIGUE: Build curiosity without giving everything away
3. PAYOFF HINT: Suggest you have the answer
4. CTA: Invite them to satisfy their curiosity
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

{prospect_context}

{business_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL FRAMEWORK: {approach['emoji']} {approach['name']}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{approach['instructions']}

✅ DO:
• Reference something SPECIFIC from the prospect intelligence above
• Keep the body under 80 words
• Use natural, conversational language
• End with a soft question
• Use "{first_name}" in greeting
• Sign with just "{sender_name}"

❌ DON'T:
• Use generic openers: "I hope this finds you well"
• Use corporate buzzwords: "synergy", "leverage"
• Start with "I" or "We"
• Ask for a meeting in the first email

OUTPUT FORMAT:
Subject: [5-8 words, compelling but not clickbait]

[email body - 60-80 words max]

{sender_name}

Write the email now:
"""

            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "system",
                            "content": "You write hyper-personalized B2B sales emails that achieve 40%+ reply rates. SHORT, SPECIFIC, and HUMAN."
                        },
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.75,
                    max_tokens=500
                )

                content = response.choices[0].message.content.strip()
                total_tokens += response.usage.total_tokens

                subject, body = self._parse_email(content, sender_name)
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

            if line_lower.startswith('subject:'):
                subject = line.split(':', 1)[1].strip()
                in_body = True
                continue

            if in_body and not body_lines and not line.strip():
                continue

            if in_body:
                body_lines.append(line)

        body = '\n'.join(body_lines).strip()

        if not subject:
            subject = "Quick thought"

        subject = re.sub(r'\*\*|\*|__|_', '', subject)
        body = re.sub(r'\*\*|\*|__|_', '', body)

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

        generic_openers = [
            ('i hope this email finds you', -30),
            ('i hope this finds you', -30),
            ('i am reaching out', -25),
            ('i\'m reaching out', -25),
            ('i wanted to reach out', -25),
            ('i came across your profile', -20),
            ('we help companies', -20),
        ]

        for phrase, penalty in generic_openers:
            if phrase in body_lower:
                score += penalty
                issues.append(f"Generic opener: '{phrase}'")
                break

        buzzwords = [
            ('synergy', -15),
            ('leverage', -10),
            ('world-class', -15),
            ('cutting-edge', -10),
            ('revolutionary', -15),
        ]

        for word, penalty in buzzwords:
            if word in full_text:
                score += penalty
                issues.append(f"Buzzword: '{word}'")

        word_count = len(body.split())
        if word_count > 120:
            score -= 20
            issues.append(f"Too long ({word_count} words)")
        elif word_count > 100:
            score -= 10
            issues.append(f"Slightly long ({word_count} words)")
        elif word_count < 30:
            score -= 15
            issues.append(f"Too short ({word_count} words)")

        if '?' not in body:
            score -= 15
            issues.append("No question or soft CTA")

        if 50 <= word_count <= 80:
            score += 5
            bonuses.append("Great length")

        if re.search(r'\d+%|\$\d+|\d+ (year|month|day|week)', body_lower):
            score += 5
            bonuses.append("Includes specific metrics")

        if first_name.lower() in body_lower[:50]:
            score += 3
            bonuses.append("Personalized greeting")

        soft_ctas = ['worth', 'curious', 'thoughts', 'resonate', 'relevant', 'helpful', 'interested']
        if any(cta in body_lower for cta in soft_ctas):
            score += 5
            bonuses.append("Soft CTA detected")

        score = max(0, min(100, score))

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

        contact_res = supabase.table("contacts")\
            .select("*")\
            .eq("id", request.contact_id)\
            .execute()

        if not contact_res.data:
            raise HTTPException(status_code=404, detail="Contact not found")

        contact = contact_res.data[0]

        enrichment = {}
        if contact.get("enrichment_data"):
            ed = contact["enrichment_data"]
            if isinstance(ed, dict):
                if ed.get("data"):
                    enrichment = ed["data"]
                elif ed.get("contact_profile"):
                    enrichment = ed

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

        generator = OutreachGenerator()
        variants, total_tokens = await generator.generate_emails(
            contact=contact,
            enrichment=enrichment,
            business_profile=business_profile,
            num_variants=request.num_variants
        )

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

        supabase.table("contacts").update({
            "outreach_generated": True,
            "outreach_generated_at": datetime.now().isoformat(),
            "emails_generated": request.num_variants
        }).eq("id", request.contact_id).execute()

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


# ============================================================================
# API ENDPOINTS - CALL SCRIPTS
# ============================================================================

@router.post("/generate-call-scripts")
async def generate_call_scripts(request: GenerateCallScriptsRequest):
    """Generate DISC-optimized call script variants for a contact"""
    try:
        supabase = get_supabase()

        contact_res = supabase.table("contacts")\
            .select("*")\
            .eq("id", request.contact_id)\
            .execute()

        if not contact_res.data:
            raise HTTPException(status_code=404, detail="Contact not found")

        contact = contact_res.data[0]  # ✅ FIX: Get first item, not entire list

        # Get business profile for context
        business_context = ""
        try:
            profile_res = supabase.table("business_profiles")\
                .select("*")\
                .eq("is_default", True)\
                .execute()
            
            if profile_res.data and len(profile_res.data) > 0:
                bp = profile_res.data[0]  # ✅ FIX: Get first item, not entire list
                
                # Handle both dict and object types from Supabase
                if isinstance(bp, dict):
                    company_name = bp.get('company_name', '')
                    what_you_do = bp.get('what_you_do', '')
                    value_prop = bp.get('primary_value_prop', '')
                else:
                    company_name = getattr(bp, 'company_name', '')
                    what_you_do = getattr(bp, 'what_you_do', '')
                    value_prop = getattr(bp, 'primary_value_prop', '')
                
                if company_name or what_you_do or value_prop:
                    business_context = f"{company_name} - {what_you_do}. Value: {value_prop}"
        except Exception as e:
            logger.warning(f"Could not load business profile: {e}")
            business_context = ""

        # Override with request context if provided
        if request.business_context:
            business_context = request.business_context

        generator = CallScriptGenerator()
        result = generator.generate_all_scripts(contact, business_context)

        # Verify result has scripts
        if not result or "scripts" not in result:
            raise HTTPException(status_code=500, detail="Failed to generate scripts")

        # Save scripts to database
        for script in result["scripts"]:
            supabase.table("outreach_content").insert({
                "contact_id": request.contact_id,
                "content_type": "call_script",
                "variant_number": script.variant_number,
                "body": f"OPENER:\n{script.opener}\n\nBODY:\n{script.body}\n\nCLOSER:\n{script.closer}",
                "style": script.style,
                "style_description": script.style_description,
                "model_used": "perplexity/gpt-4o"
            }).execute()

        # ✅ EXPLICIT RETURN with JSONResponse for reliability
        return JSONResponse({
            "success": True,
            "contact_id": request.contact_id,
            "contact_name": result.get("contact_name", ""),
            "company": contact.get("company", "Unknown"),
            "title": contact.get("title", "Unknown"),
            "personality": result.get("personality", {}),
            "scripts": [
                {
                    "variant_number": script.variant_number,
                    "style": script.style,
                    "style_description": script.style_description,
                    "opener": script.opener,
                    "body": script.body,
                    "closer": script.closer,
                    "quality_score": getattr(script, "quality_score", 0.0),
                    "quality_notes": getattr(script, "quality_notes", "AI-generated DISC-optimized")
                }
                for script in result.get("scripts", [])
            ],
            "generated_at": result.get("generated_at", "")
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating call scripts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate call scripts: {str(e)}")


@router.get("/call-scripts/{contact_id}")
async def get_contact_call_scripts(contact_id: str):
    """Get all generated call scripts for a contact"""
    try:
        supabase = get_supabase()

        res = supabase.table("outreach_content")\
            .select("*")\
            .eq("contact_id", contact_id)\
            .eq("content_type", "call_script")\
            .order("created_at", desc=True)\
            .execute()

        return {"scripts": res.data, "count": len(res.data)}

    except Exception as e:
        logger.error(f"Error fetching call scripts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# API ENDPOINTS - EMAIL MANAGEMENT
# ============================================================================


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
        "perplexity_configured": PERPLEXITY_API_KEY is not None,
        "model": "gpt-4o",
        "features": ["emails", "call_scripts"],
        "timestamp": datetime.now().isoformat()
    }
