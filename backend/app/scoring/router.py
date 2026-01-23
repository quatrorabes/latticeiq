# backend/app/scoring/router.py
"""
LatticeIQ Scoring Router
API endpoints for MDCP, BANT, SPICE lead scoring with real database integration
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from datetime import datetime
from typing import Optional, Dict, Any, List
from supabase import Client
import asyncio

from .models import ScoreResponse, BatchScoringResponse, BatchScoreRequest
from .calculators import (
    calculate_mdcp_score,
    calculate_bant_score,
    calculate_spice_score
)


router = APIRouter(prefix="/scoring", tags=["scoring"])

# Global supabase client (imported from main)
supabase: Optional[Client] = None

# Track scoring job status
scoring_status: Dict[str, Any] = {
    "is_running": False,
    "progress": 0,
    "total": 0,
    "scored": 0,
    "errors": 0,
    "started_at": None,
    "completed_at": None,
    "message": "Idle"
}


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
# GET SCORING STATUS
# ==========================================

@router.get("/status")
async def get_scoring_status() -> Dict[str, Any]:
    """Get the current status of scoring operations"""
    return scoring_status


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
# HELPER: Score a single contact (sync)
# ==========================================

def _score_single_contact_sync(contact: Dict, mdcp_config: Dict, bant_config: Dict, spice_config: Dict) -> Dict:
    """
    Score a single contact synchronously.
    Returns the update payload or raises exception.
    """
    scores = {}
    
    mdcp_result = calculate_mdcp_score(contact, mdcp_config)
    scores["mdcpscore"] = round(float(mdcp_result.get("score", 0)), 2)
    
    bant_result = calculate_bant_score(contact, bant_config)
    scores["bantscore"] = round(float(bant_result.get("score", 0)), 2)
    
    spice_result = calculate_spice_score(contact, spice_config)
    scores["spicescore"] = round(float(spice_result.get("score", 0)), 2)
    
    # Calculate overall
    overall_score = round((scores["mdcpscore"] + scores["bantscore"] + scores["spicescore"]) / 3, 2)
    
    return {
        "mdcpscore": scores["mdcpscore"],
        "bantscore": scores["bantscore"],
        "spicescore": scores["spicescore"],
        "overallscore": overall_score,
        "updatedat": datetime.utcnow().isoformat()
    }


# ==========================================
# CALCULATE SCORES FOR SINGLE CONTACT
# ==========================================

@router.post("/calculate-all/{contact_id}")
async def calculate_all_scores(contact_id: str) -> ScoreResponse:
    """Calculate all three scoring frameworks (MDCP, BANT, SPICE) for a contact"""
    
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not initialized")
        
        response = supabase.table("contacts").select("*").eq("id", contact_id).single().execute()
        contact = response.data
        
        if not contact:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

        # Get configs
        mdcp_config = await get_scoring_config("mdcp")
        bant_config = await get_scoring_config("bant")
        spice_config = await get_scoring_config("spice")

        # Calculate scores
        update_payload = _score_single_contact_sync(contact, mdcp_config, bant_config, spice_config)
        
        # Persist to database
        update_response = supabase.table("contacts").update(update_payload).eq("id", contact_id).execute()
        
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Failed to persist scores to database")

        # Return response
        return ScoreResponse(
            contact_id=contact_id,
            mdcp_score=update_payload["mdcpscore"],
            mdcp_tier=get_tier(update_payload["mdcpscore"]),
            bant_score=update_payload["bantscore"],
            bant_tier=get_tier(update_payload["bantscore"]),
            spice_score=update_payload["spicescore"],
            spice_tier=get_tier(update_payload["spicescore"]),
            overall_score=update_payload["overallscore"],
            last_scored_at=datetime.utcnow()
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error calculating scores: {str(e)}")


# ==========================================
# BATCH SCORE SELECTED CONTACTS
# ==========================================

@router.post("/batch-score")
async def batch_score_contacts(request: BatchScoreRequest) -> BatchScoringResponse:
    """
    Score selected contacts efficiently.
    Max 100 contacts per request for reliability.
    """
    
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not initialized")
        
        contact_ids = request.contact_ids
        
        if not contact_ids:
            raise HTTPException(status_code=400, detail="No contact IDs provided")
        
        if len(contact_ids) > 100:
            raise HTTPException(status_code=400, detail="Max 100 contacts per batch. Use Score All for larger sets.")
        
        # Get configs once
        mdcp_config = await get_scoring_config("mdcp")
        bant_config = await get_scoring_config("bant")
        spice_config = await get_scoring_config("spice")
        
        # Fetch contacts in small chunks
        CHUNK_SIZE = 25
        all_contacts = []
        
        for i in range(0, len(contact_ids), CHUNK_SIZE):
            chunk_ids = contact_ids[i:i + CHUNK_SIZE]
            try:
                chunk_response = supabase.table("contacts").select("*").in_("id", chunk_ids).execute()
                if chunk_response.data:
                    all_contacts.extend(chunk_response.data)
            except Exception as e:
                print(f"Error fetching chunk {i}: {e}")
        
        if not all_contacts:
            raise HTTPException(status_code=404, detail="No contacts found with provided IDs")
        
        # Score and update each contact
        successful_updates = 0
        errors = []
        
        for contact in all_contacts:
            try:
                update_payload = _score_single_contact_sync(contact, mdcp_config, bant_config, spice_config)
                result = supabase.table("contacts").update(update_payload).eq("id", contact["id"]).execute()
                if result.data:
                    successful_updates += 1
            except Exception as e:
                errors.append({"contact_id": contact.get("id"), "error": str(e)})
        
        return BatchScoringResponse(
            success=len(errors) == 0,
            scored_count=successful_updates,
            total_contacts=len(all_contacts),
            errors=errors if errors else None,
            message=f"Successfully scored {successful_updates}/{len(all_contacts)} contacts"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error batch scoring: {str(e)}")


# ==========================================
# BACKGROUND TASK: Score all contacts
# ==========================================

def _run_score_all_background():
    """
    Background task to score all contacts.
    Updates global scoring_status for progress tracking.
    """
    global scoring_status
    
    try:
        if not supabase:
            scoring_status["message"] = "Database not initialized"
            scoring_status["is_running"] = False
            return
        
        # Get configs (sync version)
        configs = {
            "mdcp": {
                "framework": "mdcp",
                "weights": {"money": 25, "decisionmaker": 25, "champion": 25, "process": 25},
                "thresholds": {"hotMin": 71, "warmMin": 40},
                "config": {
                    "moneyMinRevenue": 1000000,
                    "moneyMaxRevenue": 100000000,
                    "decisionmakerTitles": ["CEO", "VP", "Director", "President", "Owner", "CTO", "CFO"],
                    "championEngagementDays": 30
                }
            },
            "bant": {
                "framework": "bant",
                "weights": {"budget": 25, "authority": 25, "need": 25, "timeline": 25},
                "thresholds": {"hotMin": 71, "warmMin": 40},
                "config": {}
            },
            "spice": {
                "framework": "spice",
                "weights": {"situation": 20, "problem": 20, "implication": 20, "criticalEvent": 20, "decision": 20},
                "thresholds": {"hotMin": 71, "warmMin": 40},
                "config": {}
            }
        }
        
        mdcp_config = configs["mdcp"]
        bant_config = configs["bant"]
        spice_config = configs["spice"]
        
        # First, count total contacts
        count_response = supabase.table("contacts").select("id", count="exact").execute()
        total_contacts = count_response.count or 0
        
        scoring_status["total"] = total_contacts
        scoring_status["message"] = f"Scoring {total_contacts} contacts..."
        
        if total_contacts == 0:
            scoring_status["message"] = "No contacts to score"
            scoring_status["is_running"] = False
            scoring_status["completed_at"] = datetime.utcnow().isoformat()
            return
        
        # Process in pages
        PAGE_SIZE = 50
        offset = 0
        scored = 0
        errors = 0
        
        while True:
            try:
                page_response = supabase.table("contacts") \
                    .select("*") \
                    .range(offset, offset + PAGE_SIZE - 1) \
                    .execute()
            except Exception as e:
                print(f"Error fetching page at offset {offset}: {e}")
                errors += 1
                break
            
            contacts = page_response.data
            
            if not contacts:
                break
            
            # Score each contact in this page
            for contact in contacts:
                try:
                    update_payload = _score_single_contact_sync(contact, mdcp_config, bant_config, spice_config)
                    result = supabase.table("contacts").update(update_payload).eq("id", contact["id"]).execute()
                    if result.data:
                        scored += 1
                except Exception as e:
                    print(f"Error scoring contact {contact.get('id')}: {e}")
                    errors += 1
                
                # Update progress
                scoring_status["scored"] = scored
                scoring_status["errors"] = errors
                scoring_status["progress"] = round((scored + errors) / total_contacts * 100, 1)
                scoring_status["message"] = f"Scored {scored}/{total_contacts} contacts..."
            
            offset += PAGE_SIZE
            
            if len(contacts) < PAGE_SIZE:
                break
        
        # Complete
        scoring_status["is_running"] = False
        scoring_status["completed_at"] = datetime.utcnow().isoformat()
        scoring_status["progress"] = 100
        scoring_status["message"] = f"Complete! Scored {scored} contacts ({errors} errors)"
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        scoring_status["is_running"] = False
        scoring_status["message"] = f"Error: {str(e)}"
        scoring_status["completed_at"] = datetime.utcnow().isoformat()


# ==========================================
# SCORE ALL CONTACTS (WITH BACKGROUND TASK)
# ==========================================

@router.post("/score-all")
async def score_all_contacts(background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    Score ALL contacts in workspace.
    Returns immediately and processes in background.
    Check /scoring/status for progress.
    """
    global scoring_status
    
    # Check if already running
    if scoring_status["is_running"]:
        return {
            "success": False,
            "message": "Scoring already in progress",
            "status": scoring_status
        }
    
    # Reset status
    scoring_status = {
        "is_running": True,
        "progress": 0,
        "total": 0,
        "scored": 0,
        "errors": 0,
        "started_at": datetime.utcnow().isoformat(),
        "completed_at": None,
        "message": "Starting..."
    }
    
    # Add background task
    background_tasks.add_task(_run_score_all_background)
    
    return {
        "success": True,
        "message": "Scoring started in background. Check /api/v3/scoring/status for progress.",
        "status": scoring_status
    }
