# ============================================================================
# FILE: backend/app/routers/smart_lists_router.py
# PURPOSE: Dynamic smart lists with filters
# ============================================================================

import os
import json
from typing import Optional, List, Any
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from pydantic import BaseModel
from supabase import create_client
import jwt

router = APIRouter(prefix="/smart-lists", tags=["Smart Lists"])

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

# Models
class FilterCondition(BaseModel):
    field: str
    operator: str  # equals, not_equals, contains, gt, gte, lt, lte, is_null, is_not_null, in_list
    value: Any

class SmartListCreate(BaseModel):
    name: str
    description: Optional[str] = None
    filters: List[FilterCondition]
    filter_logic: str = "AND"  # AND, OR
    color: Optional[str] = "#667eea"
    icon: Optional[str] = "📋"

class SmartListUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    filters: Optional[List[FilterCondition]] = None
    filter_logic: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None

# Preset smart lists
PRESET_LISTS = [
    {
        "id": "hot-leads",
        "name": "🔥 Hot Leads",
        "description": "Contacts with MDCP score >= 71",
        "filters": [{"field": "mdcp_score", "operator": "gte", "value": 71}],
        "filter_logic": "AND",
        "is_preset": True,
        "color": "#ef4444",
        "icon": "🔥"
    },
    {
        "id": "warm-leads",
        "name": "⭐ Warm Leads",
        "description": "Contacts with MDCP score 40-70",
        "filters": [
            {"field": "mdcp_score", "operator": "gte", "value": 40},
            {"field": "mdcp_score", "operator": "lt", "value": 71}
        ],
        "filter_logic": "AND",
        "is_preset": True,
        "color": "#f59e0b",
        "icon": "⭐"
    },
    {
        "id": "needs-enrichment",
        "name": "✨ Needs Enrichment",
        "description": "Contacts not yet enriched",
        "filters": [{"field": "enrichment_status", "operator": "not_equals", "value": "completed"}],
        "filter_logic": "AND",
        "is_preset": True,
        "color": "#8b5cf6",
        "icon": "✨"
    },
    {
        "id": "decision-makers",
        "name": "👔 Decision Makers",
        "description": "Contacts identified as decision-makers",
        "filters": [{"field": "enrichment_data->quick_enrich->persona_type", "operator": "equals", "value": "Decision-maker"}],
        "filter_logic": "AND",
        "is_preset": True,
        "color": "#10b981",
        "icon": "👔"
    },
    {
        "id": "recently-enriched",
        "name": "🕐 Recently Enriched",
        "description": "Enriched in the last 7 days",
        "filters": [{"field": "enriched_at", "operator": "gte", "value": "7_days_ago"}],
        "filter_logic": "AND",
        "is_preset": True,
        "color": "#06b6d4",
        "icon": "🕐"
    },
    {
        "id": "high-value",
        "name": "💎 High Value",
        "description": "Hot leads that are decision-makers",
        "filters": [
            {"field": "mdcp_score", "operator": "gte", "value": 71},
            {"field": "enrichment_data->quick_enrich->persona_type", "operator": "equals", "value": "Decision-maker"}
        ],
        "filter_logic": "AND",
        "is_preset": True,
        "color": "#ec4899",
        "icon": "💎"
    },
]

def apply_filters(query, filters: List[dict], logic: str = "AND"):
    """Apply filters to a Supabase query."""
    
    for f in filters:
        field = f["field"]
        op = f["operator"]
        value = f["value"]
        
        # Handle special date values
        if value == "7_days_ago":
            value = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        elif value == "30_days_ago":
            value = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        
        # Handle JSON path fields
        if "->" in field:
            # For JSONB fields, we need raw SQL which Supabase doesn't support directly
            # We'll handle this in post-processing
            continue
        
        # Apply operator
        if op == "equals":
            query = query.eq(field, value)
        elif op == "not_equals":
            query = query.neq(field, value)
        elif op == "contains":
            query = query.ilike(field, f"%{value}%")
        elif op == "gt":
            query = query.gt(field, value)
        elif op == "gte":
            query = query.gte(field, value)
        elif op == "lt":
            query = query.lt(field, value)
        elif op == "lte":
            query = query.lte(field, value)
        elif op == "is_null":
            query = query.is_(field, "null")
        elif op == "is_not_null":
            query = query.not_.is_(field, "null")
        elif op == "in_list" and isinstance(value, list):
            query = query.in_(field, value)
    
    return query

