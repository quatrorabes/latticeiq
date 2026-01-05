# backend/app/routers/enrichment_v3_deep.py

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional

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
    DeepEnrichmentStatus,
    DebugDeepEnrichResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/enrichment", tags=["enrichment-deep"])

PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"


# ---------------------------------------------------------------------------
# Helpers
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

    system_prompt = (
        "You are a senior sales researcher. You perform deep web research, "
        "including company sites and news, and then produce structured insights "
        "for SDRs. Always return STRICT JSON matching the schema."
    )

    user_prompt = (
        "Perform deep research on this prospect and their company. "
        "Use public, business-appropriate data only.\n\n"
        f"Name: {name}\n"
        f"Title: {title}\n"
        f"Company: {company}\n"
        f"LinkedIn: {linkedin_url}\n"
        f"Website: {website}\n\n"
        "Populate ALL of these sections with short, punchy bullets wherever possible:\n"
        "contact_profile, company_profile, current_focus, buying_signals, "
        "risks_and_objections, messaging.\n\n"
        "Return JSON with this exact top-level structure:\n"
        "{\n"
        "  \"contact_profile\": { ... },\n"
        "  \"company_profile\": { ... },\n"
        "  \"current_focus\": { ... },\n"
        "  \"buying_signals\": { ... },\n"
        "  \"risks_and_objections\": { ... },\n"
        "  \"messaging\": { ... }\n"
        "}\n"
    )

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
        "temperature": 0.5,
        "max_tokens": 1500,
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

    import json
    import re

    # Strip markdown code blocks if present
    clean_content = content.strip()
    if clean_content.startswith("```"):
        clean_content = re.sub(r'^```(?:json)?\s*', '', clean_content)
        clean_content = re.sub(r'\s*```$', '', clean_content)

    try:
        parsed = json.loads(clean_content)
    except Exception as e:
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


def build_unified_from_deep(
    contact_id: str,
    parsed: Dict[str, Any],
    model_name: str,
) -> UnifiedEnrichmentResult:
    contact_profile = ContactProfileBox.parse_obj(
        parsed.get("contact_profile") or {}
    )
    company_profile = CompanyProfileBox.parse_obj(
        parsed.get("company_profile") or {}
    )
    current_focus = CurrentFocusBox.parse_obj(
        parsed.get("current_focus") or {}
    )
    buying_signals = BuyingSignalsBox.parse_obj(
        parsed.get("buying_signals") or {}
    )
    risks_and_objections = RisksAndObjectionsBox.parse_obj(
        parsed.get("risks_and_objections") or {}
    )
    messaging = MessagingBox.parse_obj(
        parsed.get("messaging") or {}
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

    contact = contact_res.data[0]

    import os
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
        # bubble up
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

    status_value = contact_res.data[0].get("enrichment_status") or "pending"

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

    data = contact_res.data[0].get("enrichment_data") or {}
    if not data:
        raise HTTPException(status_code=404, detail="No enrichment data found")

    # If latest is deep, just parse and return
    if data.get("mode") == "deep" and data.get("data"):
        return UnifiedEnrichmentResult.parse_obj(data["data"])

    # If only quick exists, still return unified result from quick
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

    data = contact_res.data[0].get("enrichment_data") or {}
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
        request_payload={},      # can be filled later if you log prompts
        raw_prompt_chain=None,   # same here
        raw_responses={
            "provider_response": data.get("raw_provider_response_deep"),
            "parsed_payload": data.get("raw_parsed_payload_deep"),
        },
        parsed=parsed_unified,
        status=status_obj,
    )
