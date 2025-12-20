"""
quick_enrich.py

Quick-and-dirty enrichment for LatticeIQ.

Goal:
- Use Perplexity (sonar-pro) to quickly populate a few key fields for a contact
- Save structured JSON into contacts.enrichment_data["quick_enrich"]
- Set contacts.enrichment_status and contacts.enriched_at

Notes:
- No external dependency like "requests" (stdlib only) so it imports cleanly on Render.
- Auth dependency can be injected from main.py via set_auth_dependency(), but it also
  includes a fallback auth implementation.

Env:
- SUPABASE_URL
- SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY
- PERPLEXITY_API_KEY (note: your other docs sometimes call it PERPLEXITYAPIKEY; for this
  module we look for PERPLEXITY_API_KEY by default—match your Render env var name) [file:15]
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

# -----------------------------------------------------------------------------
# Router
# -----------------------------------------------------------------------------

router = APIRouter(prefix="/api/quick-enrich", tags=["quick-enrich"])

# -----------------------------------------------------------------------------
# Supabase
# -----------------------------------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------------------------------------------------------------
# Perplexity config (match your reference: /chat/completions, sonar-pro) [file:16]
# -----------------------------------------------------------------------------

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
PERPLEXITY_MODEL = os.getenv("PERPLEXITY_MODEL", "sonar-pro")
PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"

# -----------------------------------------------------------------------------
# Auth (injectable)
# -----------------------------------------------------------------------------

security = HTTPBearer(auto_error=True)
_auth_dependency: Optional[Callable[..., Any]] = None


def set_auth_dependency(dep: Callable[..., Any]) -> None:
    """
    Allows main.py to inject its get_current_user dependency (so we reuse your
    proven Supabase JWT verification flow).
    """
    global _auth_dependency
    _auth_dependency = dep


class CurrentUser(BaseModel):
    id: str
    email: Optional[EmailStr] = None


async def _fallback_get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
    """
    Fallback JWT auth validation via supabase.auth.get_user(token).
    """
    try:
        user_response = supabase.auth.get_user(credentials.credentials)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token (no user)")
        return CurrentUser(id=user.id, email=user.email)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user() -> CurrentUser:
    """
    Use injected dependency if present, otherwise fallback.
    """
    if _auth_dependency is not None:
        return await _auth_dependency()  # type: ignore[misc]
    # No injected dependency; fallback path will still be enforced at route layer
    raise HTTPException(status_code=500, detail="Auth dependency not wired")


def _get_user_dependency():
    """
    Returns the correct dependency callable for Depends().
    If injected, we return the injected function; otherwise fallback implementation.
    """
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
# Core logic
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

    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        PERPLEXITY_URL,
        data=data,
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
    """
    Best-effort JSON parse. If Perplexity returns extra text, attempt to extract
    the first JSON object block.
    """
    try:
        parsed = json.loads(raw_text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    # Fallback: try to locate a JSON object in the text
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
    """
    Only fill fields if currently missing; always stamp enrichment fields.
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    update: Dict[str, Any] = {
        "enrichment_status": "completed",
        "enriched_at": now_iso,
    }

    # Store everything under enrichment_data.quick_enrich
    update["enrichment_data"] = {
        "quick_enrich": result.dict(),
        "provider": "perplexity",
        "model": PERPLEXITY_MODEL,
        "generated_at": now_iso,
        "raw_text": raw_text,
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

    # Mark processing (best-effort)
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
        persona_type=parsed.get("persona
