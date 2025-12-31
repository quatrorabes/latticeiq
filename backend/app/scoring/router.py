from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import Optional, Dict, Any
from .models import (
    MDCPConfig, BANTConfig, SPICEConfig,
    ScoreResponse, BatchScoringResponse
)
from .calculators import (
    calculate_mdcp_score,
    calculate_bant_score,
    calculate_spice_score
)
from ..auth import get_current_user
from ..db import supabase

router = APIRouter(prefix="/scoring", tags=["scoring"])

# ==========================================
# HELPER: Determine tier from score
# ==========================================
def get_tier(score: float) -> str:
    """Convert numeric score to tier"""
    if score >= 71:
        return "hot"
    elif score >= 40:
        return "warm"
    else:
        return "cold"

# ==========================================
# GET SCORING CONFIGS
# ==========================================

@router.get("/config/{framework}")
async def get_scoring_config(
    framework: str,
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get scoring configuration for a specific framework
    (MDCP, BANT, SPICE)
    """
    framework_lower = framework.lower()
    
    if framework_lower not in ["mdcp", "bant", "spice"]:
        raise HTTPException(status_code=400, detail="Invalid framework")
    
    # Return default config
    # TODO: Load from database scoring_configs table when created
    configs = {
        "mdcp": {
            "framework": "mdcp",
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
                "decisionmakerTitles": ["CEO", "VP", "Director", "President", "Owner", "CTO", "CFO"],
                "championEngagementDays": 30
            }
        },
        "bant": {
            "framework": "bant",
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
            "config": {}
        },
        "spice": {
            "framework": "spice",
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
            "config": {}
        }
    }
    
    return configs.get(framework_lower, configs["mdcp"])

# ==========================================
# CALCULATE SCORES FOR SINGLE CONTACT
# ==========================================

@router.post("/calculate-all/{contact_id}")
async def calculate_all_scores(
    contact_id: str,
    user: dict = Depends(get_current_user)
) -> ScoreResponse:
    """
    Calculate all three scoring frameworks (MDCP, BANT, SPICE) for a contact
    and persist results to database.
    
    Returns ScoreResponse with all scores and tiers.
    """
    workspace_id = user.get("workspace_id")
    
    try:
        # ============================================
        # 1. FETCH CONTACT FROM DATABASE
        # ============================================
        response = supabase.table("contacts").select("*").eq("id", contact_id).eq("workspace_id", workspace_id).single().execute()
        contact = response.data
        
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        # ============================================
        # 2. GET CONFIGS
        # ============================================
        mdcp_config_response = await get_scoring_config("mdcp", user)
        bant_config_response = await get_scoring_config("bant", user)
        spice_config_response = await get_scoring_config("spice", user)
        
        # ============================================
        # 3. CALCULATE SCORES
        # ============================================
        mdcp_result = calculate_mdcp_score(contact, mdcp_config_response)
        bant_result = calculate_bant_score(contact, bant_config_response)
        spice_result = calculate_spice_score(contact, spice_config_response)
        
        mdcp_score = mdcp_result.get("score", 0)
        bant_score = bant_result.get("score", 0)
        spice_score = spice_result.get("score", 0)
        
        # ============================================
        # 4. DETERMINE TIERS
        # ============================================
        mdcp_tier = get_tier(mdcp_score)
        bant_tier = get_tier(bant_score)
        spice_tier = get_tier(spice_score)
        
        # ============================================
        # 5. PERSIST TO DATABASE
        # ============================================
        now = datetime.utcnow()
        update_payload = {
            "mdcp_score": round(float(mdcp_score), 2),
            "mdcp_tier": mdcp_tier,
            "bant_score": round(float(bant_score), 2),
            "bant_tier": bant_tier,
            "spice_score": round(float(spice_score), 2),
            "spice_tier": spice_tier,
            "last_scored_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        update_response = supabase.table("contacts").update(update_payload).eq("id", contact_id).eq("workspace_id", workspace_id).execute()
        
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Failed to persist scores")
        
        # ============================================
        # 6. RETURN RESPONSE
        # ============================================
        return ScoreResponse(
            contact_id=contact_id,
            mdcp_score=round(float(mdcp_score), 2),
            mdcp_tier=mdcp_tier,
            bant_score=round(float(bant_score), 2),
            bant_tier=bant_tier,
            spice_score=round(float(spice_score), 2),
            spice_tier=spice_tier,
            last_scored_at=now
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error calculating scores: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error calculating scores: {str(e)}")

# ==========================================
# BATCH SCORE ALL CONTACTS
# ==========================================

@router.post("/score-all")
async def score_all_contacts(
    user: dict = Depends(get_current_user)
) -> BatchScoringResponse:
    """
    Score ALL contacts in workspace.
    Returns count of scored contacts.
    """
    workspace_id = user.get("workspace_id")
    
    try:
        # ============================================
        # 1. GET ALL CONTACTS
        # ============================================
        contacts_response = supabase.table("contacts").select("*").eq("workspace_id", workspace_id).execute()
        contacts = contacts_response.data
        
        if not contacts:
            return BatchScoringResponse(
                success=True,
                scored_count=0,
                total_contacts=0,
                message="No contacts to score"
            )
        
        # ============================================
        # 2. GET CONFIGS (ONCE)
        # ============================================
        mdcp_config = await get_scoring_config("mdcp", user)
        bant_config = await get_scoring_config("bant", user)
        spice_config = await get_scoring_config("spice", user)
        
        # ============================================
        # 3. SCORE EACH CONTACT
        # ============================================
        scored_count = 0
        errors = []
        now = datetime.utcnow()
        
        for contact in contacts:
            try:
                # Calculate
                mdcp_result = calculate_mdcp_score(contact, mdcp_config)
                bant_result = calculate_bant_score(contact, bant_config)
                spice_result = calculate_spice_score(contact, spice_config)
                
                mdcp_score = mdcp_result.get("score", 0)
                bant_score = bant_result.get("score", 0)
                spice_score = spice_result.get("score", 0)
                
                # Determine tiers
                mdcp_tier = get_tier(mdcp_score)
                bant_tier = get_tier(bant_score)
                spice_tier = get_tier(spice_score)
                
                # Persist
                update_payload = {
                    "mdcp_score": round(float(mdcp_score), 2),
                    "mdcp_tier": mdcp_tier,
                    "bant_score": round(float(bant_score), 2),
                    "bant_tier": bant_tier,
                    "spice_score": round(float(spice_score), 2),
                    "spice_tier": spice_tier,
                    "last_scored_at": now.isoformat(),
                    "updated_at": now.isoformat()
                }
                
                supabase.table("contacts").update(update_payload).eq("id", contact["id"]).eq("workspace_id", workspace_id).execute()
                scored_count += 1
            
            except Exception as e:
                errors.append({
                    "contact_id": contact.get("id"),
                    "error": str(e)
                })
                print(f"Error scoring contact {contact.get('id')}: {str(e)}")
        
        # ============================================
        # 4. RETURN BATCH RESPONSE
        # ============================================
        return BatchScoringResponse(
            success=True,
            scored_count=scored_count,
            total_contacts=len(contacts),
            errors=errors if errors else None,
            message=f"Successfully scored {scored_count}/{len(contacts)} contacts"
        )
    
    except Exception as e:
        print(f"Error in batch scoring: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error scoring all contacts: {str(e)}")
