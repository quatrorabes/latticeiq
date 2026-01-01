# ============================================================================
# FILE: backend/app/enrichment_v3/enrich_simple.py
# Simple enrichment endpoint using Perplexity API + Auto-Scoring
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

# Router
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
        print(f"✅ Supabase connected for enrichment")
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")

# Perplexity
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")
PERPLEXITY_MODEL = os.getenv("PERPLEXITY_MODEL", "sonar-pro")
PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"

# ============================================================================
# DEFAULT SCORING WEIGHTS (User-adjustable later)
# ============================================================================
DEFAULT_MDCP_WEIGHTS = {
    "market_fit": 25,        # How well they fit target market
    "decision_maker": 30,    # Authority level
    "company_profile": 25,   # Company size, revenue, growth
    "pain_indicators": 20,   # Signals of need
}

DEFAULT_BANT_WEIGHTS = {
    "budget": 25,            # Likely budget/spending power
    "authority": 30,         # Decision-making power
    "need": 25,              # Problem/need alignment
    "timeline": 20,          # Urgency indicators
}

DEFAULT_SPICE_WEIGHTS = {
    "situation": 20,         # Current state
    "pain": 25,              # Pain points identified
    "impact": 20,            # Business impact potential
    "critical_event": 20,    # Trigger events
    "evaluation": 15,        # Buying stage indicators
}

# Persona scoring multipliers
PERSONA_SCORES = {
    "decision-maker": 1.0,
    "champion": 0.85,
    "influencer": 0.7,
    "initiator": 0.6,
    "unknown": 0.5,
}

# Vertical fit scores (adjust based on your ICP)
VERTICAL_SCORES = {
    "finance": 1.0,
    "insurance": 0.95,
    "equipment leasing": 0.9,
    "saas": 0.85,
    "healthcare": 0.8,
    "other": 0.6,
    "unknown": 0.5,
}

# ============================================================================
# MODELS
# ============================================================================
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


class ScoringResult(BaseModel):
    mdcp_score: int
    mdcp_tier: str
    bant_score: int
    bant_tier: str
    spice_score: int
    spice_tier: str
    overall_score: int
    overall_tier: str
    scoring_details: Dict[str, Any]


class QuickEnrichResponse(BaseModel):
    contact_id: str
    status: str
    result: QuickEnrichResult
    scores: Optional[ScoringResult] = None
    raw_text: str
    model: str


