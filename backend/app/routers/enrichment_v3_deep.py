# backend/app/routers/enrichment_v3_deep.py

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, status
from supabase import Client

from app.database import get_supabase
from app.auth import get_current_user
from app.enrichment_v3.models import (
    UnifiedEnrichmentResult,
    EnrichmentMeta,
    ContactProfileBox,
    CompanyProfileBox,
    CurrentFocusBox,
    BuyingSignalsBox,
    RisksAndObjectionsBox,
    MessagingBox,
    EnrichmentBullet,
    DeepEnrichmentStatus,
    DebugDeepEnrichResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/enrichment", tags=["enrichment-deep"])

PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"


# ---------------------------------------------------------------------------
# JSON Repair Utilities
# ---------------------------------------------------------------------------

def strip_citations(text: str) -> str:
    """Remove citation markers like [1], [2][3], etc. from text."""
    if not text:
        return text
    return re.sub(r'\[\d+\]', '', text).strip()


def repair_truncated_json(content: str) -> str:
    """Attempt to repair truncated JSON by closing open brackets/braces."""
    content = content.rstrip()
    
    # If it ends properly, return as-is
    if content.endswith('}'):
        return content
    
    # Remove trailing incomplete string/value
    lines = content.split('\n')
    while lines:
        last_line = lines[-1].strip()
        # Keep if line ends with valid JSON terminators
        if last_line.endswith(('}', ']', '"', ',', 'null', 'true', 'false')) or re.search(r'\d$', last_line):
            break
        lines.pop()
    
    if not lines:
        return content  # Can't repair, return original
    
    content = '\n'.join(lines)
    
    # Remove trailing comma if present before closing
    content = re.sub(r',\s*$', '', content)
    
    # Count unmatched brackets/braces
    open_braces = content.count('{') - content.count('}')
    open_brackets = content.count('[') - content.count(']')
    
    # Check if we're in the middle of a string (odd number of unescaped quotes)
    in_string = (content.count('"') - content.count('\\"')) % 2 == 1
    if in_string:
        content += '"'
    
    # Close arrays first, then objects
    content += ']' * max(0, open_brackets)
    content += '}' * max(0, open_braces)
    
    return content


def ensure_bullet_list(value: Any) -> List[EnrichmentBullet]:
    """Convert various formats to list of EnrichmentBullet objects."""
    if value is None:
        return []
    
    if isinstance(value, list):
        result = []
        for item in value:
            if isinstance(item, dict):
                if 'text' in item:
                    text = strip_citations(str(item.get('text', '')))
                    result.append(EnrichmentBullet(
                        text=text,
                        evidence=item.get('evidence'),
                        strength=item.get('strength')
                    ))
                else:
                    # Dict without 'text' key - stringify it
                    text = strip_citations(str(item))
                    result.append(EnrichmentBullet(text=text))
            elif isinstance(item, str):
                text = item.lstrip('- ').strip()
                text = strip_citations(text)
                if text:
                    result.append(EnrichmentBullet(text=text))
        return result
    
    if isinstance(value, str):
        # Split on newlines if multiple items
        lines = [l.strip().lstrip('- ') for l in value.split('\n') if l.strip()]
        return [EnrichmentBullet(text=strip_citations(line)) for line in lines if line]
    
    if isinstance(value, dict):
        # Single dict, wrap in list
        text = strip_citations(str(value.get('text', str(value))))
        return [EnrichmentBullet(text=text)]
    
    return []


def ensure_string(value: Any) -> Optional[str]:
    """Ensure value is a clean string or None."""
    if value is None:
        return None
    if isinstance(value, str):
        return strip_citations(value)
    if isinstance(value, list):
        return strip_citations('; '.join(str(v) for v in value))
    return strip_citations(str(value))


def transform_to_schema(contact_id: str, parsed: Dict[str, Any], model_name: str) -> UnifiedEnrichmentResult:
    """Transform AI response to match expected UnifiedEnrichmentResult schema."""
    
    # Extract raw sections with fallbacks
    contact_raw = parsed.get("contact_profile") or {}
    company_raw = parsed.get("company_profile") or {}
    focus_raw = parsed.get("current_focus") or {}
    signals_raw = parsed.get("buying_signals") or {}
    risks_raw = parsed.get("risks_and_objections") or {}
    messaging_raw = parsed.get("messaging") or {}
    
    # Handle case where sections are arrays instead of objects
    if isinstance(focus_raw, list):
        focus_raw = {
            "strategic_initiatives": focus_raw,
            "recent_projects": [],
            "primary_kpis": []
        }
    
    if isinstance(signals_raw, list):
        signals_raw = {
            "recent_news": signals_raw,
            "hiring_signals": [],
            "tech_changes": [],
            "timing_triggers": []
        }
    
    if isinstance(risks_raw, list):
        risks_raw = {
            "risk_bullets": risks_raw,
            "likely_objections": [],
            "landmines": []
        }
    
    if isinstance(messaging_raw, list):
        messaging_raw = {
            "cold_openers": messaging_raw,
            "value_props": [],
            "call_to_action_ideas": []
        }
    
    # Build properly typed objects
    contact_profile = ContactProfileBox(
        headline=ensure_string(
            contact_raw.get("headline") or 
            contact_raw.get("title") or 
            contact_raw.get("name")
        ),
        role_summary=ensure_string(
            contact_raw.get("role_summary") or 
            contact_raw.get("experience") or
            contact_raw.get("summary")
        ),
        seniority=ensure_string(
            contact_raw.get("seniority") or 
            contact_raw.get("credentials") or
            contact_raw.get("level")
        ),
        background_bullets=ensure_bullet_list(
            contact_raw.get("background_bullets") or
            contact_raw.get("specialties") or
            contact_raw.get("affiliations") or
            contact_raw.get("background")
        )
    )
    
    company_profile = CompanyProfileBox(
        one_liner=ensure_string(
            company_raw.get("one_liner") or 
            company_raw.get("type") or
            company_raw.get("description")
        ),
        industry=ensure_string(company_raw.get("industry")),
        size_segment=ensure_string(
            company_raw.get("size_segment") or
            company_raw.get("size")
        ),
        region=ensure_string(
            company_raw.get("region") or 
            company_raw.get("office") or
            company_raw.get("location")
        ),
        key_products_or_services=ensure_bullet_list(
            company_raw.get("key_products_or_services") or
            company_raw.get("focus_areas") or
            company_raw.get("products")
        )
    )
    
    current_focus = CurrentFocusBox(
        strategic_initiatives=ensure_bullet_list(focus_raw.get("strategic_initiatives")),
        recent_projects=ensure_bullet_list(focus_raw.get("recent_projects")),
        primary_kpis=ensure_bullet_list(focus_raw.get("primary_kpis"))
    )
    
    buying_signals = BuyingSignalsBox(
        recent_news=ensure_bullet_list(signals_raw.get("recent_news")),
        hiring_signals=ensure_bullet_list(signals_raw.get("hiring_signals")),
        tech_changes=ensure_bullet_list(signals_raw.get("tech_changes")),
        timing_triggers=ensure_bullet_list(signals_raw.get("timing_triggers"))
    )
    
    risks_and_objections = RisksAndObjectionsBox(
        risk_bullets=ensure_bullet_list(risks_raw.get("risk_bullets")),
        likely_objections=ensure_bullet_list(risks_raw.get("likely_objections")),
        landmines=ensure_bullet_list(risks_raw.get("landmines"))
    )
    
    messaging = MessagingBox(
        cold_openers=ensure_bullet_list(messaging_raw.get("cold_openers")),
        value_props=ensure_bullet_list(messaging_raw.get("value_props")),
        call_to_action_ideas=ensure_bullet_list(messaging_raw.get("call_to_action_ideas"))
    )
    
    meta = EnrichmentMeta(
        generated_at=datetime.utcnow().isoformat(),
        source="deep",
        model=model_name,
        provider="perplexity",
        confidence_score=None,
        version=1,
    )
    
    return UnifiedEnrichmentResult(
        contact_id=contact_id,
        contact_profile=contact_profile,
        company_profile=company_profile,
        current_focus=current_focus,
        buying_signals=buying_signals,
        risks_and_objections=risks_and_objections,
        messaging=messaging,
        meta=meta,
    )


# ---------------------------------------------------------------------------
# Perplexity API Call
# ---------------------------------------------------------------------------

async def call_perplexity_deep_research(
    api_key: str,
    contact: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Run a heavier multi-step research prompt.
    The model is instructed to return a full UnifiedEnrichmentResult JSON.
    """

    name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
    company = contact.get("company") or ""
    title = contact.get("title") or contact.get("job_title") or ""
    linkedin_url = contact.get("linkedin_url") or ""
    website = contact.get("website") or ""

    system_prompt = """You are a senior B2B sales researcher. Return ONLY valid JSON - no markdown, no explanations, no citations like [1] or [2].

You MUST return this EXACT structure with objects containing arrays (NOT bare arrays):

{
  "contact_profile": {
    "headline": "string or null",
    "role_summary": "string or null",
    "seniority": "string or null",
    "background_bullets": [{"text": "string"}]
  },
  "company_profile": {
    "one_liner": "string or null",
    "industry": "string or null",
    "size_segment": "string or null",
    "region": "string or null",
    "key_products_or_services": [{"text": "string"}]
  },
  "current_focus": {
    "strategic_initiatives": [{"text": "string"}],
    "recent_projects": [{"text": "string"}],
    "primary_kpis": [{"text": "string"}]
  },
  "buying_signals": {
    "recent_news": [{"text": "string"}],
    "hiring_signals": [{"text": "string"}],
    "tech_changes": [{"text": "string"}],
    "timing_triggers": [{"text": "string"}]
  },
  "risks_and_objections": {
    "risk_bullets": [{"text": "string"}],
    "likely_objections": [{"text": "string"}],
    "landmines": [{"text": "string"}]
  },
  "messaging": {
    "cold_openers": [{"text": "string"}],
    "value_props": [{"text": "string"}],
    "call_to_action_ideas": [{"text": "string"}]
  }
}

CRITICAL RULES:
1. Return ONLY the JSON object - no text before or after
2. Do NOT include citation markers like [1], [2], etc.
3. Each section must be an OBJECT with named arrays inside, NOT a bare array
4. Keep bullet text concise (under 100 chars each)
5. Ensure all brackets and braces are properly closed"""

    user_prompt = f"""Research this prospect for B2B sales outreach:

Name: {name}
Title: {title}
Company: {company}
LinkedIn: {linkedin_url}
Website: {website}

Provide comprehensive sales intelligence. Remember: return ONLY valid JSON matching the schema exactly."""

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "sonar-pro",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 4000,  # Increased from 1500/3000 to prevent truncation
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(PERPLEXITY_API_URL, json=payload, headers=headers)

    if resp.status_code != 200:
        logger.error("Perplexity deep-enrich error: %s - %s", resp.status_code, resp.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Deep enrichment provider error",
        )

    data = resp.json()
    content = data["choices"][0]["message"]["content"]

    # Strip markdown code blocks if present
    clean_content = content.strip()
    if clean_content.startswith("```"):
        clean_content = re.sub(r'^```(?:json)?\s*', '', clean_content)
        clean_content = re.sub(r'\s*```$', '', clean_content)
    
    # Attempt to repair truncated JSON
    clean_content = repair_truncated_json(clean_content)

    try:
        parsed = json.loads(clean_content)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse deep-enrich JSON: %s\nRaw content:\n%s", e, clean_content[:2000])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Deep enrichment returned invalid JSON: {str(e)}",
        )

    return {
        "raw_provider_response": data,
        "parsed_payload": parsed,
        "model": data.get("model") or "sonar-pro",
    }


# ---------------------------------------------------------------------------
# Legacy build function (now wraps transform_to_schema)
# ---------------------------------------------------------------------------

def build_unified_from_deep(
    contact_id: str,
    parsed: Dict[str, Any],
    model_name: str,
) -> UnifiedEnrichmentResult:
    """Build UnifiedEnrichmentResult from parsed AI response with schema transformation."""
    return transform_to_schema(contact_id, parsed, model_name)


def merge_quick_and_deep(
    quick: Optional[UnifiedEnrichmentResult],
    deep: UnifiedEnrichmentResult,
) -> UnifiedEnrichmentResult:
    """
    Use deep as the source of truth; fall back to quick where deep is empty.
    """

    if not quick:
        return deep

    def choose(a, b):
        return a if a not in (None, "", [], {}) else b

    merged = deep.copy(deep=True)

    merged.contact_profile.headline = choose(
        deep.contact_profile.headline,
        quick.contact_profile.headline,
    )
    merged.contact_profile.role_summary = choose(
        deep.contact_profile.role_summary,
        quick.contact_profile.role_summary,
    )
    if not merged.contact_profile.background_bullets:
        merged.contact_profile.background_bullets = quick.contact_profile.background_bullets

    if not merged.messaging.cold_openers:
        merged.messaging.cold_openers = quick.messaging.cold_openers

    return merged


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/deep-enrich/{contact_id}",
    response_model=DeepEnrichmentStatus,
    summary="Run deep enrichment inline for now (sync)",
)
async def deep_enrich_contact(
    contact_id: str = Path(...),
    user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    contact_res = supabase.table("contacts").select("*").eq("id", contact_id).execute()
    if not contact_res.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact = contact_res.data

    api_key = os.getenv("PERPLEXITY_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Perplexity API key not configured",
        )

    # Mark as processing
    supabase.table("contacts").update(
        {
            "enrichment_status": "processing",
        }
    ).eq("id", contact_id).execute()

    try:
        provider_result = await call_perplexity_deep_research(api_key, contact)
        deep_unified = build_unified_from_deep(
            contact_id=contact_id,
            parsed=provider_result["parsed_payload"],
            model_name=provider_result["model"],
        )

        # Try to load any quick data for merging
        existing = contact.get("enrichment_data") or {}
        quick_unified: Optional[UnifiedEnrichmentResult] = None
        if existing.get("mode") == "quick" and existing.get("data"):
            try:
                quick_unified = UnifiedEnrichmentResult.parse_obj(existing["data"])
            except Exception:
                quick_unified = None

        merged = merge_quick_and_deep(quick_unified, deep_unified)

        enrichment_data = {
            "mode": "deep",
            "version": merged.meta.version,
            "data": merged.dict(),
            "raw_provider_response_deep": provider_result["raw_provider_response"],
            "raw_parsed_payload_deep": provider_result["parsed_payload"],
            "previous_quick": existing if existing else None,
        }

        supabase.table("contacts").update(
            {
                "enrichment_status": "completed",
                "enrichment_data": enrichment_data,
                "enriched_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", contact_id).execute()

        return DeepEnrichmentStatus(
            contact_id=contact_id,
            job_id=None,
            status="completed",
            error=None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Deep enrichment failed: %s", e)
        supabase.table("contacts").update(
            {
                "enrichment_status": "failed",
            }
        ).eq("id", contact_id).execute()
        return DeepEnrichmentStatus(
            contact_id=contact_id,
            job_id=None,
            status="failed",
            error=str(e),
        )


@router.get(
    "/deep-enrich/{contact_id}/status",
    response_model=DeepEnrichmentStatus,
)
async def deep_enrich_status(
    contact_id: str = Path(...),
    user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    contact_res = supabase.table("contacts").select(
        "id, enrichment_status"
    ).eq("id", contact_id).execute()
    if not contact_res.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    status_value = contact_res.data.get("enrichment_status") or "pending"

    mapped = "queued"
    if status_value in ("pending", None):
        mapped = "queued"
    elif status_value == "processing":
        mapped = "running"
    elif status_value == "completed":
        mapped = "completed"
    elif status_value == "failed":
        mapped = "failed"

    return DeepEnrichmentStatus(
        contact_id=contact_id,
        job_id=None,
        status=mapped,
        error=None,
    )


@router.get(
    "/deep-enrich/{contact_id}/result",
    response_model=UnifiedEnrichmentResult,
    summary="Get the final merged enrichment result (deep preferred, quick fallback)",
)
async def deep_enrich_result(
    contact_id: str = Path(...),
    user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    contact_res = supabase.table("contacts").select(
        "id, enrichment_data"
    ).eq("id", contact_id).execute()
    if not contact_res.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    data = contact_res.data.get("enrichment_data") or {}
    if not data:
        raise HTTPException(status_code=404, detail="No enrichment data found")

    if data.get("mode") == "deep" and data.get("data"):
        return UnifiedEnrichmentResult.parse_obj(data["data"])

    if data.get("mode") == "quick" and data.get("data"):
        return UnifiedEnrichmentResult.parse_obj(data["data"])

    raise HTTPException(status_code=404, detail="Enrichment data not in expected format")


@router.get(
    "/deep-enrich/{contact_id}/debug",
    response_model=DebugDeepEnrichResponse,
    summary="Full debug payload for deep enrichment",
)
async def deep_enrich_debug(
    contact_id: str = Path(...),
    user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    contact_res = supabase.table("contacts").select(
        "id, enrichment_data"
    ).eq("id", contact_id).execute()
    if not contact_res.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    data = contact_res.data.get("enrichment_data") or {}
    if not data or data.get("mode") != "deep":
        raise HTTPException(
            status_code=404,
            detail="No deep enrichment data found",
        )

    parsed_unified = UnifiedEnrichmentResult.parse_obj(data["data"])
    status_obj = DeepEnrichmentStatus(
        contact_id=contact_id,
        job_id=None,
        status="completed",
        error=None,
    )

    return DebugDeepEnrichResponse(
        contact_id=contact_id,
        job_id=None,
        request_payload={},
        raw_prompt_chain=None,
        raw_responses={
            "provider_response": data.get("raw_provider_response_deep"),
            "parsed_payload": data.get("raw_parsed_payload_deep"),
        },
        parsed=parsed_unified,
        status=status_obj,
    )
