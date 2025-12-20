"""
quick_enrich.py

Quick-and-dirty enrichment endpoint for LatticeIQ.

- Input: contact_id (UUID)
- Loads contact from Supabase (scoped by user_id)
- Calls Perplexity /chat/completions (sonar-pro) for a small JSON payload
- Writes results into:
    contacts.enrichment_status
    contacts.enriched_at
    contacts.enrichment_data (JSONB) -> { quick_enrich: {...}, provider, model, generated_at, raw_text }

Env (supports both naming styles):
- SUPABASE_URL or SUPABASEURL
- SUPABASE_KEY or SUPABASEKEY or SUPABASE_SERVICE_ROLE_KEY
- PERPLEXITY_API_KEY or PERPLEXITYAPIKEY
- PERPLEXITY_MODEL (optional, default sonar-pro)
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from uuid import UUID

import urllib.request
import urllib.error

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from supabase import Client, create_client

router = APIRouter(prefix="/api/quick-enrich", tags=["quick-enrich"])

# -----------------------------------------------------------------------------
# Supabase
# -----------------------------------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("SUPABASEURL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASEKEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------------------------------------------------------------
# Perplexity
# -----------------------------------------------------------------------------

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY") or os.getenv("PERPLEXITYAPIKEY")
PERPLEXITY_MODEL = os.getenv("PERPLEXITY_MODEL", "sonar-pro")
PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"

# -----------------------------------------------------------------------------
# Auth injection (from main.py)
# -----------------------------------------------------------------------------

security = HTTPBearer(auto_error=True)
_auth_dependency: Optional[Callable[..., Any]] = None


def set_auth_dependency(dep: Callable[..., Any]) -> None:
    global _auth_dependency
    _auth_dependency = dep


class CurrentUser(BaseModel):
    id: str
    email: Optional[EmailStr] = None


async def _fallback_get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
    try:
        user_response = supabase.auth.get_user(credentials.credentials)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token (no user)")
        return CurrentUser(id=user.id, email=user.email)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def _get_user_dependency():
    # If main.py injects get_current_user, use it; else use fallback
    return _auth_dependency or _fallback_get_current_user


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------

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


# -----------------------------------------------------------------------------
# Core helpers
# -----------------------------------------------------------------------------

def _build_prompt(contact: Dict[str, Any]) -> str:
    firstname = contact.get("firstname") or ""
    lastname = contact.get("lastname") or ""
    company = contact.get("company") or ""
    email = contact.get("email") or ""
    linkedin_url = contact.get("linkedin_url") or ""
    current_title = contact.get("title") or ""

    return f"""
You are a sales intelligence assistant.

Research this person using public web sources:
- First name: {firstname}
- Last name: {lastname}
- Company: {company}
- Email: {email}
- LinkedIn URL: {linkedin_url}
- Current title in CRM (may be blank): {current_title}

Return ONE valid JSON object only (no markdown) with these keys:

{{
  "summary": "2-3 sentence sales-relevant summary of person + company context.",
  "opening_line": "One short personalized outreach opener.",
  "persona_type": "Decision-maker | Champion | Influencer | Initiator | Unknown",
  "vertical": "SaaS | Insurance | Equipment Leasing | Finance | Healthcare | Other | Unknown",
  "inferred_title": "Best guess job title if missing.",
  "inferred_company_website": "Company website if confidently known else null.",
  "inferred_location": "City/Region if confidently known else null.",
  "talking_points": ["3-6 short bullets as strings"]
}}

Rules:
- JSON only, no extra text.
- Keep it concise and pragmatic for outbound sales.
""".strip()


def _perplexity_chat(prompt: str) -> str:
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
        parsed = json.loads(body)
        return parsed["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8") if hasattr(e, "read") else str(e)
        raise HTTPException(status_code=502, detail=f"Perplexity HTTPError: {detail}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Perplexity request failed: {e}")


def _safe_parse_json(raw_text: str) -> Dict[str, Any]:
    try:
        parsed = json.loads(raw_text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            parsed = json.loads(raw_text[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    return {"summary": raw_text.strip()}


def _build_update(contact: Dict[str, Any], result: QuickEnrichResult, raw_text: str) -> Dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat()

    update: Dict[str, Any] = {
        "enrichment_status": "completed",
        "enriched_at": now_iso,
        "enrichment_data": {
            "quick_enrich": result.model_dump(),
            "provider": "perplexity",
            "model": PERPLEXITY_MODEL,
            "generated_at": now_iso,
            "raw_text": raw_text,
        },
    }

    # Opportunistically populate core columns if empty
    if (not contact.get("title")) and result.inferred_title:
        update["title"] = result.inferred_title
    if (not contact.get("website")) and result.inferred_company_website:
        update["website"] = result.inferred_company_website
    if (not contact.get("vertical")) and result.vertical:
        update["vertical"] = result.vertical
    if (not contact.get("persona_type")) and result.persona_type:
        update["persona_type"] = result.persona_type

    return update


# -----------------------------------------------------------------------------
# Endpoint
# -----------------------------------------------------------------------------

@router.post("/{contact_id}", response_model=QuickEnrichResponse)
async def quick_enrich_contact(
    contact_id: UUID,
    user: CurrentUser = Depends(_get_user_dependency()),
) -> QuickEnrichResponse:
    # Load contact (scoped by user_id)
    result = (
        supabase.table("contacts")
        .select("*")
        .eq("id", str(contact_id))
        .eq("user_id", user.id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact = result.data[0]

    # Best-effort: set processing
    try:
        supabase.table("contacts").update({"enrichment_status": "processing"}).eq("id", str(contact_id)).eq(
            "user_id", user.id
        ).execute()
    except Exception:
        pass

    prompt = _build_prompt(contact)
    raw_text = _perplexity_chat(prompt)

    parsed = _safe_parse_json(raw_text)
    result_model = QuickEnrichResult(
        summary=parsed.get("summary"),
        opening_line=parsed.get("opening_line"),
        persona_type=parsed.get("persona_type"),
        vertical=parsed.get("vertical"),
        inferred_title=parsed.get("inferred_title"),
        inferred_company_website=parsed.get("inferred_company_website"),
        inferred_location=parsed.get("inferred_location"),
        talking_points=parsed.get("talking_points"),
    )

    update_data = _build_update(contact, result_model, raw_text)

    update_result = (
        supabase.table("contacts")
        .update(update_data)
        .eq("id", str(contact_id))
        .eq("user_id", user.id)
        .execute()
    )

    if not update_result.data:
        raise HTTPException(status_code=500, detail="Failed to persist quick enrichment")

    return QuickEnrichResponse(
        contact_id=str(contact_id),
        status="completed",
        result=result_model,
        raw_text=raw_text,
        model=PERPLEXITY_MODEL,
    )
