# backend/app/scoring/router.py
"""
LatticeIQ Scoring Router
API endpoints for MDCP, BANT, SPICE lead scoring with real database integration
"""

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import Optional, Dict, Any, List
from supabase import Client

from .models import ScoreResponse, BatchScoringResponse, BatchScoreRequest
from .calculators import (
    calculate_mdcp_score,
    calculate_bant_score,
    calculate_spice_score
)


router = APIRouter(prefix="/scoring", tags=["scoring"])

# Global supabase client (imported from main)
supabase: Optional[Client] = None


def set_supabase_client(client: Client):
    """Set the supabase client (called from main.py)"""
    global supabase
    supabase = client


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
async def get_scoring_config(framework: str) -> Dict[str, Any]:
    """Get scoring configuration for a specific framework (MDCP, BANT, SPICE)"""
    framework_lower = framework.lower()
    
    if framework_lower not in ["mdcp", "bant", "spice"]:
        raise HTTPException(status_code=400, detail="Invalid framework")

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
async def calculate_all_scores(contact_id: str) -> ScoreResponse:
    """Calculate all three scoring frameworks (MDCP, BANT, SPICE) for a contact"""
    
    try:
        # 1. FETCH CONTACT FROM SUPABASE DATABASE
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not initialized")
        
        response = supabase.table("contacts").select("*").eq("id", contact_id).single().execute()
        contact = response.data
        
        if not contact:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

        # 2. GET CONFIGS
        mdcp_config = await get_scoring_config("mdcp")
        bant_config = await get_scoring_config("bant")
        spice_config = await get_scoring_config("spice")

        # 3. CALCULATE SCORES
        mdcp_result = calculate_mdcp_score(contact, mdcp_config)
        bant_result = calculate_bant_score(contact, bant_config)
        spice_result = calculate_spice_score(contact, spice_config)

        mdcp_score = mdcp_result.get("score", 0)
        bant_score = bant_result.get("score", 0)
        spice_score = spice_result.get("score", 0)

        # 4. CALCULATE OVERALL SCORE (average of three frameworks)
        overall_score = round((mdcp_score + bant_score + spice_score) / 3, 2)

        # 5. DETERMINE TIERS
        mdcp_tier = get_tier(mdcp_score)
        bant_tier = get_tier(bant_score)
        spice_tier = get_tier(spice_score)

        # 6. PERSIST TO DATABASE
        now = datetime.utcnow()
        update_payload = {
            "mdcp_score": float(mdcp_score),
            "mdcp_tier": mdcp_tier,
            "bant_score": float(bant_score),
            "bant_tier": bant_tier,
            "spice_score": float(spice_score),
            "spice_tier": spice_tier,
            "overall_score": overall_score,
            "last_scored_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        update_response = supabase.table("contacts").update(update_payload).eq("id", contact_id).execute()
        
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Failed to persist scores to database")

        # 7. RETURN RESPONSE
        response = ScoreResponse(
            contact_id=contact_id,
            mdcp_score=round(float(mdcp_score), 2),
            mdcp_tier=mdcp_tier,
            bant_score=round(float(bant_score), 2),
            bant_tier=bant_tier,
            spice_score=round(float(spice_score), 2),
            spice_tier=spice_tier,
            overall_score=overall_score,
            last_scored_at=now
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error calculating scores: {str(e)}")

# backend/app/scoring/router.py - REPLACE THE BATCH SCORING SECTION


# ==========================================
# BATCH SCORE SELECTED CONTACTS (NEW)
# ==========================================

@router.post("/batch-score")
async def batch_score_contacts(request: BatchScoreRequest) -> BatchScoringResponse:
    """
    Score selected contacts efficiently.
    
    Supports:
    - Max 1000 contacts per request
    - Batch database updates (faster than sequential)
    - Error tracking per contact
    
    Request body:
    {
        "contact_ids": ["uuid1", "uuid2", ...],
        "frameworks": ["mdcp", "bant", "spice"]  # optional
    }
    """
    
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not initialized")
        
        contact_ids = request.contact_ids
        frameworks = request.frameworks or ["mdcp", "bant", "spice"]
        
        # Validate input
        if not contact_ids:
            raise HTTPException(status_code=400, detail="No contact IDs provided")
        
        if len(contact_ids) > 1000:
            raise HTTPException(status_code=400, detail="Max 1000 contacts per batch")
        
        # 1. FETCH ALL CONTACTS IN ONE QUERY (not one-by-one)
        contacts_response = supabase.table("contacts").select("*").in_("id", contact_ids).execute()
        contacts = contacts_response.data
        
        if not contacts:
            raise HTTPException(status_code=404, detail="No contacts found with provided IDs")
        
        # 2. GET CONFIGS ONCE
        mdcp_config = await get_scoring_config("mdcp") if "mdcp" in frameworks else None
        bant_config = await get_scoring_config("bant") if "bant" in frameworks else None
        spice_config = await get_scoring_config("spice") if "spice" in frameworks else None
        
        # 3. SCORE ALL CONTACTS
        updates = []  # Batch updates
        errors = []
        now = datetime.utcnow()
        
        for contact in contacts:
            try:
                scores = {}
                
                # Calculate only requested frameworks
                if "mdcp" in frameworks:
                    mdcp_result = calculate_mdcp_score(contact, mdcp_config)
                    scores["mdcp_score"] = round(float(mdcp_result.get("score", 0)), 2)
                    scores["mdcp_tier"] = get_tier(scores["mdcp_score"])
                
                if "bant" in frameworks:
                    bant_result = calculate_bant_score(contact, bant_config)
                    scores["bant_score"] = round(float(bant_result.get("score", 0)), 2)
                    scores["bant_tier"] = get_tier(scores["bant_score"])
                
                if "spice" in frameworks:
                    spice_result = calculate_spice_score(contact, spice_config)
                    scores["spice_score"] = round(float(spice_result.get("score", 0)), 2)
                    scores["spice_tier"] = get_tier(scores["spice_score"])
                
                # Calculate overall (average of requested frameworks)
                score_values = [v for k, v in scores.items() if "_score" in k]
                overall_score = round(sum(score_values) / len(score_values), 2) if score_values else 0
                
                # Prepare batch update
                update_obj = {
                    "id": contact["id"],
                    "overall_score": overall_score,
                    "last_scored_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                    **scores  # Unpack mdcp_score, bant_score, spice_score, etc.
                }
                updates.append(update_obj)
                
            except Exception as e:
                errors.append({
                    "contact_id": contact.get("id"),
                    "error": str(e)
                })
        
        # 4. BATCH UPDATE DATABASE (much faster than sequential)
        if updates:
            supabase.table("contacts").upsert(updates).execute()
        
        # 5. RETURN RESPONSE
        return BatchScoringResponse(
            success=len(errors) == 0,
            scored_count=len(updates),
            total_contacts=len(contacts),
            errors=errors if errors else None,
            message=f"Successfully scored {len(updates)}/{len(contacts)} contacts"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error batch scoring: {str(e)}")


# ==========================================
# SCORE ALL CONTACTS (EXISTING - KEEP AS IS)
# ==========================================

@router.post("/score-all")
async def score_all_contacts() -> BatchScoringResponse:
    """Score ALL contacts in workspace - delegates to batch_score with all contact IDs"""
    
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not initialized")
        
        # Get all contact IDs
        contacts_response = supabase.table("contacts").select("id").execute()
        all_contact_ids = [c["id"] for c in contacts_response.data]
        
        if not all_contact_ids:
            return BatchScoringResponse(
                success=True,
                scored_count=0,
                total_contacts=0,
                message="No contacts to score"
            )
        
        # Delegate to batch_score_contacts (reuse logic)
        # Break into chunks of 1000 if needed
        results = []
        for i in range(0, len(all_contact_ids), 1000):
            chunk = all_contact_ids[i:i+1000]
            request = BatchScoreRequest(contact_ids=chunk)
            result = await batch_score_contacts(request)
            results.append(result)
        
        # Aggregate results
        total_scored = sum(r.scored_count for r in results)
        total_errors = sum(len(r.errors) if r.errors else 0 for r in results)
        
        return BatchScoringResponse(
            success=total_errors == 0,
            scored_count=total_scored,
            total_contacts=len(all_contact_ids),
            message=f"Batch scoring complete: {total_scored}/{len(all_contact_ids)} contacts scored"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scoring all contacts: {str(e)}")
