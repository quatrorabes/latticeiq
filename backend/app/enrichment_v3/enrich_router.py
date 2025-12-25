# ============================================================================
# FILE: backend/app/enrichment_v3/enrich_router.py
# ============================================================================
"""
Contact Enrichment API - Uses Perplexity AI to enrich contact data
"""

import os
import json
import re
import logging
from typing import Any, Dict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header
import httpx

from supabase import create_client

logger = logging.getLogger("latticeiq")

# ============================================================================
# SUPABASE CLIENT
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

if SUPABASE_URL and SUPABASE_SERVICE_KEY:
  supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
elif SUPABASE_URL and SUPABASE_ANON_KEY:
  supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
else:
  supabase = None
  
# Perplexity API
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")
PERPLEXITY_MODEL = os.getenv("PERPLEXITY_MODEL", "sonar-pro")


def strip_code_fences(content: str) -> str:
  """Remove markdown code fences from AI response"""
  content = content.strip()
  fence = chr(96) + chr(96) + chr(96)
  if content.startswith(fence):
    content = content.split("\n", 1)[-1]
  if content.endswith(fence):
    content = content.rsplit("\n", 1)[0]
  return content.strip()
    

# ============================================================================
# AUTH
# ============================================================================

async def get_current_user(authorization: str = Header(None)) -> dict:
    """Validate Supabase JWT"""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")

        anon_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        user_resp = anon_client.auth.get_user(token)
        user = getattr(user_resp, "user", None) or (user_resp.get("user") if isinstance(user_resp, dict) else None)

        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = getattr(user, "id", None) or user.get("id")
        email = getattr(user, "email", None) or user.get("email")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        return {"id": user_id, "email": email or ""}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(prefix="/enrich", tags=["Enrichment"])

# ============================================================================
# HELPER: Strip code fences from response
# ============================================================================

def strip_code_fences(content: str) -> str:
    """Remove markdown code fences from AI response"""
    content = content.strip()
    if content.startswith(CODE_FENCE_JSON):
        content = content[len(CODE_FENCE_JSON):]
    elif content.startswith(CODE_FENCE):
        content = content[len(CODE_FENCE):]
    if content.endswith(CODE_FENCE):
        content = content[:-len(CODE_FENCE)]
    return content.strip()

# ============================================================================
# ENRICH CONTACT ENDPOINT
# ============================================================================

@router.post("/{contact_id}")
async def enrich_contact(
    contact_id: str,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Enrich a contact using Perplexity AI"""
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    if not PERPLEXITY_API_KEY:
        raise HTTPException(status_code=503, detail="Perplexity API key not configured")

    user_id = user["id"]

    try:
        # 1. Fetch contact from database
        result = (
            supabase.table("contacts")
            .select("*")
            .eq("id", contact_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")

        contact = result.data

        # 2. Update status to "processing"
        supabase.table("contacts").update({
            "enrichment_status": "processing"
        }).eq("id", contact_id).execute()

        # 3. Build prompt for Perplexity
        name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        company = contact.get("company") or "Unknown Company"
        title = contact.get("job_title") or contact.get("title") or ""
        email = contact.get("email") or ""
        linkedin = contact.get("linkedin_url") or ""

        prompt = f"""Research this business contact and provide sales intelligence:

Name: {name}
Company: {company}
Title: {title}
Email: {email}
LinkedIn: {linkedin}

Provide a JSON response with these fields:
{{
  "summary": "2-3 sentence professional summary of this person",
  "company_overview": "Brief description of the company, size, industry",
  "talking_points": ["3-5 relevant conversation starters or pain points"],
  "inferred_title": "Their likely job title if not provided",
  "inferred_seniority": "Executive/Director/Manager/Individual Contributor",
  "persona_type": "Decision-maker/Champion/Influencer/Blocker",
  "vertical": "Industry vertical (SaaS, Finance, Healthcare, etc.)",
  "company_size": "Startup/SMB/Mid-Market/Enterprise",
  "recent_news": "Any recent company news or initiatives",
  "recommended_approach": "Best way to engage this contact"
}}

Return ONLY valid JSON, no markdown or extra text."""

        # 4. Call Perplexity API
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": PERPLEXITY_MODEL,
                    "messages": [
                        {"role": "system", "content": "You are a sales intelligence researcher. Return only valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 1500,
                }
            )

            if response.status_code != 200:
                logger.error(f"Perplexity API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=502, detail="Enrichment service error")

            data = response.json()
            raw_content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")

        # 5. Parse response (handle markdown code fences)
        content = strip_code_fences(raw_content)

        try:
            enrichment_data = json.loads(content)
        except json.JSONDecodeError:
            enrichment_data = {"raw_response": raw_content, "parse_error": True}

        # 6. Update contact with enrichment data
        update_data = {
            "enrichment_status": "completed",
            "enrichment_data": enrichment_data,
            "enriched_at": datetime.utcnow().isoformat(),
        }

        # Auto-fill empty fields
        if not contact.get("job_title") and enrichment_data.get("inferred_title"):
            update_data["job_title"] = enrichment_data["inferred_title"]
        if enrichment_data.get("persona_type"):
            update_data["persona_type"] = enrichment_data["persona_type"]
        if enrichment_data.get("vertical"):
            update_data["vertical"] = enrichment_data["vertical"]

        supabase.table("contacts").update(update_data).eq("id", contact_id).execute()

        logger.info(f"Enriched contact {contact_id}", extra={"user_id": user_id})

        return {
            "success": True,
            "contact_id": contact_id,
            "status": "completed",
            "enrichment_data": enrichment_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        # Mark as failed
        supabase.table("contacts").update({
            "enrichment_status": "failed"
        }).eq("id", contact_id).execute()
        
        logger.error(f"Enrichment failed for {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{contact_id}/status")
async def get_enrichment_status(
    contact_id: str,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get enrichment status for a contact"""
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")

    result = (
        supabase.table("contacts")
        .select("id, enrichment_status, enrichment_data, enriched_at")
        .eq("id", contact_id)
        .eq("user_id", user["id"])
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    return {
        "contact_id": contact_id,
        "status": result.data.get("enrichment_status", "pending"),
        "enrichment_data": result.data.get("enrichment_data"),
        "enriched_at": result.data.get("enriched_at"),
    }
    