# backend/app/enrichment_v3/enrich_simple.py

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, status
from supabase import Client

from app.database import get_supabase  # existing helper
from app.auth import get_current_user  # returns CurrentUser
from app.enrichment_v3.models import (
    UnifiedEnrichmentResult,
    EnrichmentMeta,
    ContactProfileBox,
    CompanyProfileBox,
    MessagingBox,
    QuickEnrichResponse,
    QuickEnrichLegacyData,
    DebugQuickEnrichResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/enrichment", tags=["enrichment-quick"])

PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def call_perplexity_quick_profile(
    api_key: str,
    contact: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Call Perplexity (or your chosen provider) to get a compact profile.
    The prompt is designed to return JSON in the UnifiedEnrichmentResult shape.
    """

    name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
    company = contact.get("company") or ""
    title = contact.get("title") or contact.get("job_title") or ""
    linkedin_url = contact.get("linkedin_url") or ""
    website = contact.get("website") or ""

    system_prompt = (
        "You are an SDR assistant that produces ultra-compact research on a prospect. "
        "Return ONLY valid JSON matching the provided schema. Do not include any "
        "natural language outside the JSON."
    )

    user_prompt = (
        "Generate a concise enrichment profile for this contact. "
        "Focus on a 1-sentence summary, 1–2 strong cold openers, and 3–5 "
        "talking-point bullets. Use publicly known, business-safe information.\n\n"
        f"Name: {name}\n"
        f"Title: {title}\n"
        f"Company: {company}\n"
        f"LinkedIn: {linkedin_url}\n"
        f"Website: {website}\n\n"
        "Return JSON with this shape:\n"
        "{\n"
        '  \"contact_profile\": {\n'
        '    \"headline\": \"...\",\n'
        '    \"role_summary\": \"...\",\n'
        '    \"seniority\": \"...\",\n'
        '    \"background_bullets\": [{\"text\": \"...\"}, ...]\n'
        "  },\n"
        '  \"company_profile\": {\n'
        '    \"one_liner\": \"...\",\n'
        '    \"industry\": \"...\",\n'
        '    \"size_segment\": \"...\",\n'
        '    \"region\": \"...\",\n'
        '    \"key_products_or_services\": [{\"text\": \"...\"}, ...]\n'
        "  },\n"
        '  \"messaging\": {\n'
        '    \"cold_openers\": [{\"text\": \"...\"}, ...],\n'
        '    \"value_props\": [{\"text\": \"...\"}, ...],\n'
        '    \"call_to_action_ideas\": [{\"text\": \"...\"}, ...]\n'
        "  }\n"
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
        "temperature": 0.4,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(PERPLEXITY_API_URL, json=payload, headers=headers)

    if resp.status_code != 200:
        logger.error("Perplexity quick-enrich error: %s - %s", resp.status_code, resp.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Quick enrichment provider error",
        )

    data = resp.json()
    # Expect standard OpenAI-style shape
    content = data["choices"][0]["message"]["content"]
    # content SHOULD be JSON string; parse it defensively
    import json

    try:
        parsed = json.loads(content)
    except Exception as e:
        logger.error("Failed to parse quick-enrich JSON: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Quick enrichment returned invalid JSON",
        )

    return {
        "raw_provider_response": data,
        "parsed_payload": parsed,
        "model": data.get("model") or "sonar-pro",
    }


def build_unified_from_quick(
    contact_id: str,
    parsed_payload: Dict[str, Any],
    model_name: str,
) -> UnifiedEnrichmentResult:
    """
    Map Perplexity JSON into UnifiedEnrichmentResult.
    Missing fields simply use defaults.
    """
    contact_profile = ContactProfileBox.parse_obj(
        parsed_payload.get("contact_profile") or {}
    )
    company_profile = CompanyProfileBox.parse_obj(
        parsed_payload.get("company_profile") or {}
    )
    messaging = MessagingBox.parse_obj(
        parsed_payload.get("messaging") or {}
    )

    meta = EnrichmentMeta(
        generated_at=datetime.utcnow(),
        source="quick",
        model=model_name,
        provider="perplexity",
        confidence_score=None,
        version=1,
    )

    result = UnifiedEnrichmentResult(
        contact_id=contact_id,
        contact_profile=contact_profile,
        company_profile=company_profile,
        messaging=messaging,
        meta=meta,
    )

    return result


def build_legacy_from_unified(
    unified: UnifiedEnrichmentResult,
) -> QuickEnrichLegacyData:
    """
    Optional: derive legacy quick-enrich fields from the unified result.
    """
    summary = unified.contact_profile.headline or unified.contact_profile.role_summary

    opening_line = None
    if unified.messaging.cold_openers:
        opening_line = unified.messaging.cold_openers[0].text

    talking_points = None
    if unified.contact_profile.background_bullets:
        talking_points = " • ".join(b.text for b in unified.contact_profile.background_bullets[:5])

    legacy = QuickEnrichLegacyData(
        summary=summary,
        openingline=opening_line,
        talkingpoints=talking_points,
        personatype=None,
        vertical=unified.company_profile.industry,
        inferredtitle=None,
        inferredcompanywebsite=None,
        inferredlocation=None,
        provider=unified.meta.provider,
        model=unified.meta.model,
        generatedat=unified.meta.generated_at,
        rawtext=None,
    )
    return legacy


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/quick-enrich/{contact_id}",
    response_model=QuickEnrichResponse,
    summary="Run quick enrichment for a single contact",
)
async def quick_enrich_contact(
    contact_id: str = Path(..., description="Contact UUID in Supabase"),
    user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Load contact from Supabase
    contact_res = supabase.table("contacts").select("*").eq("id", contact_id).execute()
    if not contact_res.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact = contact_res.data[0]

    perplexity_key = supabase  # just to keep type hints quiet
    # In practice, pull from environment
    import os
    api_key = os.getenv("PERPLEXITY_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Perplexity API key not configured",
        )

    # Call provider
    provider_result = await call_perplexity_quick_profile(api_key, contact)

    unified = build_unified_from_quick(
        contact_id=contact_id,
        parsed_payload=provider_result["parsed_payload"],
        model_name=provider_result["model"],
    )
    legacy = build_legacy_from_unified(unified)

    # Persist to contacts.enrichmentdata JSONB
    enrichment_data = {
        "mode": "quick",
        "version": unified.meta.version,
        "data": unified.dict(),
        "legacy": legacy.dict(by_alias=True),
        "raw_provider_response": provider_result["raw_provider_response"],
    }

    supabase.table("contacts").update(
        {
            "enrichment_status": "completed",
            "enrichment_data": enrichment_data,
            "enriched_at": datetime.utcnow().isoformat(),
        }
    ).eq("id", contact_id).execute()

    return QuickEnrichResponse(
        contactid=contact_id,
        status="completed",
        data=unified,
        legacy=legacy,
    )


@router.get(
    "/quick-enrich/{contact_id}/debug",
    response_model=DebugQuickEnrichResponse,
    summary="Debug view of quick enrichment",
)
async def quick_enrich_debug(
    contact_id: str = Path(...),
    user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    contact_res = supabase.table("contacts").select("*").eq("id", contact_id).execute()
    if not contact_res.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    row = contact_res.data[0]
    data = row.get("enrichment_data") or {}

    if not data or data.get("mode") != "quick":
        raise HTTPException(
            status_code=404,
            detail="No quick enrichment data found for this contact",
        )

    parsed_unified = UnifiedEnrichmentResult.parse_obj(data["data"])
    legacy = (
        QuickEnrichLegacyData.parse_obj(data["legacy"])
        if data.get("legacy")
        else None
    )

    quick_resp = QuickEnrichResponse(
        contactid=contact_id,
        status="completed",
        data=parsed_unified,
        legacy=legacy,
    )

    return DebugQuickEnrichResponse(
        contact_id=contact_id,
        request_payload={},  # fill if you store prompts later
        raw_prompt=None,
        raw_response=data.get("raw_provider_response"),
        parsed=quick_resp,
    )
