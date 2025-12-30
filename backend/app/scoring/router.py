# backend/app/scoring/router.py
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging
import os
from supabase import create_client, Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v3/scoring", tags=["scoring"])

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# ============================================================================
# SCORING CONFIGURATIONS (In-memory for now)
# ============================================================================
SCORING_CONFIGS = {
    "mdcp": {
        "framework": "MDCP",
        "weights": {
            "money": 25,
            "decisionmaker": 25,
            "champion": 25,
            "process": 25
        },
        "thresholds": {
            "hotMin": 71,
            "warmMin": 40
        },
        "config": {
            "moneyMinRevenue": 1000000,
            "moneyMaxRevenue": 100000000,
            "decisionmakerTitles": ["CEO", "CFO", "CTO", "VP", "Director", "President", "Owner", "Founder"],
            "championEngagementDays": 30,
            "processDays": 90
        }
    },
    "bant": {
        "framework": "BANT",
        "weights": {
            "budget": 25,
            "authority": 25,
            "need": 25,
            "timeline": 25
        },
        "thresholds": {
            "hotMin": 71,
            "warmMin": 40
        },
        "config": {
            "budgetMin": 50000,
            "budgetMax": 1000000,
            "authorityTitles": ["CEO", "CFO", "CTO", "VP", "Director", "Head", "Manager"],
            "needKeywords": ["looking for", "need", "require", "want", "searching"],
            "timelineMonths": 6
        }
    },
    "spice": {
        "framework": "SPICE",
        "weights": {
            "situation": 20,
            "problem": 20,
            "implication": 20,
            "criticalEvent": 20,
            "decision": 20
        },
        "thresholds": {
            "hotMin": 71,
            "warmMin": 40
        },
        "config": {
            "situationKeywords": ["growing", "expanding", "scaling", "enterprise"],
            "problemKeywords": ["challenge", "issue", "problem", "struggling", "difficulty"],
            "implicationKeywords": ["cost", "revenue", "efficiency", "productivity"],
            "criticalEventKeywords": ["deadline", "quarter", "urgent", "immediately"],
            "decisionKeywords": ["decision", "committee", "stakeholder", "approval"]
        }
    }
}

