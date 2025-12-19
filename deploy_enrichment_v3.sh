#!/bin/bash
# LATTICEIQ ENRICHMENT V3 - PARALLEL MULTI-QUERY ARCHITECTURE
# Run from: /Users/chrisrabenold/projects/latticeiq
set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  LATTICEIQ ENRICHMENT V3 - PARALLEL ARCHITECTURE DEPLOYMENT"
echo "═══════════════════════════════════════════════════════════════"

# Create module directory
mkdir -p backend/enrichment_v3

#############################################################################
# FILE 1: __init__.py
#############################################################################
cat << 'INITEOF' > backend/enrichment_v3/__init__.py
"""
LatticeIQ Enrichment V3 - Parallel Multi-Query Architecture
"""
from .parallel_enricher import ParallelEnricher
from .query_templates import ENRICHMENT_QUERIES, EnrichmentQuery, ContactContext
from .synthesizer import EnrichmentSynthesizer

__all__ = [
    "ParallelEnricher",
    "EnrichmentSynthesizer", 
    "ENRICHMENT_QUERIES",
    "EnrichmentQuery",
    "ContactContext"
]
__version__ = "3.0.0"
INITEOF

echo "✓ Created __init__.py"

#############################################################################
# FILE 2: query_templates.py - Domain-Specific Prompts
#############################################################################
cat << 'QUERYEOF' > backend/enrichment_v3/query_templates.py
"""
LatticeIQ Enrichment V3 - Query Templates
Domain-decomposed queries for parallel execution
"""
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class QueryDomain(Enum):
    COMPANY = "company"
    PERSON = "person"
    INDUSTRY = "industry"
    NEWS = "news"
    OPEN_ENDED = "open_ended"

@dataclass
class EnrichmentQuery:
    """Single enrichment query definition"""
    domain: QueryDomain
    query_template: str
    fields_to_extract: List[str]
    system_prompt: Optional[str] = None
    ttl_hours: int = 24
    priority: int = 1
    timeout_seconds: int = 30

@dataclass
class ContactContext:
    """Normalized contact data for query formatting"""
    first_name: str = ""
    last_name: str = ""
    full_name: str = ""
    title: str = ""
    company: str = ""
    email: str = ""
    vertical: str = ""
    linkedin_url: str = ""

    @classmethod
    def from_dict(cls, data: dict) -> "ContactContext":
        first = data.get("first_name", "")
        last = data.get("last_name", "")
        return cls(
            first_name=first,
            last_name=last,
            full_name=f"{first} {last}".strip(),
            title=data.get("title", ""),
            company=data.get("company", ""),
            email=data.get("email", ""),
            vertical=data.get("industry", "") or data.get("vertical", ""),
            linkedin_url=data.get("linkedin_url", "")
        )

# ═══════════════════════════════════════════════════════════════════════════
# QUERY DEFINITIONS - Each runs as independent Perplexity search
# ═══════════════════════════════════════════════════════════════════════════

