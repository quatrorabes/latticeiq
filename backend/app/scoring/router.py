# backend/app/scoring/router.py
"""
LatticeIQ Scoring Router
API endpoints for MDCP, BANT, SPICE lead scoring
"""

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import Optional, Dict, Any

from .models import ScoreResponse, BatchScoringResponse
from .calculators import (
    calculate_mdcp_score,
    calculate_bant_score,
    calculate_spice_score
)

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
        # Build mock contact object for testing
        # In production, fetch from database:
        # response = supabase.table("contacts").select("*").eq("id", contact_id).single().execute()
        # contact = response.data
        
        contact = {
            "id": contact_id,
            "job_title": "VP Sales",
            "company": "Acme Corp",
            "enrichment_status": "completed",
            "enriched_at": datetime.utcnow().isoformat(),
            "enrichment_data": {
                "bant": {
                    "budget_confirmed": True,
                    "need_identified": True
                },
                "spice": {
                    "problem_identified": True,
                    "decision_process_confirmed": True
                }
            }
        }

        # 1. GET CONFIGS
        mdcp_config = await get_scoring_config("mdcp")
        bant_config = await get_scoring_config("bant")
        spice_config = await get_scoring_config("spice")

        # 2. CALCULATE SCORES
        mdcp_result = calculate_mdcp_score(contact, mdcp_config)
        bant_result = calculate_bant_score(contact, bant_config)
        spice_result = calculate_spice_score(contact, spice_config)

        mdcp_score = mdcp_result.get("score", 0)
        bant_score = bant_result.get("score", 0)
        spice_score = spice_result.get("score", 0)

        # 3. CALCULATE OVERALL SCORE (average of three frameworks)
        overall_score = round((mdcp_score + bant_score + spice_score) / 3, 2)

        # 4. DETERMINE TIERS
        mdcp_tier = get_tier(mdcp_score)
        bant_tier = get_tier(bant_score)
        spice_tier = get_tier(spice_score)

        # 5. PREPARE RESPONSE
        now = datetime.utcnow()

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

        # 6. PERSIST TO DATABASE (when integrated)
        # update_payload = {
        #     "mdcp_score": float(mdcp_score),
        #     "mdcp_tier": mdcp_tier,
        #     "bant_score": float(bant_score),
        #     "bant_tier": bant_tier,
        #     "spice_score": float(spice_score),
        #     "spice_tier": spice_tier,
        #     "overall_score": overall_score,
        #     "last_scored_at": now.isoformat(),
        #     "updated_at": now.isoformat()
        # }
        # supabase.table("contacts").update(update_payload).eq("id", contact_id).execute()

        return response

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error calculating scores: {str(e)}")


# ==========================================
# BATCH SCORE ALL CONTACTS
# ==========================================

@router.post("/score-all")
async def score_all_contacts() -> BatchScoringResponse:
    """Score ALL contacts in workspace"""
    
    try:
        # 1. GET ALL CONTACTS (mock data for testing)
        # In production: contacts_response = supabase.table("contacts").select("*").execute()
        contacts = [
            {
                "id": "contact-1",
                "job_title": "CEO",
                "company": "Company A",
                "enrichment_status": "completed",
                "enriched_at": datetime.utcnow().isoformat()
            },
            {
                "id": "contact-2",
                "job_title": "Director",
                "company": "Company B",
                "enrichment_status": "completed",
                "enriched_at": datetime.utcnow().isoformat()
            }
        ]

        if not contacts:
            return BatchScoringResponse(
                success=True,
                scored_count=0,
                total_contacts=0,
                message="No contacts to score"
            )

        # 2. GET CONFIGS (ONCE)
        mdcp_config = await get_scoring_config("mdcp")
        bant_config = await get_scoring_config("bant")
        spice_config = await get_scoring_config("spice")

        # 3. SCORE EACH CONTACT
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
                overall_score = round((mdcp_score + bant_score + spice_score) / 3, 2)

                # Determine tiers
                mdcp_tier = get_tier(mdcp_score)
                bant_tier = get_tier(bant_score)
                spice_tier = get_tier(spice_score)

                # Persist (when integrated with database)
                # update_payload = {
                #     "mdcp_score": float(mdcp_score),
                #     "mdcp_tier": mdcp_tier,
                #     "bant_score": float(bant_score),
                #     "bant_tier": bant_tier,
                #     "spice_score": float(spice_score),
                #     "spice_tier": spice_tier,
                #     "overall_score": overall_score,
                #     "last_scored_at": now.isoformat(),
                #     "updated_at": now.isoformat()
                # }
                # supabase.table("contacts").update(update_payload).eq("id", contact["id"]).execute()

                scored_count += 1

            except Exception as e:
                errors.append({
                    "contact_id": contact.get("id"),
                    "error": str(e)
                })

        # 4. RETURN BATCH RESPONSE
        return BatchScoringResponse(
            success=True,
            scored_count=scored_count,
            total_contacts=len(contacts),
            errors=errors if errors else None,
            message=f"Successfully scored {scored_count}/{len(contacts)} contacts"
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error scoring all contacts: {str(e)}")
