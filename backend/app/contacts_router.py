# ============================================================================
# FILE: backend/app/contacts_router.py
# PURPOSE: Contacts CRUD API - List, Get, Create, Update, Delete
# ENDPOINT: /api/v3/contacts
# ============================================================================

import os
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from pydantic import BaseModel, EmailStr

from supabase import create_client

logger = logging.getLogger("latticeiq")

# ============================================================================
# SUPABASE CLIENT
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
elif SUPABASE_URL and SUPABASE_ANON_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
else:
    supabase = None

# ============================================================================
# AUTH
# ============================================================================

async def get_current_user(authorization: str = Header(None)) -> dict:
    """Validate Supabase JWT"""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")

        anon_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        user_resp = anon_client.auth.get_user(token)
        user = getattr(user_resp, "user", None) or (user_resp.get("user") if isinstance(user_resp, dict) else None)

        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = getattr(user, "id", None) or user.get("id")
        email = getattr(user, "email", None) or user.get("email")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        return {"id": user_id, "email": email or ""}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ============================================================================
# MODELS
# ============================================================================

class ContactCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None

class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None

# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(prefix="/contacts", tags=["Contacts"])

# ============================================================================
# LIST CONTACTS
# ============================================================================

@router.get("")
async def list_contacts(
    user: dict = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """List all contacts for the current user"""
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        # Base query
        query = supabase.table("contacts").select("*", count="exact").eq("user_id", user["id"])
        
        # Filter by enrichment status
        if status and status != "all":
            query = query.eq("enrichment_status", status)
        
        # Search filter
        if search:
            query = query.or_(f"first_name.ilike.%{search}%,last_name.ilike.%{search}%,email.ilike.%{search}%,company.ilike.%{search}%")
        
        # Pagination and ordering
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        result = query.execute()
        
        return {
            "contacts": result.data or [],
            "total": result.count or 0,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"Error listing contacts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# GET SINGLE CONTACT
# ============================================================================

@router.get("/{contact_id}")
async def get_contact(
    contact_id: str,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get a single contact by ID with enrichment data"""
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        result = (
            supabase.table("contacts")
            .select("*")
            .eq("id", contact_id)
            .eq("user_id", user["id"])
            .single()
            .execute()
        )
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")
            
        return result.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting contact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# CREATE CONTACT
# ============================================================================

@router.post("")
async def create_contact(
    contact: ContactCreate,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Create a new contact"""
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        data = contact.dict()
        data["user_id"] = user["id"]
        data["enrichment_status"] = "pending"
        data["created_at"] = datetime.utcnow().isoformat()
        data["updated_at"] = datetime.utcnow().isoformat()
        
        result = supabase.table("contacts").insert(data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create contact")
            
        return result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating contact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# UPDATE CONTACT
# ============================================================================

@router.put("/{contact_id}")
async def update_contact(
    contact_id: str,
    contact: ContactUpdate,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Update an existing contact"""
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        # Verify ownership
        existing = (
            supabase.table("contacts")
            .select("id")
            .eq("id", contact_id)
            .eq("user_id", user["id"])
            .single()
            .execute()
        )
        
        if not existing.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        # Update only provided fields
        update_data = {k: v for k, v in contact.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = (
            supabase.table("contacts")
            .update(update_data)
            .eq("id", contact_id)
            .eq("user_id", user["id"])
            .execute()
        )
        
        return result.data[0] if result.data else {}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating contact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# DELETE CONTACT
# ============================================================================

@router.delete("/{contact_id}")
async def delete_contact(
    contact_id: str,
    user: dict = Depends(get_current_user),
) -> Dict[str, str]:
    """Delete a contact"""
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        result = (
            supabase.table("contacts")
            .delete()
            .eq("id", contact_id)
            .eq("user_id", user["id"])
            .execute()
        )
        
        return {"status": "deleted", "contact_id": contact_id}
        
    except Exception as e:
        logger.error(f"Error deleting contact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# STATS ENDPOINT
# ============================================================================

@router.get("/stats/summary")
async def get_contact_stats(
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get contact statistics for dashboard"""
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        # Total contacts
        total = supabase.table("contacts").select("id", count="exact").eq("user_id", user["id"]).execute()
        
        # Enriched contacts
        enriched = supabase.table("contacts").select("id", count="exact").eq("user_id", user["id"]).eq("enrichment_status", "completed").execute()
        
        # Pending contacts
        pending = supabase.table("contacts").select("id", count="exact").eq("user_id", user["id"]).eq("enrichment_status", "pending").execute()
        
        # Failed contacts
        failed = supabase.table("contacts").select("id", count="exact").eq("user_id", user["id"]).eq("enrichment_status", "failed").execute()
        
        return {
            "total": total.count or 0,
            "enriched": enriched.count or 0,
            "pending": pending.count or 0,
            "failed": failed.count or 0,
        }
        
    except Exception as e:
        logger.error(f"Error getting stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