ENRICHMENT_QUERIES: List[EnrichmentQuery] = [
    # Q1: COMPANY INTELLIGENCE
    EnrichmentQuery(
        domain=QueryDomain.COMPANY,
        query_template="{company} company revenue funding investors employees headquarters tech stack 2024 2025",
        fields_to_extract=[
            "company_revenue", "funding_total", "funding_round", "investors",
            "employee_count", "headquarters", "tech_stack", "founded_year"
        ],
        system_prompt="Return factual company data. Include specific numbers and dates when available.",
        ttl_hours=168,
        priority=1,
        timeout_seconds=25
    ),

    # Q2: PERSON INTELLIGENCE
    EnrichmentQuery(
        domain=QueryDomain.PERSON,
        query_template="{full_name} {title} {company} career history education background experience LinkedIn",
        fields_to_extract=[
            "career_history", "previous_companies", "education",
            "skills", "years_in_role", "linkedin_summary"
        ],
        system_prompt="Return professional background information. Focus on career trajectory and expertise.",
        ttl_hours=336,
        priority=1,
        timeout_seconds=25
    ),

    # Q3: INDUSTRY/VERTICAL INTELLIGENCE
    EnrichmentQuery(
        domain=QueryDomain.INDUSTRY,
        query_template="{vertical} industry trends challenges pain points market outlook 2024 2025",
        fields_to_extract=[
            "industry_trends", "common_challenges", "market_size",
            "growth_rate", "regulatory_factors", "technology_shifts"
        ],
        system_prompt="Return industry analysis. Focus on actionable trends and common pain points.",
        ttl_hours=72,
        priority=2,
        timeout_seconds=20
    ),

    # Q4: NEWS & TRIGGERS
    EnrichmentQuery(
        domain=QueryDomain.NEWS,
        query_template="{company} recent news funding acquisition expansion hiring announcements 2024 2025",
        fields_to_extract=[
            "recent_news", "funding_announcements", "expansion_signals",
            "hiring_signals", "partnership_news", "deal_triggers"
        ],
        system_prompt="Return recent news and signals. Focus on events indicating buying intent or organizational change.",
        ttl_hours=24,
        priority=1,
        timeout_seconds=25
    ),

    # Q5: OPEN-ENDED SALES INTELLIGENCE
    EnrichmentQuery(
        domain=QueryDomain.OPEN_ENDED,
        query_template="""
        Sales intelligence for {full_name}, {title} at {company} ({vertical} industry):
        - Why would they need solutions/services now?
        - What business pressures or growth drivers make them receptive?
        - What objections or hesitations might they have?
        - What hook or angle would resonate based on their role and industry?
        """,
        fields_to_extract=[
            "why_buy_now", "business_pressures", "growth_drivers",
            "likely_objections", "objection_handlers", "hook_angle",
            "talking_points", "opening_line"
        ],
        system_prompt="""You are a senior sales strategist. Analyze this prospect and provide actionable sales intelligence.
        Be specific to their role and industry. Focus on: timing triggers, pain points, objection handling, and conversation openers.""",
        ttl_hours=48,
        priority=1,
        timeout_seconds=35
    ),
]

def get_query_by_domain(domain: QueryDomain) -> Optional[EnrichmentQuery]:
    for q in ENRICHMENT_QUERIES:
        if q.domain == domain:
            return q
    return None

def format_query(query: EnrichmentQuery, context: ContactContext) -> str:
    return query.query_template.format(
        first_name=context.first_name,
        last_name=context.last_name,
        full_name=context.full_name or "Executive",
        title=context.title or "Executive",
        company=context.company or "Unknown Company",
        vertical=context.vertical or "Business Services",
        email=context.email,
        linkedin_url=context.linkedin_url
    )
QUERYEOF

echo "✓ Created query_templates.py"

#############################################################################
# FILE 3: parallel_enricher.py - Core Async Engine
#############################################################################
cat << 'ENRICHEREOF' > backend/enrichment_v3/parallel_enricher.py
"""
LatticeIQ Enrichment V3 - Parallel Enricher
Async multi-query execution engine with rate limiting
"""
import asyncio
import hashlib
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import httpx

from .query_templates import (
    ENRICHMENT_QUERIES,
    ContactContext,
    EnrichmentQuery,
    QueryDomain,
    format_query,
)

logger = logging.getLogger(__name__)

@dataclass
class QueryResult:
    """Result from a single query execution"""
    domain: QueryDomain
    success: bool
    content: str
    citations: List[str]
    latency_ms: int
    cached: bool
    error: Optional[str] = None

@dataclass
class EnrichmentResult:
    """Complete enrichment result"""
    contact_id: int
    success: bool
    query_results: Dict[str, QueryResult]
    synthesized_data: Dict[str, Any]
    total_latency_ms: int
    queries_executed: int
    queries_cached: int
    timestamp: str

class SimpleCache:
    """In-memory cache with TTL"""

    def __init__(self):
        self._cache: Dict[str, Tuple[Any, datetime]] = {}

    def _make_key(self, query: str) -> str:
        return hashlib.md5(query.encode()).hexdigest()

    def get(self, query: str, ttl_hours: int) -> Optional[str]:
        key = self._make_key(query)
        if key in self._cache:
            value, stored_at = self._cache[key]
            if datetime.now() - stored_at < timedelta(hours=ttl_hours):
                return value
            del self._cache[key]
        return None

    def set(self, query: str, value: str) -> None:
        key = self._make_key(query)
        self._cache[key] = (value, datetime.now())

    def clear(self) -> None:
        self._cache.clear()

