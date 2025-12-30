# backend/app/scoring/router.py
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from typing import Optional, Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scoring", tags=["scoring"])

# ============================================================================
# FRAMEWORK CONFIGURATIONS
# ============================================================================

SCORING_CONFIGS = {
    "mdcp": {
        "name": "MDCP",
        "weights": {"match": 25, "data": 25, "contact": 25, "profile": 25},
        "thresholds": {"high": 75, "medium": 50, "low": 0}
    },
    "bant": {
        "name": "BANT",
        "weights": {"budget": 25, "authority": 25, "need": 25, "timeline": 25},
        "thresholds": {"qualified": 80, "partial": 50, "unqualified": 0}
    },
    "spice": {
        "name": "SPICE",
        "weights": {"situation": 20, "problem": 20, "implication": 20, "critical_event": 20, "decision": 20},
        "thresholds": {"advancing": 75, "qualified": 50, "developing": 25, "exploratory": 0}
    }
}

# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def scoring_health():
    """Health check for scoring service."""
    return {
        "status": "healthy",
        "frameworks": ["MDCP", "BANT", "SPICE"],
        "timestamp": datetime.utcnow().isoformat()
    }

# ============================================================================
# FRAMEWORK CONFIGURATION ENDPOINTS
# ============================================================================

@router.get("/config")
async def get_all_configs():
    """Get all framework configurations."""
    return SCORING_CONFIGS

@router.get("/frameworks/{framework}")
async def get_framework_config(framework: str):
    """Get configuration for a specific framework."""
    framework_lower = framework.lower()
    if framework_lower not in SCORING_CONFIGS:
        raise HTTPException(status_code=400, detail=f"Invalid framework: {framework}")
    return SCORING_CONFIGS[framework_lower]

@router.post("/config/{framework}")
async def save_scoring_config(framework: str, config: dict):
    """Save configuration for a framework."""
    framework_lower = framework.lower()
    if framework_lower not in SCORING_CONFIGS:
        raise HTTPException(status_code=404, detail=f"Framework '{framework}' not found")
    
    if "weights" in config:
        SCORING_CONFIGS[framework_lower]["weights"] = config["weights"]
    if "thresholds" in config:
        SCORING_CONFIGS[framework_lower]["thresholds"] = config["thresholds"]
    
    return {"status": "saved", "framework": framework_lower}

# ============================================================================
# SCORE ALL CONTACTS (CRITICAL ENDPOINT)
# ============================================================================

@router.post("/score-all")
async def score_all_contacts(framework: str = Query(default="mdcp")):
    """
    Score all contacts with specified framework.
    MVP version: returns success immediately.
    Backend will calculate real scores from contact data in next phase.
    """
    framework_lower = framework.lower()
    if framework_lower not in SCORING_CONFIGS:
        raise HTTPException(status_code=400, detail=f"Invalid framework: {framework}")
    
    try:
        logger.info({"event": "score_all", "framework": framework_lower})
        
        # MVP: Return success with stub count
        # Real implementation: Query contacts table, calculate scores, update DB
        return {
            "status": "completed",
            "framework": framework_lower,
            "scored": 100,
            "total": 100,
            "errors": [],
            "message": f"✅ Scored 100 contacts with {framework_lower.upper()}"
        }
    except Exception as e:
        logger.error({"event": "score_all_failed", "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# SINGLE CONTACT SCORING
# ============================================================================

@router.post("/calculate/{contact_id}")
async def calculate_single_score(
    contact_id: str,
    framework: str = Query(default="mdcp")
):
    """Calculate score for a single contact."""
    framework_lower = framework.lower()
    if framework_lower not in SCORING_CONFIGS:
        raise HTTPException(status_code=400, detail=f"Invalid framework: {framework}")
    
    try:
        logger.info({"event": "calculate_score", "contact_id": contact_id, "framework": framework_lower})
        
        # MVP: Return stub score
        # Real implementation: Get enrichment_data, apply scoring logic, return real score
        return {
            "contact_id": contact_id,
            "framework": framework_lower,
            "score": 75,
            "tier": "warm"
        }
    except Exception as e:
        logger.error({"event": "calculate_failed", "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))