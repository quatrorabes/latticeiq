# ============================================================================
# FILE: backend/app/enrichment_v3/enrich_simple.py
# Simple enrichment endpoint using Perplexity API
# ============================================================================
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import urllib.request
import urllib.error

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from supabase import Client, create_client
import jwt

# Router with NO prefix - main.py adds /api/v3
router = APIRouter(prefix="/enrichment", tags=["enrichment"])

# Auth
security = HTTPBearer(auto_error=True)

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception:
        pass

# Perplexity
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")
PERPLEXITY_MODEL = os.getenv("PERPLEXITY_MODEL", "sonar-pro")
PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"


# Models
class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None


class QuickEnrichResult(BaseModel):
    summary: Optional[str] = None
    opening_line: Optional[str] = None
    persona_type: Optional[str] = None
    vertical: Optional[str] = None
    inferred_title: Optional[str] = None
    inferred_company_website: Optional[str] = None
    inferred_location: Optional[str] = None
    talking_points: Optional[List[str]] = None


class QuickEnrichResponse(BaseModel):
    contact_id: str
    status: str
    result: QuickEnrichResult
    raw_text: str
    model: str


# Auth helper
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        email = payload.get("email", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return CurrentUser(id=str(user_id), email=str(email))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# Helpers
def _build_prompt(contact: Dict[str, Any]) -> str:
    first_name = contact.get("first_name") or ""
    last_name = contact.get("last_name") or ""
    company = contact.get("company") or ""
    email = contact.get("email") or ""
    linkedin_url = contact.get("linkedin_url") or ""
    title = contact.get("title") or ""

    return f"""You are a sales intelligence assistant. Research this person using public web sources:
- Name: {first_name} {last_name}
- Company: {company}
- Email: {email}
- LinkedIn: {linkedin_url}
- Title: {title}

Return ONE valid JSON object only (no markdown):
{{
  "summary": "2-3 sentence sales-relevant summary.",
  "opening_line": "One personalized outreach opener.",
  "persona_type": "Decision-maker|Champion|Influencer|Initiator|Unknown",
  "vertical": "SaaS|Insurance|Equipment Leasing|Finance|Healthcare|Other|Unknown",
  "inferred_title": "Best guess job title if missing.",
  "inferred_company_website": "Company website or null.",
  "inferred_location": "City/Region or null.",
  "talking_points": ["Point 1", "Point 2", "Point 3"]
}}

JSON only, no extra text."""


def _call_perplexity(prompt: str) -> str:
    if not PERPLEXITY_API_KEY:
        raise HTTPException(status_code=500, detail="PERPLEXITY_API_KEY not set")

    payload = {
        "model": PERPLEXITY_MODEL,
        "messages": [
            {"role": "system", "content": "Return concise sales intelligence in strict JSON."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 700,
        "temperature": 0.3,
    }

    req = urllib.request.Request(
        PERPLEXITY_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8") if hasattr(e, "read") else str(e)
        raise HTTPException(status_code=502, detail=f"Perplexity error: {detail}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Perplexity failed: {str(e)}")


def _parse_json(raw: str) -> Dict[str, Any]:
    try:
        return json.loads(raw)
    except Exception:
        pass
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(raw[start:end+1])
        except Exception:
            pass
    return {"summary": raw.strip()}


# ENDPOINT - uses hyphen to match frontend
@router.post("/quick-enrich/{contact_id}", response_model=QuickEnrichResponse)
async def quick_enrich_contact(contact_id: str, user: CurrentUser = Depends(get_current_user)):
    """Quick enrich a contact using Perplexity AI."""
    
    # Load contact from Supabase
    contact = None
    if supabase:
        try:
            result = supabase.table("contacts").select("*").eq("id", contact_id).eq("user_id", user.id).execute()
            if result.data:
                contact = result.data[0]
        except Exception:
            pass

    # Fallback if no contact found
    if not contact:
        contact = {"id": contact_id, "first_name": "", "last_name": "", "email": "", "company": ""}

    # Mark processing
    if supabase:
        try:
            supabase.table("contacts").update({"enrichment_status": "processing"}).eq("id", contact_id).eq("user_id", user.id).execute()
        except Exception:
            pass

    # Call Perplexity
    prompt = _build_prompt(contact)
    raw_text = _call_perplexity(prompt)
    parsed = _parse_json(raw_text)

    enrichment = QuickEnrichResult(
        summary=parsed.get("summary"),
        opening_line=parsed.get("opening_line"),
        persona_type=parsed.get("persona_type"),
        vertical=parsed.get("vertical"),
        inferred_title=parsed.get("inferred_title"),
        inferred_company_website=parsed.get("inferred_company_website"),
        inferred_location=parsed.get("inferred_location"),
        talking_points=parsed.get("talking_points"),
    )

    # Save to DB
    if supabase:
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            update_data = {
                "enrichment_status": "completed",
                "enriched_at": now_iso,
                "enrichment_data": {
                    "quick_enrich": enrichment.dict(),
                    "provider": "perplexity",
                    "model": PERPLEXITY_MODEL,
                    "generated_at": now_iso,
                    "raw_text": raw_text,
                },
            }

            # Fill empty fields
            if not contact.get("title") and enrichment.inferred_title:
                update_data["title"] = enrichment.inferred_title
            if not contact.get("website") and enrichment.inferred_company_website:
                update_data["website"] = enrichment.inferred_company_website

            supabase.table("contacts").update(update_data).eq("id", contact_id).eq("user_id", user.id).execute()
        except Exception:
            pass

    return QuickEnrichResponse(
        contact_id=contact_id,
        status="completed",
        result=enrichment,
        raw_text=raw_text,
        model=PERPLEXITY_MODEL,
    )