# ============================================================================
# SCORING CALCULATORS
# ============================================================================
def calculate_mdcp_score(contact: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate MDCP score for a contact"""
    weights = config.get("weights", {})
    thresholds = config.get("thresholds", {})
    cfg = config.get("config", {})
    
    scores = {
        "money": 0,
        "decisionmaker": 0,
        "champion": 0,
        "process": 0
    }
    
    # Money score - based on company size indicators
    company = (contact.get("company") or "").lower()
    enrichment_data = contact.get("enrichment_data") or contact.get("enrichmentdata") or {}
    if isinstance(enrichment_data, str):
        import json
        try:
            enrichment_data = json.loads(enrichment_data)
        except:
            enrichment_data = {}
    
    # Check for company indicators
    enterprise_keywords = ["inc", "corp", "enterprise", "global", "international", "group"]
    if any(kw in company for kw in enterprise_keywords):
        scores["money"] = weights.get("money", 25)
    elif company:
        scores["money"] = weights.get("money", 25) * 0.6
    
    # Decision-maker score - based on title
    title = (contact.get("title") or contact.get("job_title") or "").lower()
    dm_titles = [t.lower() for t in cfg.get("decisionmakerTitles", [])]
    if any(t in title for t in dm_titles):
        scores["decisionmaker"] = weights.get("decisionmaker", 25)
    elif title:
        scores["decisionmaker"] = weights.get("decisionmaker", 25) * 0.4
    
    # Champion score - based on engagement/email quality
    email = contact.get("email") or ""
    if "@" in email and not any(x in email.lower() for x in ["gmail", "yahoo", "hotmail", "outlook"]):
        scores["champion"] = weights.get("champion", 25)  # Corporate email
    elif email:
        scores["champion"] = weights.get("champion", 25) * 0.5
    
    # Process score - based on completeness of data
    filled_fields = sum(1 for f in ["email", "phone", "company", "title", "linkedin_url"] if contact.get(f))
    scores["process"] = (filled_fields / 5) * weights.get("process", 25)
    
    total_score = round(sum(scores.values()))
    
    # Determine tier
    if total_score >= thresholds.get("hotMin", 71):
        tier = "hot"
    elif total_score >= thresholds.get("warmMin", 40):
        tier = "warm"
    else:
        tier = "cold"
    
    return {
        "score": total_score,
        "tier": tier,
        "breakdown": scores
    }

def calculate_bant_score(contact: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate BANT score for a contact"""
    weights = config.get("weights", {})
    thresholds = config.get("thresholds", {})
    cfg = config.get("config", {})
    
    scores = {
        "budget": 0,
        "authority": 0,
        "need": 0,
        "timeline": 0
    }
    
    # Budget score - infer from company/title
    company = (contact.get("company") or "").lower()
    title = (contact.get("title") or contact.get("job_title") or "").lower()
    
    if any(x in company for x in ["enterprise", "inc", "corp", "global"]):
        scores["budget"] = weights.get("budget", 25)
    elif company:
        scores["budget"] = weights.get("budget", 25) * 0.5
    
    # Authority score - based on title
    authority_titles = [t.lower() for t in cfg.get("authorityTitles", [])]
    if any(t in title for t in authority_titles):
        scores["authority"] = weights.get("authority", 25)
    elif title:
        scores["authority"] = weights.get("authority", 25) * 0.3
    
    # Need score - check enrichment data for keywords
    enrichment_data = contact.get("enrichment_data") or contact.get("enrichmentdata") or {}
    if isinstance(enrichment_data, str):
        import json
        try:
            enrichment_data = json.loads(enrichment_data)
        except:
            enrichment_data = {}
    
    enrichment_text = str(enrichment_data).lower()
    need_keywords = cfg.get("needKeywords", [])
    if any(kw in enrichment_text for kw in need_keywords):
        scores["need"] = weights.get("need", 25)
    elif enrichment_data:
        scores["need"] = weights.get("need", 25) * 0.5
    
    # Timeline score - based on recency/engagement
    if contact.get("enriched_at") or contact.get("enrichedat"):
        scores["timeline"] = weights.get("timeline", 25) * 0.8
    else:
        scores["timeline"] = weights.get("timeline", 25) * 0.3
    
    total_score = round(sum(scores.values()))
    
    if total_score >= thresholds.get("hotMin", 71):
        tier = "hot"
    elif total_score >= thresholds.get("warmMin", 40):
        tier = "warm"
    else:
        tier = "cold"
    
    return {
        "score": total_score,
        "tier": tier,
        "breakdown": scores
    }

def calculate_spice_score(contact: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate SPICE score for a contact"""
    weights = config.get("weights", {})
    thresholds = config.get("thresholds", {})
    cfg = config.get("config", {})
    
    scores = {
        "situation": 0,
        "problem": 0,
        "implication": 0,
        "criticalEvent": 0,
        "decision": 0
    }
    
    # Get enrichment data
    enrichment_data = contact.get("enrichment_data") or contact.get("enrichmentdata") or {}
    if isinstance(enrichment_data, str):
        import json
        try:
            enrichment_data = json.loads(enrichment_data)
        except:
            enrichment_data = {}
    
    enrichment_text = str(enrichment_data).lower()
    company = (contact.get("company") or "").lower()
    title = (contact.get("title") or contact.get("job_title") or "").lower()
    
    # Situation score
    situation_keywords = cfg.get("situationKeywords", [])
    if any(kw in enrichment_text or kw in company for kw in situation_keywords):
        scores["situation"] = weights.get("situation", 20)
    elif company:
        scores["situation"] = weights.get("situation", 20) * 0.5
    
    # Problem score
    problem_keywords = cfg.get("problemKeywords", [])
    if any(kw in enrichment_text for kw in problem_keywords):
        scores["problem"] = weights.get("problem", 20)
    elif enrichment_data:
        scores["problem"] = weights.get("problem", 20) * 0.4
    
    # Implication score
    implication_keywords = cfg.get("implicationKeywords", [])
    if any(kw in enrichment_text for kw in implication_keywords):
        scores["implication"] = weights.get("implication", 20)
    elif enrichment_data:
        scores["implication"] = weights.get("implication", 20) * 0.4
    
    # Critical Event score
    critical_keywords = cfg.get("criticalEventKeywords", [])
    if any(kw in enrichment_text for kw in critical_keywords):
        scores["criticalEvent"] = weights.get("criticalEvent", 20)
    else:
        scores["criticalEvent"] = weights.get("criticalEvent", 20) * 0.3
    
    # Decision score - based on title authority
    if any(x in title for x in ["ceo", "cfo", "cto", "vp", "director", "head"]):
        scores["decision"] = weights.get("decision", 20)
    elif title:
        scores["decision"] = weights.get("decision", 20) * 0.4
    
    total_score = round(sum(scores.values()))
    
    if total_score >= thresholds.get("hotMin", 71):
        tier = "hot"
    elif total_score >= thresholds.get("warmMin", 40):
        tier = "warm"
    else:
        tier = "cold"
    
    return {
        "score": total_score,
        "tier": tier,
        "breakdown": scores
    }

# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/health")
async def scoring_health():
    """Health check for scoring module"""
    return {
        "status": "healthy",
        "frameworks": ["MDCP", "BANT", "SPICE"],
        "configs_loaded": len(SCORING_CONFIGS),
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/config")
async def get_all_configs():
    """Get all scoring configurations"""
    return SCORING_CONFIGS

@router.get("/config/{framework}")
async def get_scoring_config(framework: str):
    """Get scoring configuration for a specific framework"""
    framework_lower = framework.lower()
    if framework_lower not in SCORING_CONFIGS:
        raise HTTPException(status_code=404, detail=f"Framework '{framework}' not found")
    return SCORING_CONFIGS[framework_lower]

@router.post("/config/{framework}")
async def save_scoring_config(framework: str, config: Dict[str, Any]):
    """Save scoring configuration for a framework"""
    framework_lower = framework.lower()
    if framework_lower not in SCORING_CONFIGS:
        raise HTTPException(status_code=404, detail=f"Framework '{framework}' not found")
    
    # Update in-memory config
    if "weights" in config:
        SCORING_CONFIGS[framework_lower]["weights"] = config["weights"]
    if "thresholds" in config:
        SCORING_CONFIGS[framework_lower]["thresholds"] = config["thresholds"]
    if "config" in config:
        SCORING_CONFIGS[framework_lower]["config"] = config["config"]
    
    return {
        "status": "saved",
        "framework": framework_lower,
        "config": SCORING_CONFIGS[framework_lower]
    }

@router.post("/score-all")
async def score_all_contacts(
    framework: str = Query(default="mdcp", description="Scoring framework to use"),
    user_id: Optional[str] = Query(default=None, description="User ID to filter contacts")
):
    """
    Score ALL contacts for a user using the specified framework.
    Updates contacts in database with scores.
    """
    framework_lower = framework.lower()
    
    if framework_lower not in SCORING_CONFIGS:
        raise HTTPException(status_code=400, detail=f"Invalid framework: {framework}")
    
    config = SCORING_CONFIGS[framework_lower]
    
    try:
        supabase = get_supabase()
        
        # Fetch all contacts (or filter by user_id if provided)
        query = supabase.table("contacts").select("*")
        if user_id:
            query = query.eq("user_id", user_id)
        
        result = query.execute()
        contacts = result.data or []
        
        if not contacts:
            return {
                "status": "completed",
                "framework": framework_lower,
                "scored": 0,
                "errors": [],
                "message": "No contacts found to score"
            }
        
        scored_count = 0
        errors = []
        
        for contact in contacts:
            try:
                contact_id = contact.get("id")
                
                # Calculate score based on framework
                if framework_lower == "mdcp":
                    score_result = calculate_mdcp_score(contact, config)
                elif framework_lower == "bant":
                    score_result = calculate_bant_score(contact, config)
                elif framework_lower == "spice":
                    score_result = calculate_spice_score(contact, config)
                else:
                    continue
                
                # Prepare update data
                update_data = {
                    f"{framework_lower}_score": score_result["score"],
                    f"{framework_lower}_tier": score_result["tier"],
                    "last_scored_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                # Update contact in database
                supabase.table("contacts").update(update_data).eq("id", contact_id).execute()
                scored_count += 1
                
                logger.info(f"Scored contact {contact_id}: {framework_lower}={score_result['score']} ({score_result['tier']})")
                
            except Exception as e:
                error_msg = f"Error scoring contact {contact.get('id')}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        return {
            "status": "completed",
            "framework": framework_lower,
            "scored": scored_count,
            "total": len(contacts),
            "errors": errors[:10],  # Limit errors in response
            "message": f"Successfully scored {scored_count} of {len(contacts)} contacts"
        }
        
    except Exception as e:
        logger.error(f"Score-all failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/calculate/{contact_id}")
async def calculate_single_score(
    contact_id: str,
    framework: str = Query(default="mdcp")
):
    """Calculate score for a single contact"""
    framework_lower = framework.lower()
    
    if framework_lower not in SCORING_CONFIGS:
        raise HTTPException(status_code=400, detail=f"Invalid framework: {framework}")
    
    config = SCORING_CONFIGS[framework_lower]
    
    try:
        supabase = get_supabase()
        
        # Fetch contact
        result = supabase.table("contacts").select("*").eq("id", contact_id).single().execute()
        contact = result.data
        
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        # Calculate score
        if framework_lower == "mdcp":
            score_result = calculate_mdcp_score(contact, config)
        elif framework_lower == "bant":
            score_result = calculate_bant_score(contact, config)
        elif framework_lower == "spice":
            score_result = calculate_spice_score(contact, config)
        
        # Update contact
        update_data = {
            f"{framework_lower}_score": score_result["score"],
            f"{framework_lower}_tier": score_result["tier"],
            "last_scored_at": datetime.utcnow().isoformat()
        }
        supabase.table("contacts").update(update_data).eq("id", contact_id).execute()
        
        return {
            "contact_id": contact_id,
            "framework": framework_lower,
            **score_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/calculate-all/{contact_id}")
async def calculate_all_frameworks(contact_id: str):
    """Calculate all framework scores for a single contact"""
    try:
        supabase = get_supabase()
        
        # Fetch contact
        result = supabase.table("contacts").select("*").eq("id", contact_id).single().execute()
        contact = result.data
        
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        results = {}
        update_data = {"last_scored_at": datetime.utcnow().isoformat()}
        
        for framework_lower, config in SCORING_CONFIGS.items():
            if framework_lower == "mdcp":
                score_result = calculate_mdcp_score(contact, config)
            elif framework_lower == "bant":
                score_result = calculate_bant_score(contact, config)
            elif framework_lower == "spice":
                score_result = calculate_spice_score(contact, config)
            else:
                continue
            
            results[framework_lower] = score_result
            update_data[f"{framework_lower}_score"] = score_result["score"]
            update_data[f"{framework_lower}_tier"] = score_result["tier"]
        
        # Update contact with all scores
        supabase.table("contacts").update(update_data).eq("id", contact_id).execute()
        
        return {
            "contact_id": contact_id,
            "scores": results,
            "updated_at": update_data["last_scored_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
