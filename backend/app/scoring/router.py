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
        "name": "Money-Decision-Contact-Profile",
        "description": "Best for sales qualification",
        "weights": {
            "money": 0.25,
            "decision": 0.25,
            "contact": 0.25,
            "profile": 0.25,
        },
        "thresholds": {
            "hot": 80,
            "warm": 60,
            "cold": 0,
        },
        "factors": {
            "money": "Does company revenue match your target range?",
            "decision": "Is this person an identified decision-maker?",
            "contact": "Have they recently engaged with you (last N days)?",
            "profile": "Does their profile match your ideal customer profile?",
        },
    },
    "bant": {
        "framework": "BANT",
        "name": "Budget-Authority-Need-Timeline",
        "description": "Classic B2B qualification framework",
        "weights": {
            "budget": 0.25,
            "authority": 0.25,
            "need": 0.25,
            "timeline": 0.25,
        },
        "thresholds": {
            "hot": 80,
            "warm": 60,
            "cold": 0,
        },
        "factors": {
            "budget": "Do they have budget allocated?",
            "authority": "Are they a decision-maker or influencer?",
            "need": "Do they have a clear need for your solution?",
            "timeline": "What's their implementation timeline?",
        },
    },
    "spice": {
        "framework": "SPICE",
        "name": "Situation-Problem-Implication-Critical Event-Decision",
        "description": "Advanced consultative selling framework",
        "weights": {
            "situation": 0.2,
            "problem": 0.2,
            "implication": 0.2,
            "critical_event": 0.2,
            "decision": 0.2,
        },
        "thresholds": {
            "hot": 80,
            "warm": 60,
            "cold": 0,
        },
        "factors": {
            "situation": "Understanding of current situation",
            "problem": "Problem identification and assessment",
            "implication": "Impact and consequence analysis",
            "critical_event": "Urgency and critical business drivers",
            "decision": "Decision criteria and process clarity",
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
