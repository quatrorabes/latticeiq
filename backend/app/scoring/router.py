# ============================================================================
# FILE: backend/app/scoring/router.py
# PURPOSE: Scoring Framework APIs - MDCP, BANT, SPICE, Unified
# ============================================================================

import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

logger = logging.getLogger("latticeiq")

# ============================================================================
# AUTH DEPENDENCY
# ============================================================================

async def get_current_user(authorization: str = Header(None)) -> dict:
    """Validate Supabase JWT"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")

        # JWT validation would happen here
        # For now, accept any bearer token
        user_id = "user-id-from-token"
        
        return {"id": user_id, "email": "user@example.com"}

    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ============================================================================
# MODELS
# ============================================================================

class ScoreRequest(BaseModel):
    contact_data: Dict[str, Any]
    enrichment_data: Optional[Dict[str, Any]] = None

class ScoringConfig(BaseModel):
    framework: str
    weights: Dict[str, float]
    thresholds: Dict[str, float]

# ============================================================================
# CONFIG DATA (FROM FRONTEND)
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
            "decisionmakerTitles": ["CEO", "VP Sales", "CMO"],
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
            "authorityTitles": ["VP", "Director", "Manager"],
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
# SCORING ENDPOINTS (PLACEHOLDER)
# ============================================================================

# POST /api/v3/scoring/mdcp - Calculate MDCP score
@router.post("/mdcp")
async def calculate_mdcp(request: ScoreRequest, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Calculate Match-Data-Contact-Profile (MDCP) score"""
    try:
        # Placeholder implementation
        return {
            "framework": "MDCP",
            "score": 75,
            "breakdown": {
                "money": 80,
                "decision": 70,
                "contact": 75,
                "profile": 65,
            },
        }
    except Exception as e:
        logger.error(f"Error calculating MDCP score: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# POST /api/v3/scoring/bant - Calculate BANT score
@router.post("/bant")
async def calculate_bant(request: ScoreRequest, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Calculate Budget-Authority-Need-Timeline (BANT) score"""
    try:
        # Placeholder implementation
        return {
            "framework": "BANT",
            "score": 70,
            "breakdown": {
                "budget": 70,
                "authority": 75,
                "need": 65,
                "timeline": 70,
            },
        }
    except Exception as e:
        logger.error(f"Error calculating BANT score: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# POST /api/v3/scoring/spice - Calculate SPICE score
@router.post("/spice")
async def calculate_spice(request: ScoreRequest, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Calculate Situation-Problem-Implication-Critical Event-Decision (SPICE) score"""
    try:
        # Placeholder implementation
        return {
            "framework": "SPICE",
            "score": 72,
            "breakdown": {
                "situation": 70,
                "problem": 75,
                "implication": 70,
                "critical_event": 68,
                "decision": 72,
            },
        }
    except Exception as e:
        logger.error(f"Error calculating SPICE score: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# POST /api/v3/scoring/unified - Calculate unified score
@router.post("/unified")
async def calculate_unified(request: ScoreRequest, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Calculate unified score blending all frameworks"""
    try:
        # Placeholder implementation
        return {
            "framework": "Unified",
            "score": 72,
            "breakdown": {
                "mdcp": 75,
                "bant": 70,
                "spice": 72,
            },
        }
    except Exception as e:
        logger.error(f"Error calculating unified score: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
        