# ============================================================================
# SCORING LOGIC
# ============================================================================
def calculate_scores(
    enrichment: QuickEnrichResult,
    contact: Dict[str, Any],
    weights: Optional[Dict[str, Dict[str, int]]] = None
) -> ScoringResult:
    """Calculate MDCP, BANT, and SPICE scores based on enrichment data."""
    
    # Use default weights if not provided
    mdcp_weights = weights.get("mdcp", DEFAULT_MDCP_WEIGHTS) if weights else DEFAULT_MDCP_WEIGHTS
    bant_weights = weights.get("bant", DEFAULT_BANT_WEIGHTS) if weights else DEFAULT_BANT_WEIGHTS
    spice_weights = weights.get("spice", DEFAULT_SPICE_WEIGHTS) if weights else DEFAULT_SPICE_WEIGHTS
    
    # Get persona and vertical multipliers
    persona = (enrichment.persona_type or "unknown").lower()
    vertical = (enrichment.vertical or "unknown").lower()
    
    persona_mult = PERSONA_SCORES.get(persona, 0.5)
    vertical_mult = VERTICAL_SCORES.get(vertical, 0.6)
    
    # Base score from data completeness
    data_score = 0
    if enrichment.summary: data_score += 15
    if enrichment.opening_line: data_score += 10
    if enrichment.persona_type: data_score += 15
    if enrichment.vertical: data_score += 10
    if enrichment.inferred_title: data_score += 10
    if enrichment.inferred_company_website: data_score += 10
    if enrichment.talking_points and len(enrichment.talking_points) >= 2: data_score += 15
    if contact.get("email"): data_score += 5
    if contact.get("phone"): data_score += 5
    if contact.get("company"): data_score += 5
    
    # Title-based authority score
    title = (enrichment.inferred_title or contact.get("title") or "").lower()
    authority_score = 50  # default
    if any(x in title for x in ["ceo", "cfo", "coo", "cto", "chief", "president", "owner", "founder"]):
        authority_score = 100
    elif any(x in title for x in ["vp", "vice president", "svp", "evp", "director"]):
        authority_score = 85
    elif any(x in title for x in ["senior", "head of", "lead", "manager"]):
        authority_score = 70
    elif any(x in title for x in ["analyst", "associate", "coordinator", "specialist"]):
        authority_score = 45
    
    # Calculate MDCP Score
    mdcp_raw = (
        (vertical_mult * 100) * (mdcp_weights["market_fit"] / 100) +
        (persona_mult * 100) * (mdcp_weights["decision_maker"] / 100) +
        (data_score) * (mdcp_weights["company_profile"] / 100) +
        (70 if enrichment.talking_points else 40) * (mdcp_weights["pain_indicators"] / 100)
    )
    mdcp_score = min(100, max(0, int(mdcp_raw)))
    
    # Calculate BANT Score
    bant_raw = (
        (vertical_mult * 80 + 20) * (bant_weights["budget"] / 100) +
        (authority_score) * (bant_weights["authority"] / 100) +
        (80 if enrichment.summary else 50) * (bant_weights["need"] / 100) +
        (60) * (bant_weights["timeline"] / 100)  # Default timeline score
    )
    bant_score = min(100, max(0, int(bant_raw)))
    
    # Calculate SPICE Score
    spice_raw = (
        (data_score) * (spice_weights["situation"] / 100) +
        (80 if enrichment.talking_points else 40) * (spice_weights["pain"] / 100) +
        (vertical_mult * 100) * (spice_weights["impact"] / 100) +
        (55) * (spice_weights["critical_event"] / 100) +  # Default
        (persona_mult * 100) * (spice_weights["evaluation"] / 100)
    )
    spice_score = min(100, max(0, int(spice_raw)))
    
    # Overall score (weighted average)
    overall_score = int((mdcp_score * 0.4) + (bant_score * 0.35) + (spice_score * 0.25))
    
    # Determine tiers
    def get_tier(score: int) -> str:
        if score >= 71: return "hot"
        if score >= 40: return "warm"
        return "cold"
    
    return ScoringResult(
        mdcp_score=mdcp_score,
        mdcp_tier=get_tier(mdcp_score),
        bant_score=bant_score,
        bant_tier=get_tier(bant_score),
        spice_score=spice_score,
        spice_tier=get_tier(spice_score),
        overall_score=overall_score,
        overall_tier=get_tier(overall_score),
        scoring_details={
            "persona_type": enrichment.persona_type,
            "persona_multiplier": persona_mult,
            "vertical": enrichment.vertical,
            "vertical_multiplier": vertical_mult,
            "authority_score": authority_score,
            "data_completeness": data_score,
            "weights_used": {
                "mdcp": mdcp_weights,
                "bant": bant_weights,
                "spice": spice_weights,
            }
        }
    )


