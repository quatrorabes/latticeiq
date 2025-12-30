# ============================================================================
# FILE: backend/app/scoring/router.py
# PURPOSE: Scoring Framework APIs - MDCP, BANT, SPICE + batch score-all
# SCHEMA: contacts.user_id, contacts.mdcp_score, contacts.bant_score, contacts.spice_score, *_tier
# UPDATED: Dec 29, 2025 - Fix Supabase write failures, correct user_id scoping
# ============================================================================

import os
import logging
from typing import Any, Dict, List, Optional, Tuple

import jwt  # PyJWT
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from supabase import create_client, Client

logger = logging.getLogger("latticeiq")

# ============================================================================
# SUPABASE CLIENTS
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

_supabase_anon: Optional[Client] = None
_supabase_service: Optional[Client] = None

def get_supabase_anon() -> Optional[Client]:
    global _supabase_anon
    if _supabase_anon is None and SUPABASE_URL and SUPABASE_ANON_KEY:
        _supabase_anon = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _supabase_anon

def get_supabase_service() -> Optional[Client]:
    global _supabase_service
    if _supabase_service is None and SUPABASE_URL and SUPABASE_SERVICE_KEY:
        _supabase_service = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_service

def get_db_client_for_writes() -> Client:
    """
    Prefer service role for backend writes (bypasses RLS).
    If not present, fall back to anon client (may fail under RLS).
    """
    svc = get_supabase_service()
    if svc:
        return svc
    anon = get_supabase_anon()
    if anon:
        return anon
    raise HTTPException(status_code=503, detail="Supabase not configured")

# ============================================================================
# AUTH
# ============================================================================

class CurrentUser(BaseModel):
    id: str
    email: str = ""