def post_filter_json(contacts: List[dict], filters: List[dict]) -> List[dict]:
    """Apply JSON path filters in Python (post-processing)."""
    result = contacts
    
    for f in filters:
        field = f["field"]
        if "->" not in field:
            continue
        
        op = f["operator"]
        value = f["value"]
        
        # Parse JSON path: enrichment_data->quick_enrich->persona_type
        parts = field.split("->")
        
        def get_nested(obj, parts):
            for p in parts:
                if obj is None:
                    return None
                obj = obj.get(p) if isinstance(obj, dict) else None
            return obj
        
        def matches(contact):
            actual = get_nested(contact, parts)
            if op == "equals":
                return actual == value
            elif op == "not_equals":
                return actual != value
            elif op == "contains" and actual:
                return value.lower() in str(actual).lower()
            return True
        
        result = [c for c in result if matches(c)]
    
    return result

@router.get("/presets")
async def get_preset_lists(user: dict = Depends(get_current_user)):
    """Get all preset smart lists with counts."""
    
    client = get_supabase()
    if not client:
        return {"lists": PRESET_LISTS}
    
    # Get all contacts for counting
    all_contacts = client.table("contacts").select("*").execute()
    contacts = all_contacts.data or []
    
    result = []
    for preset in PRESET_LISTS:
        # Apply filters to count
        filtered = contacts
        for f in preset["filters"]:
            filtered = post_filter_json(filtered, [f])
        
        result.append({
            **preset,
            "count": len(filtered)
        })
    
    return {"lists": result}

@router.get("/preset/{list_id}/contacts")
async def get_preset_list_contacts(
    list_id: str,
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    user: dict = Depends(get_current_user)
):
    """Get contacts in a preset smart list."""
    
    # Find preset
    preset = next((p for p in PRESET_LISTS if p["id"] == list_id), None)
    if not preset:
        raise HTTPException(status_code=404, detail="List not found")
    
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Build query
    query = client.table("contacts").select("*")
    query = apply_filters(query, preset["filters"], preset["filter_logic"])
    
    result = query.execute()
    contacts = result.data or []
    
    # Post-filter for JSON fields
    contacts = post_filter_json(contacts, preset["filters"])
    
    # Paginate
    total = len(contacts)
    contacts = contacts[offset:offset + limit]
    
    return {
        "list": preset,
        "contacts": contacts,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@router.get("/")
async def get_custom_lists(user: dict = Depends(get_current_user)):
    """Get user's custom smart lists."""
    
    client = get_supabase()
    if not client:
        return {"lists": []}
    
    result = client.table("smart_lists").select("*").eq("user_id", user["id"]).execute()
    return {"lists": result.data or []}

@router.post("/")
async def create_smart_list(data: SmartListCreate, user: dict = Depends(get_current_user)):
    """Create a custom smart list."""
    
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not available")
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = client.table("smart_lists").insert({
        "user_id": user["id"],
        "name": data.name,
        "description": data.description,
        "filters": [f.dict() for f in data.filters],
        "filter_logic": data.filter_logic,
        "color": data.color,
        "icon": data.icon,
        "created_at": now,
        "updated_at": now
    }).execute()
    
    return {"status": "created", "list": result.data[0] if result.data else None}

@router.get("/{list_id}/contacts")
async def get_list_contacts(
    list_id: str,
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    user: dict = Depends(get_current_user)
):
    """Get contacts in a custom smart list."""
    
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Get list
    list_result = client.table("smart_lists").select("*").eq("id", list_id).eq("user_id", user["id"]).execute()
    if not list_result.data:
        raise HTTPException(status_code=404, detail="List not found")
    
    smart_list = list_result.data[0]
    
    # Get contacts with filters
    query = client.table("contacts").select("*")
    query = apply_filters(query, smart_list["filters"], smart_list["filter_logic"])
    
    result = query.execute()
    contacts = result.data or []
    contacts = post_filter_json(contacts, smart_list["filters"])
    
    total = len(contacts)
    contacts = contacts[offset:offset + limit]
    
    return {
        "list": smart_list,
        "contacts": contacts,
        "total": total
    }

@router.delete("/{list_id}")
async def delete_smart_list(list_id: str, user: dict = Depends(get_current_user)):
    """Delete a custom smart list."""
    
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not available")
    
    client.table("smart_lists").delete().eq("id", list_id).eq("user_id", user["id"]).execute()
    return {"status": "deleted"}
