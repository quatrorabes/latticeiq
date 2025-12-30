# backend/app/scoring/router.py
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Dict, Any, Optional
import os
from datetime import datetime
import jwt

# CREATE THE ROUTER FIRST
router = APIRouter(prefix="/scoring", tags=["Scoring"])

# Environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Initialize Supabase client with proper error handling
supabase = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        from supabase import create_client
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print(f"✅ Supabase initialized for scoring")
    except Exception as e:
        print(f"⚠️ Supabase init failed (scoring): {e}")
else:
    print(f"⚠️ Missing Supabase env vars - SUPABASE_URL: {bool(SUPABASE_URL)}, SUPABASE_SERVICE_KEY: {bool(SUPABASE_SERVICE_KEY)}")


def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Extract user from JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        return {"id": payload.get("sub"), "email": payload.get("email")}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


# Scoring configuration defaults
SCORING_CONFIGS = {
    "mdcp": {
        "framework": "MDCP",
        "weights": {"money": 25, "decisionmaker": 25, "champion": 25, "process": 25},
        "thresholds": {"hotMin": 71, "warmMin": 40},
        "config": {
            "moneyMinRevenue": 1000000,
            "moneyMaxRevenue": 100000000,
            "decisionmakerTitles": ["CEO", "VP", "Director", "President", "Owner", "Chief"],
            "championEngagementDays": 30,
            "processDays": 90
        }
    },
    "bant": {
        "framework": "BANT",
        "weights": {"budget": 25, "authority": 25, "need": 25, "timeline": 25},
        "thresholds": {"hotMin": 71, "warmMin": 40},
        "config": {}
    },
    "spice": {
        "framework": "SPICE",
        "weights": {"situation": 20, "problem": 20, "implication": 20, "criticalEvent": 20, "decision": 20},
        "thresholds": {"hotMin": 71, "warmMin": 40},
        "config": {}
    }
}


@router.get("/health")
async def scoring_health():
    """Health check for scoring module"""
    return {"status": "ok", "module": "scoring", "timestamp": datetime.utcnow().isoformat()}


@router.get("/config")
async def get_all_configs():
    """Get all scoring framework configurations"""
    return {"configs": SCORING_CONFIGS}


@router.get("/config/{framework}")
async def get_scoring_config(framework: str):
    """Get scoring configuration for a specific framework"""
    framework_lower = framework.lower()
    if framework_lower not in SCORING_CONFIGS:
        raise HTTPException(status_code=404, detail=f"Framework '{framework}' not found")
    return SCORING_CONFIGS[framework_lower]


