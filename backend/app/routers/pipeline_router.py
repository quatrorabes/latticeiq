# ============================================================================
# FILE: backend/app/routers/pipeline_router.py
# PURPOSE: Sales pipeline management with stages
# ============================================================================

import os
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from supabase import create_client
import jwt

router = APIRouter(prefix="/pipeline", tags=["Pipeline"])

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
        raise HTTPException(status_code=401, detail="Missing authorization")
    try:
        token = authorization.split(" ", 1)[1]
        payload = jwt.decode(token, options={"verify_signature": False})
        return {"id": payload.get("sub"), "email": payload.get("email", "")}
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

# Default pipeline stages
DEFAULT_STAGES = [
    {"id": "new", "name": "New", "order": 0, "color": "#6b7280", "icon": "📥"},
    {"id": "contacted", "name": "Contacted", "order": 1, "color": "#3b82f6", "icon": "📧"},
    {"id": "qualified", "name": "Qualified", "order": 2, "color": "#8b5cf6", "icon": "✅"},
    {"id": "meeting", "name": "Meeting", "order": 3, "color": "#f59e0b", "icon": "📅"},
    {"id": "proposal", "name": "Proposal", "order": 4, "color": "#ec4899", "icon": "📄"},
    {"id": "negotiation", "name": "Negotiation", "order": 5, "color": "#ef4444", "icon": "🤝"},
    {"id": "closed_won", "name": "Closed Won", "order": 6, "color": "#10b981", "icon": "🎉"},
    {"id": "closed_lost", "name": "Closed Lost", "order": 7, "color": "#6b7280", "icon": "❌"},
]

class MoveContactRequest(BaseModel):
    contact_id: str
    stage_id: str
    notes: Optional[str] = None

class StageUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None

@router.get("/stages")
async def get_pipeline_stages(user: dict = Depends(get_current_user)):
    """Get pipeline stages."""
    
    client = get_supabase()
    if not client:
        return {"stages": DEFAULT_STAGES}
    
    # Try to get custom stages
    result = client.table("pipeline_stages").select("*").eq("user_id", user["id"]).order("order").execute()
    
    if result.data:
        return {"stages": result.data}
    
    return {"stages": DEFAULT_STAGES}

@router.get("/board")
async def get_pipeline_board(user: dict = Depends(get_current_user)):
    """Get full pipeline board with contacts grouped by stage."""
    
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Get stages
    stages = DEFAULT_STAGES
    
    # Get all contacts
    contacts_result = client.table("contacts").select("*").execute()
    contacts = contacts_result.data or []
    
    # Group by stage
    board = {}
    for stage in stages:
        board[stage["id"]] = {
            **stage,
            "contacts": [],
            "count": 0,
            "total_value": 0
        }
    
    for contact in contacts:
        stage_id = contact.get("pipeline_stage") or "new"
        if stage_id in board:
            board[stage_id]["contacts"].append(contact)
            board[stage_id]["count"] += 1
            board[stage_id]["total_value"] += contact.get("deal_value", 0) or 0
    
    return {
        "stages": list(board.values()),
        "total_contacts": len(contacts),
        "total_value": sum(c.get("deal_value", 0) or 0 for c in contacts)
    }

@router.post("/move")
async def move_contact(request: MoveContactRequest, user: dict = Depends(get_current_user)):
    """Move a contact to a different pipeline stage."""
    
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not available")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update contact stage
    result = client.table("contacts").update({
        "pipeline_stage": request.stage_id,
        "pipeline_updated_at": now
    }).eq("id", request.contact_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Log the activity
    try:
        client.table("contact_activities").insert({
            "contact_id": request.contact_id,
            "user_id": user["id"],
            "activity_type": "stage_change",
            "details": {
                "new_stage": request.stage_id,
                "notes": request.notes
            },
            "created_at": now
        }).execute()
    except:
        pass  # Activity logging is optional
    
    return {
        "status": "moved",
        "contact_id": request.contact_id,
        "stage": request.stage_id
    }

@router.post("/bulk-move")
async def bulk_move_contacts(
    contact_ids: List[str],
    stage_id: str,
    user: dict = Depends(get_current_user)
):
    """Move multiple contacts to a stage."""
    
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not available")
    
    now = datetime.now(timezone.utc).isoformat()
    moved = 0
    
    for contact_id in contact_ids:
        try:
            client.table("contacts").update({
                "pipeline_stage": stage_id,
                "pipeline_updated_at": now
            }).eq("id", contact_id).execute()
            moved += 1
        except:
            pass
    
    return {"status": "moved", "count": moved}

@router.get("/stats")
async def get_pipeline_stats(user: dict = Depends(get_current_user)):
    """Get pipeline statistics and conversion metrics."""
    
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not available")
    
    contacts = client.table("contacts").select("*").execute().data or []
    
    # Calculate stats
    stages = {}
    for stage in DEFAULT_STAGES:
        stages[stage["id"]] = 0
    
    for contact in contacts:
        stage = contact.get("pipeline_stage") or "new"
        if stage in stages:
            stages[stage] += 1
    
    total = len(contacts)
    won = stages.get("closed_won", 0)
    lost = stages.get("closed_lost", 0)
    active = total - won - lost
    
    return {
        "total_contacts": total,
        "active_deals": active,
        "closed_won": won,
        "closed_lost": lost,
        "win_rate": round((won / (won + lost) * 100), 1) if (won + lost) > 0 else 0,
        "by_stage": stages,
        "conversion_funnel": [
            {"stage": s["name"], "count": stages.get(s["id"], 0)} 
            for s in DEFAULT_STAGES[:7]  # Exclude closed_lost from funnel
        ]
    }