class ParallelEnricher:
    """
    Parallel multi-query enrichment engine

    Features:
    - Concurrent Perplexity API queries with semaphore control
    - Per-domain caching with configurable TTL
    - Graceful degradation on partial failures
    """

    def __init__(
        self,
        perplexity_api_key: Optional[str] = None,
        max_concurrent: int = 3,
        enable_cache: bool = True
    ):
        self.api_key = perplexity_api_key or os.getenv("PERPLEXITY_API_KEY")
        if not self.api_key:
            raise ValueError("PERPLEXITY_API_KEY required")

        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.cache = SimpleCache() if enable_cache else None
        self.base_url = "https://api.perplexity.ai/chat/completions"

        logger.info(f"ParallelEnricher initialized: max_concurrent={max_concurrent}")

    async def enrich_contact(
        self,
        contact: Dict[str, Any],
        contact_id: int,
        domains: Optional[List[QueryDomain]] = None
    ) -> EnrichmentResult:
        """Execute parallel enrichment for a contact"""
        start_time = time.time()
        context = ContactContext.from_dict(contact)

        queries = ENRICHMENT_QUERIES
        if domains:
            queries = [q for q in queries if q.domain in domains]

        logger.info(f"Starting enrichment for contact {contact_id}: {len(queries)} queries")

        # Execute queries in parallel
        tasks = [self._execute_query(query, context) for query in queries]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        query_results: Dict[str, QueryResult] = {}
        queries_cached = 0

        for query, result in zip(queries, results):
            if isinstance(result, Exception):
                logger.error(f"Query {query.domain.value} failed: {result}")
                query_results[query.domain.value] = QueryResult(
                    domain=query.domain, success=False, content="",
                    citations=[], latency_ms=0, cached=False, error=str(result)
                )
            else:
                query_results[query.domain.value] = result
                if result.cached:
                    queries_cached += 1

        total_latency = int((time.time() - start_time) * 1000)
        successful = sum(1 for r in query_results.values() if r.success)

        logger.info(f"Enrichment complete: {successful}/{len(queries)} queries, {total_latency}ms")

        return EnrichmentResult(
            contact_id=contact_id,
            success=successful > 0,
            query_results=query_results,
            synthesized_data=self._extract_raw_data(query_results),
            total_latency_ms=total_latency,
            queries_executed=len(queries),
            queries_cached=queries_cached,
            timestamp=datetime.now().isoformat()
        )

    async def _execute_query(self, query: EnrichmentQuery, context: ContactContext) -> QueryResult:
        """Execute a single query with caching and rate limiting"""
        start_time = time.time()
        formatted_query = format_query(query, context)

        # Check cache
        if self.cache:
            cached = self.cache.get(formatted_query, query.ttl_hours)
            if cached:
                return QueryResult(
                    domain=query.domain, success=True, content=cached,
                    citations=[], latency_ms=0, cached=True
                )

        # Execute with semaphore
        async with self.semaphore:
            try:
                content, citations = await self._call_perplexity(
                    formatted_query, query.system_prompt, query.timeout_seconds
                )

                if self.cache and content:
                    self.cache.set(formatted_query, content)

                latency = int((time.time() - start_time) * 1000)
                return QueryResult(
                    domain=query.domain, success=True, content=content,
                    citations=citations, latency_ms=latency, cached=False
                )
            except Exception as e:
                latency = int((time.time() - start_time) * 1000)
                return QueryResult(
                    domain=query.domain, success=False, content="",
                    citations=[], latency_ms=latency, cached=False, error=str(e)
                )

    async def _call_perplexity(
        self, query: str, system_prompt: Optional[str], timeout: int
    ) -> Tuple[str, List[str]]:
        """Make API call to Perplexity"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": query})

        payload = {
            "model": "sonar",
            "messages": messages,
            "max_tokens": 1500,
            "temperature": 0.2,
            "return_citations": True
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(self.base_url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        citations = data.get("citations", [])
        return content, citations

    def _extract_raw_data(self, query_results: Dict[str, QueryResult]) -> Dict[str, Any]:
        """Extract raw content from successful queries"""
        return {
            domain: {
                "content": result.content,
                "citations": result.citations,
                "latency_ms": result.latency_ms
            }
            for domain, result in query_results.items()
            if result.success
        }
ENRICHEREOF

echo "✓ Created parallel_enricher.py"

#############################################################################
# FILE 4: synthesizer.py - GPT-4 Combination Layer
#############################################################################
cat << 'SYNTHEOF' > backend/enrichment_v3/synthesizer.py
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
SYNTHEOF

echo "✓ Created synthesizer.py"

#############################################################################
# FILE 5: api_routes.py - FastAPI Routes with Supabase
#############################################################################
cat << 'ROUTESEOF' > backend/enrichment_v3/api_routes.py
"""
LatticeIQ Enrichment V3 - API Routes
FastAPI endpoints with Supabase integration
"""
import json
import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from supabase import create_client

from .parallel_enricher import ParallelEnricher, EnrichmentResult
from .synthesizer import EnrichmentSynthesizer, profile_to_dict
from .query_templates import QueryDomain

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v3/enrichment", tags=["Enrichment V3"])

# Supabase client
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# ═══════════════════════════════════════════════════════════════════════════════
# AUTH - Import from main app
# ═══════════════════════════════════════════════════════════════════════════════

# This will be imported when wired up
async def get_current_user_placeholder():
    """Placeholder - replaced by main.py import"""
    raise HTTPException(status_code=401, detail="Auth not configured")

get_current_user = get_current_user_placeholder

def set_auth_dependency(auth_func):
    """Called by main.py to inject auth"""
    global get_current_user
    get_current_user = auth_func

# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class EnrichRequest(BaseModel):
    contact_id: int
    domains: Optional[List[str]] = None
    skip_cache: bool = False
    synthesize: bool = True

class BatchEnrichRequest(BaseModel):
    contact_ids: Optional[List[int]] = None
    limit: int = 10
    domains: Optional[List[str]] = None
    synthesize: bool = True

# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON INSTANCES
# ═══════════════════════════════════════════════════════════════════════════════

_enricher: Optional[ParallelEnricher] = None
_synthesizer: Optional[EnrichmentSynthesizer] = None

def get_enricher() -> ParallelEnricher:
    global _enricher
    if _enricher is None:
        _enricher = ParallelEnricher(max_concurrent=3, enable_cache=True)
    return _enricher

def get_synthesizer() -> EnrichmentSynthesizer:
    global _synthesizer
    if _synthesizer is None:
        _synthesizer = EnrichmentSynthesizer()
    return _synthesizer

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/enrich")
async def enrich_contact_v3(request: EnrichRequest, user = Depends(lambda: get_current_user)):
    """
    V3 Parallel Enrichment - Single Contact

    Executes 5 parallel Perplexity queries + GPT-4 synthesis
    """
    try:
        # Get contact (with user_id filter for security)
        result = supabase.table("contacts").select("*").eq("id", request.contact_id).eq("user_id", user.id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")

        contact = result.data[0]

        # Update status
        supabase.table("contacts").update({
            "enrichment_status": "enriching"
        }).eq("id", request.contact_id).execute()

        # Parse domains
        domains = None
        if request.domains:
            domains = [QueryDomain(d) for d in request.domains]

        # Execute parallel enrichment
        enricher = get_enricher()
        if request.skip_cache:
            enricher.cache.clear()

        enrichment_result = await enricher.enrich_contact(
            contact=contact,
            contact_id=request.contact_id,
            domains=domains
        )

        # Synthesize
        synthesized = None
        if request.synthesize and enrichment_result.success:
            synthesizer = get_synthesizer()
            profile = await synthesizer.synthesize(enrichment_result, contact)
            synthesized = profile_to_dict(profile)

        # Save to database
        enrichment_data = {
            "v3_parallel": True,
            "queries_executed": enrichment_result.queries_executed,
            "queries_cached": enrichment_result.queries_cached,
            "latency_ms": enrichment_result.total_latency_ms,
            "raw_results": {
                k: {"success": v.success, "latency_ms": v.latency_ms, "content": v.content[:500]}
                for k, v in enrichment_result.query_results.items()
            },
            "synthesized": synthesized
        }

        update_data = {
            "enrichment_status": "enriched",
            "enrichment_data": enrichment_data,
            "enriched_at": datetime.now().isoformat()
        }

        # Add scores if synthesized
        if synthesized:
            update_data["apex_score"] = synthesized.get("apex_score")
            update_data["bant_budget"] = synthesized.get("bant_budget")
            update_data["bant_authority"] = synthesized.get("bant_authority")
            update_data["bant_need"] = synthesized.get("bant_need")
            update_data["bant_timing"] = synthesized.get("bant_timing")

        supabase.table("contacts").update(update_data).eq("id", request.contact_id).execute()

        return {
            "success": True,
            "contact_id": request.contact_id,
            "version": "v3_parallel",
            "metrics": {
                "total_latency_ms": enrichment_result.total_latency_ms,
                "queries_executed": enrichment_result.queries_executed,
                "queries_cached": enrichment_result.queries_cached,
                "queries_succeeded": sum(1 for r in enrichment_result.query_results.values() if r.success)
            },
            "synthesized_profile": synthesized
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"V3 Enrichment error: {e}")
        supabase.table("contacts").update({
            "enrichment_status": "failed"
        }).eq("id", request.contact_id).execute()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enrich/batch")
async def batch_enrich_v3(request: BatchEnrichRequest, user = Depends(lambda: get_current_user)):
    """
    Batch V3 Enrichment - Multiple Contacts

    Enriches pending contacts sequentially (parallel within each contact)
    """
    try:
        # Get contacts to enrich
        if request.contact_ids:
            result = supabase.table("contacts").select("*").eq("user_id", user.id).in_("id", request.contact_ids).execute()
        else:
            result = supabase.table("contacts").select("*").eq("user_id", user.id).eq("enrichment_status", "pending").limit(request.limit).execute()

        if not result.data:
            return {"success": True, "message": "No contacts to enrich", "enriched": 0}

        contacts = result.data
        enricher = get_enricher()
        synthesizer = get_synthesizer()

        domains = [QueryDomain(d) for d in request.domains] if request.domains else None

        enriched_count = 0
        failed_count = 0
        results = []

        for contact in contacts:
            try:
                # Update status
                supabase.table("contacts").update({
                    "enrichment_status": "enriching"
                }).eq("id", contact["id"]).execute()

                # Enrich
                enrichment_result = await enricher.enrich_contact(
                    contact=contact,
                    contact_id=contact["id"],
                    domains=domains
                )

                # Synthesize
                synthesized = None
                if request.synthesize and enrichment_result.success:
                    profile = await synthesizer.synthesize(enrichment_result, contact)
                    synthesized = profile_to_dict(profile)

                # Save
                enrichment_data = {
                    "v3_parallel": True,
                    "queries_executed": enrichment_result.queries_executed,
                    "latency_ms": enrichment_result.total_latency_ms,
                    "synthesized": synthesized
                }

                update_data = {
                    "enrichment_status": "enriched",
                    "enrichment_data": enrichment_data,
                    "enriched_at": datetime.now().isoformat()
                }

                if synthesized:
                    update_data["apex_score"] = synthesized.get("apex_score")
                    update_data["bant_budget"] = synthesized.get("bant_budget")
                    update_data["bant_authority"] = synthesized.get("bant_authority")
                    update_data["bant_need"] = synthesized.get("bant_need")
                    update_data["bant_timing"] = synthesized.get("bant_timing")

                supabase.table("contacts").update(update_data).eq("id", contact["id"]).execute()

                enriched_count += 1
                results.append({
                    "contact_id": contact["id"],
                    "success": True,
                    "apex_score": synthesized.get("apex_score") if synthesized else None
                })

            except Exception as e:
                logger.error(f"Failed to enrich contact {contact['id']}: {e}")
                supabase.table("contacts").update({
                    "enrichment_status": "failed"
                }).eq("id", contact["id"]).execute()
                failed_count += 1
                results.append({
                    "contact_id": contact["id"],
                    "success": False,
                    "error": str(e)
                })

        return {
            "success": True,
            "enriched": enriched_count,
            "failed": failed_count,
            "total": len(contacts),
            "results": results
        }

    except Exception as e:
        logger.error(f"Batch enrichment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contact/{contact_id}/profile")
async def get_contact_profile(contact_id: int, user = Depends(lambda: get_current_user)):
    """Get enriched profile for a contact"""
    result = supabase.table("contacts").select("*").eq("id", contact_id).eq("user_id", user.id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact = result.data[0]
    enrichment_data = contact.get("enrichment_data", {})

    if not enrichment_data:
        raise HTTPException(status_code=404, detail="Contact not enriched yet")

    return {
        "contact_id": contact_id,
        "name": f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
        "company": contact.get("company"),
        "title": contact.get("title"),
        "apex_score": contact.get("apex_score"),
        "enrichment_status": contact.get("enrichment_status"),
        "profile": enrichment_data.get("synthesized", {})
    }


@router.post("/cache/clear")
async def clear_enrichment_cache(user = Depends(lambda: get_current_user)):
    """Clear the enrichment cache"""
    enricher = get_enricher()
    enricher.cache.clear()
    return {"success": True, "message": "Cache cleared"}


@router.get("/health")
async def enrichment_health():
    """Health check"""
    try:
        enricher = get_enricher()
        synthesizer = get_synthesizer()
        return {
            "status": "healthy",
            "version": "v3_parallel",
            "enricher_ready": enricher is not None,
            "synthesizer_ready": synthesizer is not None,
            "cache_enabled": enricher.cache is not None
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
ROUTESEOF

echo "✓ Created api_routes.py"

#############################################################################
# PATCH main.py to include V3 routes
#############################################################################
MAIN_PY="backend/main.py"

if [ -f "$MAIN_PY" ]; then
    # Check if already patched
    if grep -q "enrichment_v3" "$MAIN_PY"; then
        echo "⚠ main.py already includes enrichment_v3"
    else
        # Create backup
        cp "$MAIN_PY" "${MAIN_PY}.backup-$(date +%s)"

        # Add import and router
        cat >> "$MAIN_PY" << 'MAINPATCH'


# ============= ENRICHMENT V3 - PARALLEL ARCHITECTURE =============
try:
    from enrichment_v3.api_routes import router as enrichment_v3_router, set_auth_dependency
    set_auth_dependency(get_current_user)
    app.include_router(enrichment_v3_router)
    print("✓ Enrichment V3 (Parallel) routes registered")
except ImportError as e:
    print(f"⚠ Enrichment V3 not available: {e}")
MAINPATCH

        echo "✓ Patched main.py with V3 routes"
    fi
else
    echo "⚠ main.py not found at $MAIN_PY"
fi

#############################################################################
# UPDATE requirements.txt
#############################################################################
REQUIREMENTS="backend/requirements.txt"

if [ -f "$REQUIREMENTS" ]; then
    if ! grep -q "httpx" "$REQUIREMENTS"; then
        echo "httpx>=0.25.0" >> "$REQUIREMENTS"
        echo "✓ Added httpx to requirements.txt"
    fi
else
    echo "httpx>=0.25.0" >> "$REQUIREMENTS"
    echo "✓ Created requirements.txt with httpx"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Files created:"
echo "  backend/enrichment_v3/__init__.py"
echo "  backend/enrichment_v3/query_templates.py"
echo "  backend/enrichment_v3/parallel_enricher.py"
echo "  backend/enrichment_v3/synthesizer.py"
echo "  backend/enrichment_v3/api_routes.py"
echo ""
echo "REQUIRED ENV VARS (add to Render):"
echo "  PERPLEXITY_API_KEY=pplx-..."
echo "  OPENAI_API_KEY=sk-..."
echo ""
echo "NEW ENDPOINTS:"
echo "  POST /api/v3/enrichment/enrich         - Single contact"
echo "  POST /api/v3/enrichment/enrich/batch   - Batch contacts"
echo "  GET  /api/v3/enrichment/contact/{id}/profile"
echo "  POST /api/v3/enrichment/cache/clear"
echo "  GET  /api/v3/enrichment/health"
echo ""
echo "NEXT STEPS:"
echo "  1. cd projects/latticeiq"
echo "  2. chmod +x deploy_enrichment_v3.sh"
echo "  3. ./deploy_enrichment_v3.sh"
echo "  4. Add PERPLEXITY_API_KEY and OPENAI_API_KEY to Render"
echo "  5. git add -A && git commit -m 'add enrichment v3' && git push"
echo ""
