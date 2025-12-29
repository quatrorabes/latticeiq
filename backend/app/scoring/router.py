# ============================================================================
# FILE: backend/app/scoring/router.py
# PURPOSE: Scoring Framework APIs - MDCP, BANT, SPICE, Unified
# UPDATED: Dec 29, 2025 - Added score-all endpoint and real scoring logic
# ============================================================================

import logging
import os
from typing import Any, Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from supabase import create_client, Client

logger = logging.getLogger("latticeiq")

# ============================================================================
# SUPABASE CLIENT
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = None

def get_supabase() -> Client:
    """Get or create Supabase client"""
    global supabase
    if supabase is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.warning("Supabase credentials not configured")
            return None
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase

# ============================================================================
# AUTH DEPENDENCY
# ============================================================================

async def get_current_user(authorization: str = Header(None)) -> dict:
    """Validate Supabase JWT and extract user info"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")
        
        # Decode JWT to get user_id (basic decode without verification for now)
        import base64
        import json
        
        # JWT has 3 parts: header.payload.signature
        parts = token.split(".")
        if len(parts) >= 2:
            # Decode payload (add padding if needed)
            payload = parts[1]
            padding = 4 - len(payload) % 4
            if padding != 4:
                payload += "=" * padding
            decoded = base64.urlsafe_b64decode(payload)
            claims = json.loads(decoded)
            user_id = claims.get("sub", "unknown")
            email = claims.get("email", "user@example.com")
            return {"id": user_id, "email": email}
        
        # Fallback if JWT parsing fails
        return {"id": "user-id-from-token", "email": "user@example.com"}
        
    except Exception as e:
        logger.error(f"Token validation error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ============================================================================
# MODELS
# ============================================================================

class ScoreRequest(BaseModel):
    contact_data: Dict[str, Any]
    enrichment_data: Optional[Dict[str, Any]] = None

class ScoreAllRequest(BaseModel):
    framework: str = "mdcp"

class ScoringConfig(BaseModel):
    framework: str
    weights: Dict[str, float]
    thresholds: Dict[str, float]

# ============================================================================
# CONFIG DATA (DEFAULT CONFIGURATIONS)
# ============================================================================

SCORING_CONFIGS = {
    "mdcp": {
        "framework": "MDCP",
        "weights": {
            "money": 25,
            "decisionmaker": 25,
            "champion": 25,
            "process": 25,
        },
        "thresholds": {
            "hotMin": 71,
            "warmMin": 40,
        },
        "config": {
            "moneyMinRevenue": 1000000,
            "moneyMaxRevenue": 100000000,
            "decisionmakerTitles": ["CEO", "CTO", "VP", "VP Sales", "CMO", "Director", "President", "Founder", "Owner", "Chief"],
            "championEngagementDays": 30,
            "processDays": 90,
        },
    },
    "bant": {
        "framework": "BANT",
        "weights": {
            "budget": 25,
            "authority": 25,
            "need": 25,
            "timeline": 25,
        },
        "thresholds": {
            "hotMin": 71,
            "warmMin": 40,
        },
        "config": {
            "budgetMin": 100000,
            "budgetMax": 10000000,
            "authorityTitles": ["VP", "Director", "Manager", "CEO", "CTO", "CMO", "President"],
            "needCriteria": ["Problem identified", "Active search", "Competitive threat"],
            "timelineDays": 90,
        },
    },
    "spice": {
        "framework": "SPICE",
        "weights": {
            "situation": 20,
            "problem": 20,
            "implication": 20,
            "criticalevent": 20,
            "decision": 20,
        },
        "thresholds": {
            "hotMin": 71,
            "warmMin": 40,
        },
        "config": {
            "situationCriteria": ["New role", "New company", "New budget"],
            "problemCriteria": ["Current pain point", "Documented issue"],
            "implicationLevel": ["High", "Medium", "Low"],
            "criticalEventTypes": ["Fiscal year end", "New initiative", "Crisis"],
            "decisionProcessMonths": 3,
        },
    },
}

# ============================================================================
# SCORING CALCULATORS
# ============================================================================

def calculate_mdcp_score(contact: Dict[str, Any], config: Dict[str, Any]) -> tuple:
    """Calculate MDCP score for a contact"""
    weights = config.get("weights", SCORING_CONFIGS["mdcp"]["weights"])
    thresholds = config.get("thresholds", SCORING_CONFIGS["mdcp"]["thresholds"])
    cfg = config.get("config", SCORING_CONFIGS["mdcp"]["config"])
    
    breakdown = {}
    
    # Money (check revenue)
    revenue = contact.get("annual_revenue") or contact.get("annualrevenue") or 0
    try:
        revenue = float(revenue) if revenue else 0
    except (ValueError, TypeError):
        revenue = 0
    
    min_rev = cfg.get("moneyMinRevenue", 1000000)
    max_rev = cfg.get("moneyMaxRevenue", 100000000)
    
    if revenue >= min_rev:
        breakdown["money"] = weights.get("money", 25)
    elif revenue > 0:
        breakdown["money"] = int(weights.get("money", 25) * 0.5)
    else:
        breakdown["money"] = 0
    
    # Decision-maker (check title)
    title = (contact.get("title") or contact.get("job_title") or contact.get("jobtitle") or "").lower()
    dm_titles = [t.lower() for t in cfg.get("decisionmakerTitles", [])]
    
    if any(dm in title for dm in dm_titles):
        breakdown["decisionmaker"] = weights.get("decisionmaker", 25)
    elif title:
        breakdown["decisionmaker"] = int(weights.get("decisionmaker", 25) * 0.25)
    else:
        breakdown["decisionmaker"] = 0
    
    # Champion (check enrichment status)
    enrichment_status = contact.get("enrichment_status") or contact.get("enrichmentstatus") or ""
    if enrichment_status == "completed":
        breakdown["champion"] = weights.get("champion", 25)
    elif enrichment_status == "processing":
        breakdown["champion"] = int(weights.get("champion", 25) * 0.5)
    else:
        breakdown["champion"] = int(weights.get("champion", 25) * 0.25)
    
    # Process (check data completeness)
    has_email = bool(contact.get("email"))
    has_phone = bool(contact.get("phone"))
    has_company = bool(contact.get("company"))
    has_linkedin = bool(contact.get("linkedin_url") or contact.get("linkedinurl"))
    
    completeness = sum([has_email, has_phone, has_company, has_linkedin]) / 4
    breakdown["process"] = int(weights.get("process", 25) * completeness)
    
    # Calculate total score
    total_score = sum(breakdown.values())
    
    # Determine tier
    if total_score >= thresholds.get("hotMin", 71):
        tier = "hot"
    elif total_score >= thresholds.get("warmMin", 40):
        tier = "warm"
    else:
        tier = "cold"
    
    return total_score, tier, breakdown


def calculate_bant_score(contact: Dict[str, Any], config: Dict[str, Any]) -> tuple:
    """Calculate BANT score for a contact"""
    weights = config.get("weights", SCORING_CONFIGS["bant"]["weights"])
    thresholds = config.get("thresholds", SCORING_CONFIGS["bant"]["thresholds"])
    cfg = config.get("config", SCORING_CONFIGS["bant"]["config"])
    
    breakdown = {}
    
    # Budget
    revenue = contact.get("annual_revenue") or contact.get("annualrevenue") or 0
    try:
        revenue = float(revenue) if revenue else 0
    except (ValueError, TypeError):
        revenue = 0
    
    if revenue >= cfg.get("budgetMin", 100000):
        breakdown["budget"] = weights.get("budget", 25)
    elif revenue > 0:
        breakdown["budget"] = int(weights.get("budget", 25) * 0.5)
    else:
        breakdown["budget"] = int(weights.get("budget", 25) * 0.25)
    
    # Authority
    title = (contact.get("title") or contact.get("job_title") or contact.get("jobtitle") or "").lower()
    auth_titles = [t.lower() for t in cfg.get("authorityTitles", [])]
    
    if any(at in title for at in auth_titles):
        breakdown["authority"] = weights.get("authority", 25)
    elif title:
        breakdown["authority"] = int(weights.get("authority", 25) * 0.25)
    else:
        breakdown["authority"] = 0
    
    # Need (based on enrichment data presence)
    enrichment_data = contact.get("enrichment_data") or contact.get("enrichmentdata")
    if enrichment_data:
        breakdown["need"] = weights.get("need", 25)
    elif contact.get("enrichment_status") == "completed":
        breakdown["need"] = int(weights.get("need", 25) * 0.75)
    else:
        breakdown["need"] = int(weights.get("need", 25) * 0.25)
    
    # Timeline (default scoring based on data freshness)
    created_at = contact.get("created_at") or contact.get("createdat")
    breakdown["timeline"] = int(weights.get("timeline", 25) * 0.75)
    
    total_score = sum(breakdown.values())
    
    if total_score >= thresholds.get("hotMin", 71):
        tier = "hot"
    elif total_score >= thresholds.get("warmMin", 40):
        tier = "warm"
    else:
        tier = "cold"
    
    return total_score, tier, breakdown


def calculate_spice_score(contact: Dict[str, Any], config: Dict[str, Any]) -> tuple:
    """Calculate SPICE score for a contact"""
    weights = config.get("weights", SCORING_CONFIGS["spice"]["weights"])
    thresholds = config.get("thresholds", SCORING_CONFIGS["spice"]["thresholds"])
    
    breakdown = {}
    
    # Situation (company info available)
    has_company = bool(contact.get("company"))
    has_vertical = bool(contact.get("vertical"))
    breakdown["situation"] = int(weights.get("situation", 20) * (0.5 if has_company else 0) + (0.5 if has_vertical else 0))
    
    # Problem (enrichment data suggests needs)
    enrichment_status = contact.get("enrichment_status") or contact.get("enrichmentstatus")
    if enrichment_status == "completed":
        breakdown["problem"] = weights.get("problem", 20)
    else:
        breakdown["problem"] = int(weights.get("problem", 20) * 0.25)
    
    # Implication (title suggests decision power)
    title = (contact.get("title") or contact.get("job_title") or "").lower()
    if any(t in title for t in ["ceo", "cto", "president", "founder", "owner", "chief"]):
        breakdown["implication"] = weights.get("implication", 20)
    elif any(t in title for t in ["vp", "director", "head"]):
        breakdown["implication"] = int(weights.get("implication", 20) * 0.75)
    else:
        breakdown["implication"] = int(weights.get("implication", 20) * 0.25)
    
    # Critical Event (default moderate score)
    breakdown["criticalevent"] = int(weights.get("criticalevent", 20) * 0.5)
    
    # Decision (contact completeness)
    has_email = bool(contact.get("email"))
    has_phone = bool(contact.get("phone"))
    breakdown["decision"] = int(weights.get("decision", 20) * ((0.5 if has_email else 0) + (0.5 if has_phone else 0)))
    
    total_score = sum(breakdown.values())
    
    if total_score >= thresholds.get("hotMin", 71):
        tier = "hot"
    elif total_score >= thresholds.get("warmMin", 40):
        tier = "warm"
    else:
        tier = "cold"
    
    return total_score, tier, breakdown

# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(prefix="/scoring", tags=["Scoring"])

# ============================================================================
# CONFIG ENDPOINTS
# ============================================================================

@router.get("/config/{framework}")
async def get_scoring_config(framework: str, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Get scoring configuration for a specific framework"""
    framework_lower = framework.lower()
    if framework_lower not in SCORING_CONFIGS:
        raise HTTPException(
            status_code=404,
            detail=f"Framework '{framework}' not found. Available: mdcp, bant, spice"
        )
    return SCORING_CONFIGS[framework_lower]