async def get_current_user(authorization: str = Header(None)) -> CurrentUser:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    token = parts[1]
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        email = payload.get("email", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user id")
        return CurrentUser(id=str(user_id), email=str(email))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth decode error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

# ============================================================================
# REQUEST MODELS
# ============================================================================

class ScoreRequest(BaseModel):
    contact_data: Dict[str, Any]
    enrichment_data: Optional[Dict[str, Any]] = None

class ScoreAllRequest(BaseModel):
    framework: str = "mdcp"  # mdcp | bant | spice

# ============================================================================
# CONFIGS
# ============================================================================

SCORING_CONFIGS: Dict[str, Dict[str, Any]] = {
    "mdcp": {
        "framework": "MDCP",
        "weights": {"money": 25, "decisionmaker": 25, "champion": 25, "process": 25},
        "thresholds": {"hotMin": 71, "warmMin": 40},
        "config": {
            "moneyMinRevenue": 1_000_000,
            "decisionmakerTitles": ["CEO", "CTO", "COO", "CFO", "Chief", "President", "Founder", "Owner", "VP", "Director"],
        },
    },
    "bant": {
        "framework": "BANT",
        "weights": {"budget": 25, "authority": 25, "need": 25, "timeline": 25},
        "thresholds": {"hotMin": 71, "warmMin": 40},
        "config": {"authorityTitles": ["CEO", "CTO", "COO", "CFO", "Chief", "VP", "Director", "Head"]},
    },
    "spice": {
        "framework": "SPICE",
        "weights": {"situation": 20, "problem": 20, "implication": 20, "criticalevent": 20, "decision": 20},
        "thresholds": {"hotMin": 71, "warmMin": 40},
        "config": {},
    },
}

# ============================================================================
# SCORING HELPERS
# ============================================================================

def _tier_from_score(score: int, thresholds: Dict[str, Any]) -> str:
    hot_min = int(thresholds.get("hotMin", 71))
    warm_min = int(thresholds.get("warmMin", 40))
    if score >= hot_min:
        return "hot"
    if score >= warm_min:
        return "warm"
    return "cold"

def _safe_lower(v: Any) -> str:
    return str(v or "").lower()

def calculate_mdcp(contact: Dict[str, Any], cfg: Dict[str, Any]) -> Tuple[int, str, Dict[str, int]]:
    weights = cfg["weights"]
    thresholds = cfg["thresholds"]
    rules = cfg.get("config", {})

    revenue = contact.get("annual_revenue") or 0
    try:
        revenue_f = float(revenue) if revenue is not None else 0.0
    except Exception:
        revenue_f = 0.0

    title = _safe_lower(contact.get("job_title"))
    dm_titles = [t.lower() for t in rules.get("decisionmakerTitles", [])]

    has_email = bool(contact.get("email"))
    has_company = bool(contact.get("company"))
    has_phone = bool(contact.get("phone"))
    has_linkedin = bool(contact.get("linkedin_url"))

    # Money
    money = weights["money"] if revenue_f >= float(rules.get("moneyMinRevenue", 1_000_000)) else (weights["money"] // 2 if revenue_f > 0 else 0)

    # Decision-maker
    decisionmaker = weights["decisionmaker"] if any(k in title for k in dm_titles) else (weights["decisionmaker"] // 4 if title else 0)

    # Champion proxy: enrichment status
    status_val = _safe_lower(contact.get("enrichment_status"))
    if status_val == "completed":
        champion = weights["champion"]
    elif status_val == "processing":
        champion = weights["champion"] // 2
    else:
        champion = weights["champion"] // 4

    # Process proxy: completeness
    completeness = (int(has_email) + int(has_company) + int(has_phone) + int(has_linkedin)) / 4.0
    process = int(weights["process"] * completeness)

    breakdown = {"money": int(money), "decisionmaker": int(decisionmaker), "champion": int(champion), "process": int(process)}
    score = int(sum(breakdown.values()))
    tier = _tier_from_score(score, thresholds)
    return score, tier, breakdown

def calculate_bant(contact: Dict[str, Any], cfg: Dict[str, Any]) -> Tuple[int, str, Dict[str, int]]:
    weights = cfg["weights"]
    thresholds = cfg["thresholds"]
    rules = cfg.get("config", {})

    title = _safe_lower(contact.get("job_title"))
    auth_titles = [t.lower() for t in rules.get("authorityTitles", [])]

    # Budget proxy: revenue known
    revenue = contact.get("annual_revenue") or 0
    try:
        revenue_f = float(revenue) if revenue is not None else 0.0
    except Exception:
        revenue_f = 0.0
    budget = weights["budget"] if revenue_f > 0 else weights["budget"] // 4

    # Authority: title-based
    authority = weights["authority"] if any(k in title for k in auth_titles) else (weights["authority"] // 4 if title else 0)

    # Need: enrichment_data exists
    enrichment = contact.get("enrichment_data")
    need = weights["need"] if enrichment else weights["need"] // 4

    # Timeline: default mid
    timeline = int(weights["timeline"] * 0.75)

    breakdown = {"budget": int(budget), "authority": int(authority), "need": int(need), "timeline": int(timeline)}
    score = int(sum(breakdown.values()))
    tier = _tier_from_score(score, thresholds)
    return score, tier, breakdown

def calculate_spice(contact: Dict[str, Any], cfg: Dict[str, Any]) -> Tuple[int, str, Dict[str, int]]:
    weights = cfg["weights"]
    thresholds = cfg["thresholds"]

    title = _safe_lower(contact.get("job_title"))

    has_company = bool(contact.get("company"))
    has_vertical = bool(contact.get("vertical"))
    has_email = bool(contact.get("email"))
    has_phone = bool(contact.get("phone"))

    enrichment_status = _safe_lower(contact.get("enrichment_status"))

    situation = int(weights["situation"] * (0.5 * int(has_company) + 0.5 * int(has_vertical)))
    problem = weights["problem"] if enrichment_status == "completed" else weights["problem"] // 4

    if any(k in title for k in ["ceo", "cto", "cfo", "chief", "president", "founder", "owner"]):
        implication = weights["implication"]
    elif any(k in title for k in ["vp", "director", "head"]):
        implication = int(weights["implication"] * 0.75)
    else:
        implication = weights["implication"] // 4

    criticalevent = int(weights["criticalevent"] * 0.5)
    decision = int(weights["decision"] * (0.5 * int(has_email) + 0.5 * int(has_phone)))

    breakdown = {
        "situation": int(situation),
        "problem": int(problem),
        "implication": int(implication),
        "criticalevent": int(criticalevent),
        "decision": int(decision),
    }
    score = int(sum(breakdown.values()))
    tier = _tier_from_score(score, thresholds)
    return score, tier, breakdown

# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(prefix="/scoring", tags=["Scoring"])

@router.get("/health")
async def health_check() -> Dict[str, Any]:
    return {"status": "healthy", "frameworks": list(SCORING_CONFIGS.keys())}

@router.post("/score-all")
async def score_all(payload: ScoreAllRequest, user: CurrentUser = Depends(get_current_user)) -> Dict[str, Any]:
    framework = (payload.framework or "mdcp").lower().strip()
    if framework not in SCORING_CONFIGS:
        raise HTTPException(status_code=400, detail="Framework must be one of: mdcp, bant, spice")

    db = get_db_client_for_writes()

    # IMPORTANT: your schema uses user_id (not userid)
    try:
        contacts_res = (
            db.table("contacts")
            .select("id,user_id,workspace_id,email,first_name,last_name,company,job_title,phone,linkedin_url,website,vertical,persona_type,annual_revenue,enrichment_status,enrichment_data,mdcp_score,bant_score,spice_score,mdcp_tier,bant_tier,spice_tier")
            .eq("user_id", user.id)
            .execute()
        )
        contacts = contacts_res.data or []
    except Exception as e:
        logger.error(f"Failed to fetch contacts for scoring: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch contacts for scoring")

    cfg = SCORING_CONFIGS[framework]
    updated = 0
    failed: List[Dict[str, Any]] = []

    for c in contacts:
        contact_id = c.get("id")
        try:
            if framework == "mdcp":
                score, tier, _ = calculate_mdcp(c, cfg)
                update_payload = {"mdcp_score": score, "mdcp_tier": tier}
            elif framework == "bant":
                score, tier, _ = calculate_bant(c, cfg)
                update_payload = {"bant_score": score, "bant_tier": tier}
            else:
                score, tier, _ = calculate_spice(c, cfg)
                update_payload = {"spice_score": score, "spice_tier": tier}

            # Safety scope: update by id AND user_id
            res = (
                db.table("contacts")
                .update(update_payload)
                .eq("id", contact_id)
                .eq("user_id", user.id)
                .execute()
            )

            # If Supabase edge returns HTML/None, treat as failure
            if getattr(res, "data", None) is None:
                raise RuntimeError("Supabase update returned no JSON data (possible edge error)")

            updated += 1

        except Exception as e:
            err_text = str(e)
            logger.error(f"Error scoring contact {contact_id}: {err_text}")
            failed.append({"contact_id": str(contact_id), "error": err_text})

    return {
        "ok": True,
        "framework": framework,
        "user_id": user.id,
        "total_contacts": len(contacts),
        "updated": updated,
        "failed": failed[:25],
        "message": f"Scored {updated}/{len(contacts)} contacts using {framework.upper()}",
    }
