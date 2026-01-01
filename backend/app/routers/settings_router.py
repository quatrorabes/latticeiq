# ============================================================================
# FILE: backend/app/routers/settings_router.py
# PURPOSE: User settings API - Scoring weights, preferences
# ENDPOINT: /api/v3/settings
# ============================================================================

import os
import json
import logging
from typing import Any, Dict, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from supabase import create_client
import jwt

logger = logging.getLogger("latticeiq")

# Supabase
supabase = None

def get_supabase():
    global supabase
    if supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        if url and key:
            supabase = create_client(url, key)
    return supabase

# Auth
async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        parts = authorization.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization format")
        token = parts[1]
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        email = payload.get("email", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": str(user_id), "email": str(email)}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

# Models
class ScoringWeights(BaseModel):
    mdcp: Dict[str, int] = {
        "market_fit": 25,
        "decision_maker": 30,
        "company_profile": 25,
        "pain_indicators": 20,
    }
    bant: Dict[str, int] = {
        "budget": 25,
        "authority": 30,
        "need": 25,
        "timeline": 20,
    }
    spice: Dict[str, int] = {
        "situation": 20,
        "pain": 25,
        "impact": 20,
        "critical_event": 20,
        "evaluation": 15,
    }
    persona_scores: Dict[str, float] = {
        "decision-maker": 1.0,
        "champion": 0.85,
        "influencer": 0.7,
        "initiator": 0.6,
        "unknown": 0.5,
    }
    vertical_scores: Dict[str, float] = {
        "finance": 1.0,
        "insurance": 0.95,
        "equipment leasing": 0.9,
        "saas": 0.85,
        "healthcare": 0.8,
        "other": 0.6,
        "unknown": 0.5,
    }

class UserSettings(BaseModel):
    scoring_weights: Optional[ScoringWeights] = None
    theme: Optional[str] = "dark"
    notifications_enabled: Optional[bool] = True

# Router
router = APIRouter(prefix="/settings", tags=["Settings"])

# Default weights
DEFAULT_WEIGHTS = ScoringWeights()

@router.get("/scoring-weights")
async def get_scoring_weights(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Get user's scoring weights or defaults."""
    client = get_supabase()
    
    if client:
        try:
            # Try to get user's custom weights
            result = client.table("user_settings").select("scoring_weights").eq("user_id", user["id"]).execute()
            if result.data and result.data[0].get("scoring_weights"):
                return result.data[0]["scoring_weights"]
        except Exception as e:
            logger.warning(f"Could not load user settings: {e}")
    
    # Return defaults
    return DEFAULT_WEIGHTS.dict()

@router.put("/scoring-weights")
async def update_scoring_weights(
    weights: ScoringWeights,
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Update user's scoring weights."""
    client = get_supabase()
    
    if not client:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    try:
        user_id = user["id"]
        now = datetime.now(timezone.utc).isoformat()
        
        # Check if settings exist
        existing = client.table("user_settings").select("id").eq("user_id", user_id).execute()
        
        if existing.data:
            # Update
            result = client.table("user_settings").update({
                "scoring_weights": weights.dict(),
                "updated_at": now,
            }).eq("user_id", user_id).execute()
        else:
            # Insert
            result = client.table("user_settings").insert({
                "user_id": user_id,
                "scoring_weights": weights.dict(),
                "created_at": now,
                "updated_at": now,
            }).execute()
        
        logger.info(f"✅ Scoring weights updated for user {user_id}")
        return {"status": "saved", "weights": weights.dict()}
        
    except Exception as e:
        logger.error(f"❌ Failed to save scoring weights: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scoring-weights/reset")
async def reset_scoring_weights(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Reset scoring weights to defaults."""
    client = get_supabase()
    
    if client:
        try:
            client.table("user_settings").update({
                "scoring_weights": DEFAULT_WEIGHTS.dict(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("user_id", user["id"]).execute()
        except Exception:
            pass
    
    return {"status": "reset", "weights": DEFAULT_WEIGHTS.dict()}