# ============================================================================
# AUTH HELPER
# ============================================================================
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        email = payload.get("email", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return CurrentUser(id=str(user_id), email=str(email))
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")


# ============================================================================
# PERPLEXITY HELPERS
# ============================================================================
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


# ============================================================================
# ENDPOINTS
# ============================================================================
@router.post("/quick-enrich/{contact_id}", response_model=QuickEnrichResponse)
async def quick_enrich_contact(contact_id: str, user: CurrentUser = Depends(get_current_user)):
    """Quick enrich a contact using Perplexity AI + Auto-Score."""
    
    print(f"🔄 Starting enrichment for contact {contact_id} by user {user.id}")
    
    # Load contact from Supabase
    contact = None
    if supabase:
        try:
            result = supabase.table("contacts").select("*").eq("id", contact_id).execute()
            if result.data:
                contact = result.data[0]
                print(f"✅ Found contact: {contact.get('first_name')} {contact.get('last_name')}")
            else:
                print(f"⚠️ No contact found with id {contact_id}")
        except Exception as e:
            print(f"❌ Failed to load contact: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load contact: {e}")
    else:
        print(f"⚠️ Supabase not connected")
        raise HTTPException(status_code=500, detail="Database not connected")

    if not contact:
        raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

    # Mark processing
    if supabase:
        try:
            supabase.table("contacts").update({"enrichment_status": "processing"}).eq("id", contact_id).execute()
            print(f"✅ Marked contact as processing")
        except Exception as e:
            print(f"⚠️ Failed to update processing status: {e}")

    # Call Perplexity
    print(f"🔄 Calling Perplexity API...")
    prompt = _build_prompt(contact)
    raw_text = _call_perplexity(prompt)
    print(f"✅ Perplexity response received ({len(raw_text)} chars)")
    
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

    # Calculate scores
    print(f"🔄 Calculating scores...")
    scores = calculate_scores(enrichment, contact)
    print(f"✅ Scores: MDCP={scores.mdcp_score} ({scores.mdcp_tier}), BANT={scores.bant_score}, SPICE={scores.spice_score}")

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
                # Scores
                "mdcp_score": scores.mdcp_score,
                "mdcp_tier": scores.mdcp_tier,
                "bant_score": scores.bant_score,
                "bant_tier": scores.bant_tier,
                "spice_score": scores.spice_score,
                "spice_tier": scores.spice_tier,
                "overall_score": scores.overall_score,
                "overall_tier": scores.overall_tier,
                "scoring_details": scores.scoring_details,
            }

            # Fill empty fields
            if not contact.get("title") and enrichment.inferred_title:
                update_data["title"] = enrichment.inferred_title
            if not contact.get("website") and enrichment.inferred_company_website:
                update_data["website"] = enrichment.inferred_company_website

            result = supabase.table("contacts").update(update_data).eq("id", contact_id).execute()
            print(f"✅ Enrichment + scores saved to DB for {contact_id}")
            
            if not result.data:
                print(f"⚠️ Update returned no data - may not have matched any rows")
                
        except Exception as e:
            print(f"❌ Failed to save enrichment for {contact_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save enrichment: {str(e)}")

    print(f"✅ Enrichment complete for {contact_id}")
    
    return QuickEnrichResponse(
        contact_id=contact_id,
        status="completed",
        result=enrichment,
        scores=scores,
        raw_text=raw_text,
        model=PERPLEXITY_MODEL,
    )


@router.post("/score/{contact_id}")
async def score_contact(contact_id: str, user: CurrentUser = Depends(get_current_user)):
    """Score a contact based on existing enrichment data (manual scoring)."""
    
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    # Load contact
    result = supabase.table("contacts").select("*").eq("id", contact_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact = result.data[0]
    enrichment_data = contact.get("enrichment_data", {})
    quick_enrich = enrichment_data.get("quick_enrich", {})
    
    # Build enrichment object from stored data
    enrichment = QuickEnrichResult(
        summary=quick_enrich.get("summary"),
        opening_line=quick_enrich.get("opening_line"),
        persona_type=quick_enrich.get("persona_type"),
        vertical=quick_enrich.get("vertical"),
        inferred_title=quick_enrich.get("inferred_title"),
        inferred_company_website=quick_enrich.get("inferred_company_website"),
        inferred_location=quick_enrich.get("inferred_location"),
        talking_points=quick_enrich.get("talking_points"),
    )
    
    # Calculate scores
    scores = calculate_scores(enrichment, contact)
    
    # Save scores
    update_data = {
        "mdcp_score": scores.mdcp_score,
        "mdcp_tier": scores.mdcp_tier,
        "bant_score": scores.bant_score,
        "bant_tier": scores.bant_tier,
        "spice_score": scores.spice_score,
        "spice_tier": scores.spice_tier,
        "overall_score": scores.overall_score,
        "overall_tier": scores.overall_tier,
        "scoring_details": scores.scoring_details,
        "scored_at": datetime.now(timezone.utc).isoformat(),
    }
    
    supabase.table("contacts").update(update_data).eq("id", contact_id).execute()
    
    return {"status": "scored", "contact_id": contact_id, "scores": scores}


@router.get("/weights")
async def get_scoring_weights(user: CurrentUser = Depends(get_current_user)):
    """Get current scoring weights (defaults for now, user-specific later)."""
    return {
        "mdcp": DEFAULT_MDCP_WEIGHTS,
        "bant": DEFAULT_BANT_WEIGHTS,
        "spice": DEFAULT_SPICE_WEIGHTS,
        "persona_scores": PERSONA_SCORES,
        "vertical_scores": VERTICAL_SCORES,
    }
