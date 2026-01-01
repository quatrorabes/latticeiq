"""
LatticeIQ Enrichment V3 - Synthesizer
Combines parallel query results into structured intelligence
"""
import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

from .parallel_enricher import EnrichmentResult

logger = logging.getLogger(__name__)

@dataclass
class SynthesizedProfile:
    """Structured output from synthesis"""
    profile_summary: str
    company_summary: str
    why_buy_now: str
    hook_angle: str
    opening_line: str
    talking_points: List[str]
    likely_objections: List[str]
    objection_handlers: Dict[str, str]
    deal_triggers: List[str]
    timing_signals: List[str]
    company_data: Dict[str, Any]
    person_data: Dict[str, Any]
    industry_data: Dict[str, Any]
    confidence_score: float
    sources_count: int
    # APEX Scores
    apex_score: int
    bant_budget: int
    bant_authority: int
    bant_need: int
    bant_timing: int

SYNTHESIS_PROMPT = """
You are a senior sales intelligence analyst. Synthesize the following research into actionable sales intelligence.

CONTACT: {contact_name} - {contact_title} at {contact_company}
INDUSTRY: {vertical}

═══════════════════════════════════════════════════════════════════════════════
RESEARCH DATA:
═══════════════════════════════════════════════════════════════════════════════

COMPANY INTELLIGENCE:
{company_data}

PERSON INTELLIGENCE:
{person_data}

INDUSTRY INTELLIGENCE:
{industry_data}

NEWS & TRIGGERS:
{news_data}

SALES ANGLES:
{open_ended_data}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS:
═══════════════════════════════════════════════════════════════════════════════

Return a JSON object with EXACTLY this structure:
{{
    "profile_summary": "2-3 sentence executive summary of this prospect",
    "company_summary": "Key facts about the company (revenue, size, stage)",
    "why_buy_now": "Specific reasons they would be receptive NOW",
    "hook_angle": "The single best angle to lead with",
    "opening_line": "Specific cold call opener (under 20 words)",
    "talking_points": ["point 1", "point 2", "point 3"],
    "likely_objections": ["objection 1", "objection 2"],
    "objection_handlers": {{
        "objection 1": "response to objection 1",
        "objection 2": "response to objection 2"
    }},
    "deal_triggers": ["trigger 1", "trigger 2"],
    "timing_signals": ["signal 1", "signal 2"],
    "company_data": {{
        "revenue": "extracted or estimated",
        "employee_count": "number",
        "funding_stage": "stage",
        "headquarters": "location",
        "tech_stack": ["tech1", "tech2"]
    }},
    "person_data": {{
        "years_in_role": "number or estimate",
        "previous_companies": ["company1", "company2"],
        "education": "summary",
        "expertise": ["area1", "area2"]
    }},
    "industry_data": {{
        "trends": ["trend1", "trend2"],
        "challenges": ["challenge1", "challenge2"],
        "market_outlook": "summary"
    }},
    "apex_score": 75,
    "bant_budget": 7,
    "bant_authority": 8,
    "bant_need": 6,
    "bant_timing": 7,
    "confidence_score": 0.85
}}

SCORING GUIDE:
- apex_score (1-100): Overall prospect quality
- bant_budget (1-10): Company size/funding = ability to pay
- bant_authority (1-10): Title seniority (VP+ = 8+, Director = 6-7, Manager = 4-5)
- bant_need (1-10): Pain points alignment with solutions
- bant_timing (1-10): Recent changes, growth signals, urgency indicators

Be specific. Avoid generic advice. Base everything on the research data provided.
"""

