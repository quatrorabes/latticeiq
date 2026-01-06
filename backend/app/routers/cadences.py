"""
Cadence Router - Multi-touch sales sequence management
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os

router = APIRouter(prefix="/api/v3/cadences", tags=["cadences"])

# ============================================================================
# CADENCE TEMPLATES
# ============================================================================

CADENCES = {
    'aggressive': {
        'name': 'Aggressive Outreach',
        'description': '7-day blitz for hot leads',
        'touches': [
            {'day': 0, 'type': 'email', 'variant': 1, 'time': '09:00'},
            {'day': 1, 'type': 'call', 'variant': 1, 'time': '10:00'},
            {'day': 3, 'type': 'email', 'variant': 2, 'time': '09:00'},
            {'day': 5, 'type': 'call', 'variant': 2, 'time': '14:00'},
            {'day': 7, 'type': 'email', 'variant': 3, 'time': '09:00'},
        ]
    },
    'standard': {
        'name': 'Standard Follow-Up',
        'description': '14-day balanced approach',
        'touches': [
            {'day': 0, 'type': 'email', 'variant': 1, 'time': '09:00'},
            {'day': 3, 'type': 'email', 'variant': 2, 'time': '09:00'},
            {'day': 7, 'type': 'call', 'variant': 1, 'time': '10:00'},
            {'day': 10, 'type': 'email', 'variant': 3, 'time': '09:00'},
            {'day': 14, 'type': 'call', 'variant': 2, 'time': '14:00'},
        ]
    },
    'nurture': {
        'name': 'Long-Term Nurture',
        'description': '30-day relationship building',
        'touches': [
            {'day': 0, 'type': 'email', 'variant': 1, 'time': '09:00'},
            {'day': 7, 'type': 'email', 'variant': 2, 'time': '09:00'},
            {'day': 14, 'type': 'call', 'variant': 1, 'time': '10:00'},
            {'day': 21, 'type': 'email', 'variant': 3, 'time': '09:00'},
            {'day': 30, 'type': 'call', 'variant': 2, 'time': '14:00'},
        ]
    },
    'quick': {
        'name': 'Quick Check-In',
        'description': '5-day rapid follow-up',
        'touches': [
            {'day': 0, 'type': 'email', 'variant': 1, 'time': '09:00'},
            {'day': 2, 'type': 'email', 'variant': 2, 'time': '09:00'},
            {'day': 5, 'type': 'call', 'variant': 1, 'time': '10:00'},
        ]
    }
}


# ============================================================================
# SUPABASE CLIENT
# ============================================================================

def get_supabase():
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise HTTPException(500, "Supabase not configured")
    return create_client(url, key)


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class StartCadenceRequest(BaseModel):
    contact_id: str
    cadence_type: str = 'standard'
    start_date: Optional[str] = None


class CompleteTouchRequest(BaseModel):
    notes: str = ''
    response_received: bool = False


# ============================================================================
# HEALTH & CONFIG ENDPOINTS
# ============================================================================

@router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "cadences",
        "cadence_types": list(CADENCES.keys()),
        "features": ["sequences", "activity_tracking", "touch_scheduling"]
    }


@router.get("/types")
async def get_cadence_types():
    """Get available cadence types"""
    return {
        "cadences": {
            k: {
                "name": v["name"],
                "description": v["description"],
                "total_touches": len(v["touches"]),
                "duration_days": v["touches"][-1]["day"] if v["touches"] else 0
            }
            for k, v in CADENCES.items()
        }
    }


# ============================================================================
# CADENCE LIFECYCLE
# ============================================================================

@router.post("/start")
async def start_cadence(req: StartCadenceRequest):
    """Start a cadence for a contact"""
    if req.cadence_type not in CADENCES:
        raise HTTPException(400, f"Invalid cadence type: {req.cadence_type}. Valid types: {list(CADENCES.keys())}")
    
    supabase = get_supabase()
    
    # Check if contact exists
    contact_result = supabase.table("contacts").select("id, first_name, last_name").eq("id", req.contact_id).execute()
    if not contact_result.data:
        raise HTTPException(404, "Contact not found")
    
    # Check if already in active cadence
    existing = supabase.table("cadences").select("id").eq("contact_id", req.contact_id).eq("status", "active").execute()
    if existing.data:
        raise HTTPException(400, "Contact already in active cadence. Stop it first.")
    
    # Create cadence
    cadence_config = CADENCES[req.cadence_type]
    start_date = datetime.fromisoformat(req.start_date.replace('Z', '+00:00')) if req.start_date else datetime.now(timezone.utc)
    
    cadence_result = supabase.table("cadences").insert({
        "contact_id": req.contact_id,
        "cadence_type": req.cadence_type,
        "status": "active",
        "current_step": 0,
        "started_at": start_date.isoformat()
    }).execute()
    
    if not cadence_result.data:
        raise HTTPException(500, "Failed to create cadence")
    
    cadence_id = cadence_result.data[0]["id"]
    
    # Schedule all touches
    touches_to_insert = []
    for i, touch in enumerate(cadence_config["touches"], 1):
        scheduled_time = start_date + timedelta(days=touch["day"])
        hour, minute = map(int, touch.get("time", "09:00").split(":"))
        scheduled_time = scheduled_time.replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        touches_to_insert.append({
            "cadence_id": cadence_id,
            "touch_number": i,
            "touch_type": touch["type"],
            "variant_number": touch.get("variant", 1),
            "scheduled_for": scheduled_time.isoformat(),
            "status": "pending"
        })
    
    if touches_to_insert:
        supabase.table("cadence_touches").insert(touches_to_insert).execute()
    
    # Update contact with cadence info
    first_touch = touches_to_insert[0] if touches_to_insert else None
    supabase.table("contacts").update({
        "in_cadence": True,
        "cadence_id": cadence_id,
        "next_touch_at": first_touch["scheduled_for"] if first_touch else None,
        "next_touch_type": first_touch["touch_type"] if first_touch else None
    }).eq("id", req.contact_id).execute()
    
    # Log activity
    supabase.table("activities").insert({
        "contact_id": req.contact_id,
        "activity_type": "cadence_started",
        "channel": "system",
        "message": f"Started {cadence_config['name']} cadence",
        "metadata": {"cadence_type": req.cadence_type, "cadence_id": cadence_id}
    }).execute()
    
    return {
        "success": True,
        "cadence_id": cadence_id,
        "contact_id": req.contact_id,
        "cadence_type": req.cadence_type,
        "cadence_name": cadence_config["name"],
        "status": "active",
        "touches_scheduled": len(touches_to_insert),
        "first_touch": touches_to_insert[0] if touches_to_insert else None
    }


@router.get("/{contact_id}")
async def get_contact_cadence(contact_id: str):
    """Get cadence details for a contact"""
    supabase = get_supabase()
    
    # Get active cadence
    cadence_result = supabase.table("cadences")\
        .select("*")\
        .eq("contact_id", contact_id)\
        .eq("status", "active")\
        .execute()
    
    if not cadence_result.data:
        return {"active": False, "cadence": None}
    
    cadence_data = cadence_result.data[0]
    
    # Get touches
    touches_result = supabase.table("cadence_touches")\
        .select("*")\
        .eq("cadence_id", cadence_data["id"])\
        .order("touch_number")\
        .execute()
    
    touches = touches_result.data or []
    
    # Find next pending touch
    next_touch = next((t for t in touches if t["status"] == "pending"), None)
    completed_count = len([t for t in touches if t["status"] == "completed"])
    
    cadence_config = CADENCES.get(cadence_data["cadence_type"], {})
    
    return {
        "active": True,
        "cadence": {
            "id": cadence_data["id"],
            "type": cadence_data["cadence_type"],
            "name": cadence_config.get("name", cadence_data["cadence_type"]),
            "status": cadence_data["status"],
            "started_at": cadence_data["started_at"],
            "progress": {
                "completed": completed_count,
                "total": len(touches),
                "percentage": round(completed_count / len(touches) * 100) if touches else 0
            },
            "next_touch": next_touch,
            "touches": touches
        }
    }


@router.post("/{contact_id}/stop")
async def stop_cadence(contact_id: str, reason: str = "manual"):
    """Stop an active cadence"""
    supabase = get_supabase()
    
    # Get active cadence
    cadence_result = supabase.table("cadences")\
        .select("id")\
        .eq("contact_id", contact_id)\
        .eq("status", "active")\
        .execute()
    
    if not cadence_result.data:
        raise HTTPException(404, "No active cadence found for this contact")
    
    cadence_id = cadence_result.data[0]["id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Update cadence status
    supabase.table("cadences").update({
        "status": f"stopped_{reason}",
        "completed_at": now
    }).eq("id", cadence_id).execute()
    
    # Cancel pending touches
    supabase.table("cadence_touches").update({
        "status": "cancelled"
    }).eq("cadence_id", cadence_id).eq("status", "pending").execute()
    
    # Update contact
    supabase.table("contacts").update({
        "in_cadence": False,
        "cadence_id": None,
        "next_touch_at": None,
        "next_touch_type": None
    }).eq("id", contact_id).execute()
    
    # Log activity
    supabase.table("activities").insert({
        "contact_id": contact_id,
        "activity_type": "cadence_stopped",
        "channel": "system",
        "message": f"Cadence stopped: {reason}",
        "metadata": {"cadence_id": cadence_id, "reason": reason}
    }).execute()
    
    return {"success": True, "status": "stopped", "reason": reason}


@router.post("/{contact_id}/pause")
async def pause_cadence(contact_id: str, reason: str = ""):
    """Pause an active cadence"""
    supabase = get_supabase()
    
    cadence_result = supabase.table("cadences")\
        .select("id")\
        .eq("contact_id", contact_id)\
        .eq("status", "active")\
        .execute()
    
    if not cadence_result.data:
        raise HTTPException(404, "No active cadence found")
    
    supabase.table("cadences").update({
        "status": "paused",
        "paused_at": datetime.now(timezone.utc).isoformat(),
        "pause_reason": reason
    }).eq("id", cadence_result.data[0]["id"]).execute()
    
    return {"success": True, "status": "paused", "reason": reason}


@router.post("/{contact_id}/resume")
async def resume_cadence(contact_id: str):
    """Resume a paused cadence"""
    supabase = get_supabase()
    
    cadence_result = supabase.table("cadences")\
        .select("id, paused_at")\
        .eq("contact_id", contact_id)\
        .eq("status", "paused")\
        .execute()
    
    if not cadence_result.data:
        raise HTTPException(404, "No paused cadence found")
    
    cadence = cadence_result.data[0]
    
    # Calculate pause duration to shift touches
    if cadence.get("paused_at"):
        paused_at = datetime.fromisoformat(cadence["paused_at"].replace("Z", "+00:00"))
        pause_duration = datetime.now(timezone.utc) - paused_at
        
        # Get pending touches and shift their scheduled times
        touches_result = supabase.table("cadence_touches")\
            .select("id, scheduled_for")\
            .eq("cadence_id", cadence["id"])\
            .eq("status", "pending")\
            .execute()
        
        for touch in (touches_result.data or []):
            original = datetime.fromisoformat(touch["scheduled_for"].replace("Z", "+00:00"))
            new_time = original + pause_duration
            supabase.table("cadence_touches").update({
                "scheduled_for": new_time.isoformat()
            }).eq("id", touch["id"]).execute()
    
    supabase.table("cadences").update({
        "status": "active",
        "paused_at": None,
        "pause_reason": None
    }).eq("id", cadence["id"]).execute()
    
    return {"success": True, "status": "resumed"}


# ============================================================================
# TOUCH MANAGEMENT
# ============================================================================

@router.post("/touches/{touch_id}/complete")
async def complete_touch(touch_id: str, notes: str = "", response_received: bool = False):
    """Mark a touch as completed"""
    supabase = get_supabase()
    
    # Get touch and cadence info
    touch_result = supabase.table("cadence_touches")\
        .select("*, cadences(contact_id, cadence_type)")\
        .eq("id", touch_id)\
        .execute()
    
    if not touch_result.data:
        raise HTTPException(404, "Touch not found")
    
    touch_data = touch_result.data[0]
    cadence = touch_data.get("cadences", {})
    now = datetime.now(timezone.utc).isoformat()
    
    # Update touch
    supabase.table("cadence_touches").update({
        "status": "completed",
        "executed_at": now,
        "notes": notes,
        "response_received": response_received
    }).eq("id", touch_id).execute()
    
    # Update cadence progress
    supabase.table("cadences").update({
        "current_step": touch_data["touch_number"],
        "last_touch_at": now
    }).eq("id", touch_data["cadence_id"]).execute()
    
    # Log activity
    if cadence.get("contact_id"):
        supabase.table("activities").insert({
            "contact_id": cadence["contact_id"],
            "activity_type": f"{touch_data['touch_type']}_completed",
            "channel": touch_data["touch_type"],
            "variant_used": touch_data.get("variant_number"),
            "message": f"Completed cadence touch {touch_data['touch_number']}",
            "metadata": {"touch_id": touch_id, "notes": notes, "response_received": response_received}
        }).execute()
    
    # Find next touch
    next_touch_result = supabase.table("cadence_touches")\
        .select("*")\
        .eq("cadence_id", touch_data["cadence_id"])\
        .eq("status", "pending")\
        .order("touch_number")\
        .limit(1)\
        .execute()
    
    next_touch = next_touch_result.data[0] if next_touch_result.data else None
    
    # Update contact with next touch or mark cadence complete
    if next_touch and cadence.get("contact_id"):
        supabase.table("contacts").update({
            "next_touch_at": next_touch["scheduled_for"],
            "next_touch_type": next_touch["touch_type"]
        }).eq("id", cadence["contact_id"]).execute()
    elif cadence.get("contact_id"):
        # Cadence complete!
        supabase.table("cadences").update({
            "status": "completed",
            "completed_at": now
        }).eq("id", touch_data["cadence_id"]).execute()
        
        supabase.table("contacts").update({
            "in_cadence": False,
            "cadence_id": None,
            "next_touch_at": None,
            "next_touch_type": None
        }).eq("id", cadence["contact_id"]).execute()
        
        supabase.table("activities").insert({
            "contact_id": cadence["contact_id"],
            "activity_type": "cadence_completed",
            "channel": "system",
            "message": "Cadence completed successfully"
        }).execute()
    
    result = {
        "success": True,
        "status": "completed",
        "next_touch": next_touch,
        "cadence_completed": next_touch is None
    }
    
    if response_received:
        result["suggestion"] = "Response received! Consider pausing cadence to focus on this lead."
    
    return result


# ============================================================================
# PENDING TOUCHES & DASHBOARD
# ============================================================================

@router.get("/pending/all")
async def get_all_pending_touches():
    """Get all pending touches that are due"""
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    
    result = supabase.table("cadence_touches")\
        .select("*, cadences(contact_id, cadence_type)")\
        .eq("status", "pending")\
        .lte("scheduled_for", now)\
        .order("scheduled_for")\
        .execute()
    
    return {
        "count": len(result.data or []),
        "touches": result.data or []
    }


@router.get("/pending/today")
async def get_todays_touches():
    """Get all touches scheduled for today"""
    supabase = get_supabase()
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    result = supabase.table("cadence_touches")\
        .select("*, cadences(contact_id, cadence_type)")\
        .eq("status", "pending")\
        .gte("scheduled_for", today_start.isoformat())\
        .lt("scheduled_for", today_end.isoformat())\
        .order("scheduled_for")\
        .execute()
    
    touches = result.data or []
    
    # Group by type
    by_type = {"email": [], "call": [], "linkedin": []}
    for touch in touches:
        touch_type = touch.get("touch_type", "email")
        if touch_type in by_type:
            by_type[touch_type].append(touch)
    
    return {
        "date": today_start.strftime("%Y-%m-%d"),
        "total": len(touches),
        "by_type": {k: len(v) for k, v in by_type.items()},
        "touches": touches
    }


# ============================================================================
# ACTIVITY HISTORY
# ============================================================================

@router.get("/activities/{contact_id}")
async def get_contact_activities(contact_id: str, limit: int = 50):
    """Get activity history for a contact"""
    supabase = get_supabase()
    
    result = supabase.table("activities")\
        .select("*")\
        .eq("contact_id", contact_id)\
        .order("created_at", desc=True)\
        .limit(limit)\
        .execute()
    
    return {"activities": result.data or []}


# ============================================================================
# STATISTICS
# ============================================================================

@router.get("/stats")
async def get_cadence_stats():
    """Get overall cadence statistics"""
    supabase = get_supabase()
    
    # Active cadences
    active_result = supabase.table("cadences").select("id", count="exact").eq("status", "active").execute()
    
    # Completed cadences
    completed_result = supabase.table("cadences").select("id", count="exact").eq("status", "completed").execute()
    
    # Pending touches
    pending_result = supabase.table("cadence_touches").select("id", count="exact").eq("status", "pending").execute()
    
    # Today's touches
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    today_result = supabase.table("cadence_touches")\
        .select("id", count="exact")\
        .eq("status", "pending")\
        .gte("scheduled_for", today_start.isoformat())\
        .lt("scheduled_for", today_end.isoformat())\
        .execute()
    
    # Response rate
    completed_touches = supabase.table("cadence_touches").select("id", count="exact").eq("status", "completed").execute()
    responses = supabase.table("cadence_touches").select("id", count="exact").eq("status", "completed").eq("response_received", True).execute()
    
    total_completed = completed_touches.count or 0
    total_responses = responses.count or 0
    response_rate = (total_responses / total_completed * 100) if total_completed > 0 else 0
    
    return {
        "active_cadences": active_result.count or 0,
        "completed_cadences": completed_result.count or 0,
        "pending_touches": pending_result.count or 0,
        "touches_today": today_result.count or 0,
        "response_rate": round(response_rate, 1)
    }