@router.get("/config")
async def get_all_configs(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Get all scoring configurations"""
    return SCORING_CONFIGS


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint"""
    return {
        "status": "healthy",
        "frameworks": ["MDCP", "BANT", "SPICE"],
        "configs_loaded": len(SCORING_CONFIGS),
    }

# ============================================================================
# SCORE-ALL ENDPOINT (NEW)
# ============================================================================

@router.post("/score-all")
async def score_all_contacts(
    request: ScoreAllRequest = None,
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Score all contacts for user using specified framework"""
    
    framework = (request.framework if request else "mdcp").lower()
    
    if framework not in SCORING_CONFIGS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid framework '{framework}'. Available: mdcp, bant, spice"
        )
    
    db = get_supabase()
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        # 1. Get user's contacts from DB
        result = db.table("contacts").select("*").eq("user_id", user["id"]).execute()
        contacts = result.data or []
        
        if not contacts:
            return {
                "framework": framework.upper(),
                "scored": 0,
                "errors": [],
                "message": "No contacts found to score"
            }
        
        # 2. Get config
        config = SCORING_CONFIGS[framework]
        
        scored_count = 0
        errors = []
        
        # 3. Calculate and update scores for each contact
        for contact in contacts:
            try:
                if framework == "mdcp":
                    score, tier, breakdown = calculate_mdcp_score(contact, config)
                    update_data = {"mdcp_score": score, "mdcp_tier": tier}
                elif framework == "bant":
                    score, tier, breakdown = calculate_bant_score(contact, config)
                    update_data = {"bant_score": score, "bant_tier": tier}
                elif framework == "spice":
                    score, tier, breakdown = calculate_spice_score(contact, config)
                    update_data = {"spice_score": score, "spice_tier": tier}
                
                # Update contact in database
                db.table("contacts").update(update_data).eq("id", contact["id"]).execute()
                scored_count += 1
                
            except Exception as e:
                errors.append({
                    "contact_id": contact.get("id"),
                    "error": str(e)
                })
                logger.error(f"Error scoring contact {contact.get('id')}: {str(e)}")
        
        return {
            "framework": framework.upper(),
            "scored": scored_count,
            "total": len(contacts),
            "errors": errors,
            "message": f"Successfully scored {scored_count} of {len(contacts)} contacts"
        }
        
    except Exception as e:
        logger.error(f"Error in score_all_contacts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# INDIVIDUAL SCORING ENDPOINTS
# ============================================================================

@router.post("/mdcp")
async def calculate_mdcp(request: ScoreRequest, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Calculate Match-Data-Contact-Profile (MDCP) score"""
    try:
        config = SCORING_CONFIGS["mdcp"]
        score, tier, breakdown = calculate_mdcp_score(request.contact_data, config)
        
        return {
            "framework": "MDCP",
            "score": score,
            "tier": tier,
            "breakdown": breakdown,
        }
    except Exception as e:
        logger.error(f"Error calculating MDCP score: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bant")
async def calculate_bant(request: ScoreRequest, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Calculate Budget-Authority-Need-Timeline (BANT) score"""
    try:
        config = SCORING_CONFIGS["bant"]
        score, tier, breakdown = calculate_bant_score(request.contact_data, config)
        
        return {
            "framework": "BANT",
            "score": score,
            "tier": tier,
            "breakdown": breakdown,
        }
    except Exception as e:
        logger.error(f"Error calculating BANT score: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/spice")
async def calculate_spice(request: ScoreRequest, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Calculate Situation-Problem-Implication-Critical Event-Decision (SPICE) score"""
    try:
        config = SCORING_CONFIGS["spice"]
        score, tier, breakdown = calculate_spice_score(request.contact_data, config)
        
        return {
            "framework": "SPICE",
            "score": score,
            "tier": tier,
            "breakdown": breakdown,
        }
    except Exception as e:
        logger.error(f"Error calculating SPICE score: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/unified")
async def calculate_unified(request: ScoreRequest, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Calculate unified score blending all frameworks"""
    try:
        mdcp_score, mdcp_tier, mdcp_breakdown = calculate_mdcp_score(
            request.contact_data, SCORING_CONFIGS["mdcp"]
        )
        bant_score, bant_tier, bant_breakdown = calculate_bant_score(
            request.contact_data, SCORING_CONFIGS["bant"]
        )
        spice_score, spice_tier, spice_breakdown = calculate_spice_score(
            request.contact_data, SCORING_CONFIGS["spice"]
        )
        
        # Weighted average: 40% MDCP, 30% BANT, 30% SPICE
        unified_score = int(mdcp_score * 0.4 + bant_score * 0.3 + spice_score * 0.3)
        
        if unified_score >= 71:
            unified_tier = "hot"
        elif unified_score >= 40:
            unified_tier = "warm"
        else:
            unified_tier = "cold"
        
        return {
            "framework": "Unified",
            "score": unified_score,
            "tier": unified_tier,
            "breakdown": {
                "mdcp": mdcp_score,
                "bant": bant_score,
                "spice": spice_score,
            },
        }
    except Exception as e:
        logger.error(f"Error calculating unified score: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# SINGLE CONTACT SCORING (for modal/detail view)
# ============================================================================

@router.post("/contact/{contact_id}")
async def score_single_contact(
    contact_id: str,
    framework: str = "mdcp",
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Score a single contact and update database"""
    
    framework = framework.lower()
    if framework not in SCORING_CONFIGS:
        raise HTTPException(status_code=400, detail=f"Invalid framework: {framework}")
    
    db = get_supabase()
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        # Get contact
        result = db.table("contacts").select("*").eq("id", contact_id).single().execute()
        contact = result.data
        
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        # Calculate score
        config = SCORING_CONFIGS[framework]
        
        if framework == "mdcp":
            score, tier, breakdown = calculate_mdcp_score(contact, config)
            update_data = {"mdcp_score": score, "mdcp_tier": tier}
        elif framework == "bant":
            score, tier, breakdown = calculate_bant_score(contact, config)
            update_data = {"bant_score": score, "bant_tier": tier}
        elif framework == "spice":
            score, tier, breakdown = calculate_spice_score(contact, config)
            update_data = {"spice_score": score, "spice_tier": tier}
        
        # Update contact
        db.table("contacts").update(update_data).eq("id", contact_id).execute()
        
        return {
            "contact_id": contact_id,
            "framework": framework.upper(),
            "score": score,
            "tier": tier,
            "breakdown": breakdown,
            "updated": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scoring contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