def calculate_mdcp_score(contact: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate MDCP score for a contact"""
    cfg = config.get("config", {})
    thresholds = config.get("thresholds", {"hotMin": 71, "warmMin": 40})
    
    money_score = 20 if contact.get("company") else 0
    
    title = (contact.get("title") or "").lower()
    decision_titles = [t.lower() for t in cfg.get("decisionmakerTitles", ["ceo", "vp", "director"])]
    decision_score = 25 if any(dt in title for dt in decision_titles) else (10 if title else 0)
    
    champion_score = 20 if contact.get("enriched_at") else 10
    process_score = 20 if contact.get("enrichment_status") == "completed" else 5
    
    total = money_score + decision_score + champion_score + process_score
    tier = "hot" if total >= thresholds["hotMin"] else ("warm" if total >= thresholds["warmMin"] else "cold")
    
    return {
        "score": total,
        "tier": tier,
        "breakdown": {
            "money": money_score,
            "decisionmaker": decision_score,
            "champion": champion_score,
            "process": process_score
        }
    }


def calculate_bant_score(contact: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate BANT score for a contact"""
    thresholds = config.get("thresholds", {"hotMin": 71, "warmMin": 40})
    
    budget_score = 15 if contact.get("company") else 5
    
    title = (contact.get("title") or "").lower()
    authority_score = 25 if any(t in title for t in ["ceo", "vp", "president", "director", "chief"]) else 10
    
    need_score = 15 if contact.get("enrichment_status") == "completed" else 5
    timeline_score = 15 if contact.get("enriched_at") else 5
    
    total = budget_score + authority_score + need_score + timeline_score
    tier = "hot" if total >= thresholds["hotMin"] else ("warm" if total >= thresholds["warmMin"] else "cold")
    
    return {
        "score": total,
        "tier": tier,
        "breakdown": {
            "budget": budget_score,
            "authority": authority_score,
            "need": need_score,
            "timeline": timeline_score
        }
    }


def calculate_spice_score(contact: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate SPICE score for a contact"""
    thresholds = config.get("thresholds", {"hotMin": 71, "warmMin": 40})
    
    situation_score = 15 if contact.get("company") else 5
    problem_score = 15 if contact.get("enrichment_data") else 5
    implication_score = 10
    critical_event_score = 10
    decision_score = 15 if contact.get("title") else 5
    
    total = situation_score + problem_score + implication_score + critical_event_score + decision_score
    tier = "hot" if total >= thresholds["hotMin"] else ("warm" if total >= thresholds["warmMin"] else "cold")
    
    return {
        "score": total,
        "tier": tier,
        "breakdown": {
            "situation": situation_score,
            "problem": problem_score,
            "implication": implication_score,
            "criticalEvent": critical_event_score,
            "decision": decision_score
        }
    }


@router.post("/score-all")
async def score_all_contacts(
    framework: str = "mdcp",
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Score all contacts for a user using specified framework"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    framework_lower = framework.lower()
    if framework_lower not in ["mdcp", "bant", "spice"]:
        raise HTTPException(status_code=400, detail="Invalid framework. Use: mdcp, bant, or spice")
    
    try:
        response = supabase.table("contacts").select("*").eq("user_id", user["id"]).execute()
        
        if not response.data:
            return {
                "framework": framework,
                "scored": 0,
                "errors": [],
                "message": "No contacts found"
            }
        
        contacts = response.data
        config = SCORING_CONFIGS.get(framework_lower, {})
        scored_count = 0
        errors = []
        
        for contact in contacts:
            try:
                if framework_lower == "mdcp":
                    result = calculate_mdcp_score(contact, config)
                    update_data = {
                        "mdcp_score": result["score"],
                        "mdcp_tier": result["tier"]
                    }
                elif framework_lower == "bant":
                    result = calculate_bant_score(contact, config)
                    update_data = {
                        "bant_score": result["score"],
                        "bant_tier": result["tier"]
                    }
                else:  # spice
                    result = calculate_spice_score(contact, config)
                    update_data = {
                        "spice_score": result["score"],
                        "spice_tier": result["tier"]
                    }
                
                supabase.table("contacts").update(update_data).eq("id", contact["id"]).execute()
                scored_count += 1
            except Exception as e:
                errors.append({"contact_id": contact.get("id"), "error": str(e)})
        
        return {
            "framework": framework,
            "scored": scored_count,
            "total": len(contacts),
            "errors": errors,
            "message": f"Scored {scored_count}/{len(contacts)} contacts using {framework.upper()}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {str(e)}")


@router.post("/{contact_id}/score")
async def score_single_contact(
    contact_id: str,
    framework: str = "mdcp",
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Score a single contact"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    framework_lower = framework.lower()
    if framework_lower not in ["mdcp", "bant", "spice"]:
        raise HTTPException(status_code=400, detail="Invalid framework")
    
    try:
        response = supabase.table("contacts").select("*").eq("id", contact_id).eq("user_id", user["id"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact = response.data[0]
        config = SCORING_CONFIGS.get(framework_lower, {})
        
        if framework_lower == "mdcp":
            result = calculate_mdcp_score(contact, config)
            update_data = {
                "mdcp_score": result["score"],
                "mdcp_tier": result["tier"]
            }
        elif framework_lower == "bant":
            result = calculate_bant_score(contact, config)
            update_data = {
                "bant_score": result["score"],
                "bant_tier": result["tier"]
            }
        else:  # spice
            result = calculate_spice_score(contact, config)
            update_data = {
                "spice_score": result["score"],
                "spice_tier": result["tier"]
            }
        
        supabase.table("contacts").update(update_data).eq("id", contact_id).execute()
        
        return {
            "contact_id": contact_id,
            "framework": framework,
            **result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {str(e)}")
