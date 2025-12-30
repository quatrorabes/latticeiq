# backend/app/scoring/router.py
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Dict, Any, Optional
import os
from datetime import datetime

# ✅ ADD THIS IMPORT (was missing)
import jwt

router = APIRouter(prefix="/scoring", tags=["Scoring"])

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        from supabase import create_client
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print(f"✅ Supabase initialized for scoring")
    except Exception as e:
        print(f"⚠️ Supabase init failed: {e}")


def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Extract user from JWT"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth")
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        return {"id": payload.get("sub"), "email": payload.get("email")}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


@router.get("/health")
async def scoring_health():
    return {"status": "ok", "module": "scoring"}


def calculate_mdcp_score(contact: Dict[str, Any]) -> tuple:
    """Calculate MDCP score"""
    score = 0
    
    if contact.get("company"):
        score += 25
    
    title = (contact.get("title") or "").lower()
    if any(word in title for word in ["ceo", "vp", "president", "director", "owner", "chief"]):
        score += 25
    elif title:
        score += 10
    
    if contact.get("enriched_at"):
        score += 25
    elif contact.get("enrichment_status") == "completed":
        score += 20
    else:
        score += 5
    
    if contact.get("enrichment_status") == "completed":
        score += 25
    else:
        score += 5
    
    tier = "hot" if score >= 71 else ("warm" if score >= 40 else "cold")
    return score, tier


def calculate_bant_score(contact: Dict[str, Any]) -> tuple:
    """Calculate BANT score"""
    score = 0
    score += 15 if contact.get("company") else 5
    
    title = (contact.get("title") or "").lower()
    score += 25 if any(word in title for word in ["ceo", "vp", "president", "director", "chief"]) else 10
    
    score += 15 if contact.get("enrichment_status") == "completed" else 5
    score += 15 if contact.get("enriched_at") else 5
    
    tier = "hot" if score >= 71 else ("warm" if score >= 40 else "cold")
    return score, tier


def calculate_spice_score(contact: Dict[str, Any]) -> tuple:
    """Calculate SPICE score"""
    score = 0
    score += 15 if contact.get("company") else 5
    score += 15 if contact.get("enrichment_status") == "completed" else 5
    score += 10
    score += 10
    score += 15 if contact.get("title") else 5
    
    tier = "hot" if score >= 71 else ("warm" if score >= 40 else "cold")
    return score, tier


@router.post("/score-all")
async def score_all_contacts(
    framework: str = "mdcp",
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Score all contacts"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    framework = framework.lower()
    if framework not in ["mdcp", "bant", "spice"]:
        raise HTTPException(status_code=400, detail="Invalid framework")
    
    try:
        response = supabase.table("contacts").select("*").eq("user_id", user["id"]).execute()
        
        if not response.data:
            return {"scored": 0, "total": 0, "message": "No contacts found"}
        
        contacts = response.data
        scored = 0
        
        for contact in contacts:
            try:
                if framework == "mdcp":
                    score, tier = calculate_mdcp_score(contact)
                    supabase.table("contacts").update({
                        "mdcp_score": score,
                        "mdcp_tier": tier
                    }).eq("id", contact["id"]).execute()
                
                elif framework == "bant":
                    score, tier = calculate_bant_score(contact)
                    supabase.table("contacts").update({
                        "bant_score": score,
                        "bant_tier": tier
                    }).eq("id", contact["id"]).execute()
                
                else:
                    score, tier = calculate_spice_score(contact)
                    supabase.table("contacts").update({
                        "spice_score": score,
                        "spice_tier": tier
                    }).eq("id", contact["id"]).execute()
                
                scored += 1
            except Exception as e:
                print(f"Error scoring contact {contact.get('id')}: {e}")
        
        return {
            "framework": framework,
            "scored": scored,
            "total": len(contacts),
            "message": f"✅ Scored {scored}/{len(contacts)} contacts"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {str(e)}")
