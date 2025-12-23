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