class EnrichmentSynthesizer:
    """Synthesizes parallel query results using GPT-4"""

    def __init__(self, openai_api_key: Optional[str] = None):
        self.api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY required for synthesis")
        self.base_url = "https://api.openai.com/v1/chat/completions"

    async def synthesize(
        self,
        enrichment_result: EnrichmentResult,
        contact: Dict[str, Any]
    ) -> SynthesizedProfile:
        """Combine query results into structured profile"""
        raw_data = enrichment_result.synthesized_data

        contact_name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()

        prompt = SYNTHESIS_PROMPT.format(
            contact_name=contact_name or "Unknown",
            contact_title=contact.get("title", "Executive"),
            contact_company=contact.get("company", "Unknown Company"),
            vertical=contact.get("industry", "") or contact.get("vertical", "Business Services"),
            company_data=raw_data.get("company", {}).get("content", "No data available"),
            person_data=raw_data.get("person", {}).get("content", "No data available"),
            industry_data=raw_data.get("industry", {}).get("content", "No data available"),
            news_data=raw_data.get("news", {}).get("content", "No data available"),
            open_ended_data=raw_data.get("open_ended", {}).get("content", "No data available"),
        )

        synthesized_json = await self._call_openai(prompt)

        try:
            data = json.loads(synthesized_json)
        except json.JSONDecodeError:
            logger.error("Failed to parse synthesis JSON")
            data = self._get_defaults()

        sources_count = sum(len(r.get("citations", [])) for r in raw_data.values())

        return SynthesizedProfile(
            profile_summary=data.get("profile_summary", ""),
            company_summary=data.get("company_summary", ""),
            why_buy_now=data.get("why_buy_now", ""),
            hook_angle=data.get("hook_angle", ""),
            opening_line=data.get("opening_line", ""),
            talking_points=data.get("talking_points", []),
            likely_objections=data.get("likely_objections", []),
            objection_handlers=data.get("objection_handlers", {}),
            deal_triggers=data.get("deal_triggers", []),
            timing_signals=data.get("timing_signals", []),
            company_data=data.get("company_data", {}),
            person_data=data.get("person_data", {}),
            industry_data=data.get("industry_data", {}),
            confidence_score=data.get("confidence_score", 0.5),
            sources_count=sources_count,
            apex_score=data.get("apex_score", 50),
            bant_budget=data.get("bant_budget", 5),
            bant_authority=data.get("bant_authority", 5),
            bant_need=data.get("bant_need", 5),
            bant_timing=data.get("bant_timing", 5)
        )

    async def _call_openai(self, prompt: str) -> str:
        """Make API call to OpenAI"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "gpt-4o",
            "messages": [
                {"role": "system", "content": "You are a sales intelligence analyst. Always respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 2000,
            "temperature": 0.3,
            "response_format": {"type": "json_object"}
        }

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(self.base_url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

        return data.get("choices", [{}])[0].get("message", {}).get("content", "{}")

    def _get_defaults(self) -> Dict[str, Any]:
        return {
            "profile_summary": "Profile synthesis pending",
            "company_summary": "Company data pending",
            "why_buy_now": "Timing analysis pending",
            "hook_angle": "Hook generation pending",
            "opening_line": "Hi, I noticed your company is growing...",
            "talking_points": [], "likely_objections": [], "objection_handlers": {},
            "deal_triggers": [], "timing_signals": [],
            "company_data": {}, "person_data": {}, "industry_data": {},
            "apex_score": 50, "bant_budget": 5, "bant_authority": 5,
            "bant_need": 5, "bant_timing": 5, "confidence_score": 0.0
        }

def profile_to_dict(profile: SynthesizedProfile) -> Dict[str, Any]:
    """Convert SynthesizedProfile to dict for JSON serialization"""
    return {
        "profile_summary": profile.profile_summary,
        "company_summary": profile.company_summary,
        "why_buy_now": profile.why_buy_now,
        "hook_angle": profile.hook_angle,
        "opening_line": profile.opening_line,
        "talking_points": profile.talking_points,
        "likely_objections": profile.likely_objections,
        "objection_handlers": profile.objection_handlers,
        "deal_triggers": profile.deal_triggers,
        "timing_signals": profile.timing_signals,
        "company_data": profile.company_data,
        "person_data": profile.person_data,
        "industry_data": profile.industry_data,
        "confidence_score": profile.confidence_score,
        "sources_count": profile.sources_count,
        "apex_score": profile.apex_score,
        "bant_budget": profile.bant_budget,
        "bant_authority": profile.bant_authority,
        "bant_need": profile.bant_need,
        "bant_timing": profile.bant_timing
    }
