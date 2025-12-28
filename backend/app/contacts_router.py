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
# LAZY LOAD SUPABASE CLIENT
# ============================================================================

supabase = None

def get_supabase():
    """Lazy initialize Supabase client on first use"""
    global supabase
    if supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        if not url or not key:
            return None
        supabase = create_client(url, key)
    return supabase

# ============================================================================
# AUTH DEPENDENCY - FIXED VERSION
# ============================================================================

async def get_current_user(authorization: str = Header(None)) -> dict:
    """Validate Supabase JWT and return user info"""
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        # Parse Bearer token
        parts = authorization.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization format")
        
        token = parts[1]
        
        # Create a fresh client for token validation
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            raise HTTPException(status_code=503, detail="Database not configured")
        
        auth_client = create_client(url, key)
        
        # Validate token with Supabase
        try:
            user_resp = auth_client.auth.get_user(token)
        except Exception as auth_error:
            logger.error(f"Supabase auth.get_user failed: {str(auth_error)}")
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        # Extract user from response - handle different response formats
        user = None
        
        # Try attribute access first (newer supabase-py versions)
        if hasattr(user_resp, 'user') and user_resp.user is not None:
            user = user_resp.user
        # Try dict access
        elif isinstance(user_resp, dict) and user_resp.get('user'):
            user = user_resp['user']
        # Direct user object
        elif hasattr(user_resp, 'id'):
            user = user_resp
        
        if not user:
            logger.error(f"No user in response: {type(user_resp)} - {user_resp}")
            raise HTTPException(status_code=401, detail="Invalid token: no user found")
        
        # Extract user_id and email
        user_id = getattr(user, 'id', None) or (user.get('id') if isinstance(user, dict) else None)
        email = getattr(user, 'email', None) or (user.get('email') if isinstance(user, dict) else "") or ""
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user id")
        
        logger.info(f"Authenticated user: {email} ({user_id})")
        return {"id": str(user_id), "email": str(email)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

# ============================================================================
# MODELS
# ============================================================================

class ContactCreate(BaseModel):
    firstname: str
    lastname: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    jobtitle: Optional[str] = None
    linkedinurl: Optional[str] = None
    website: Optional[str] = None

class ContactUpdate(BaseModel):
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    jobtitle: Optional[str] = None
    linkedinurl: Optional[str] = None
    website: Optional[str] = None

# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(prefix="/contacts", tags=["Contacts"])

# GET /api/v3/contacts - List all contacts
@router.get("")
async def list_contacts(
    user: dict = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """List all contacts for the current user"""
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]
        query = client.table("contacts").select("*").eq("userid", user_id)

        if status and status != "all":
            query = query.eq("enrichmentstatus", status)

        if search:
            query = query.or_(f"firstname.ilike.%{search}%,lastname.ilike.%{search}%,email.ilike.%{search}%,company.ilike.%{search}%")

        query = query.order("createdat", desc=True).range(offset, offset + limit - 1)
        result = query.execute()

        return {
            "contacts": result.data or [],
            "total": len(result.data) if result.data else 0,
            "limit": limit,
            "offset": offset,
        }

    except Exception as e:
        logger.error(f"Error listing contacts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# GET /api/v3/contacts/{id} - Get single contact
@router.get("/{contact_id}")
async def get_contact(contact_id: str, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Get a single contact by ID"""
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]
        result = client.table("contacts").select("*").eq("id", contact_id).eq("userid", user_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting contact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# POST /api/v3/contacts - Create contact
@router.post("")
async def create_contact(contact: ContactCreate, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Create a new contact"""
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]
        data = contact.dict()
        data["userid"] = user_id
        data["enrichmentstatus"] = "pending"
        data["createdat"] = datetime.utcnow().isoformat()
        data["updatedat"] = datetime.utcnow().isoformat()

        result = client.table("contacts").insert(data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create contact")

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating contact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# PUT /api/v3/contacts/{id} - Update contact
@router.put("/{contact_id}")
async def update_contact(contact_id: str, contact: ContactUpdate, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Update an existing contact"""
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]

        # Verify ownership
        existing = client.table("contacts").select("id").eq("id", contact_id).eq("userid", user_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Contact not found")

        # Only update provided fields
        update_data = {k: v for k, v in contact.dict().items() if v is not None}
        update_data["updatedat"] = datetime.utcnow().isoformat()

        result = client.table("contacts").update(update_data).eq("id", contact_id).eq("userid", user_id).execute()
        return result.data[0] if result.data else {}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating contact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# DELETE /api/v3/contacts/{id} - Delete contact
@router.delete("/{contact_id}")
async def delete_contact(contact_id: str, user: dict = Depends(get_current_user)) -> Dict[str, str]:
    """Delete a contact"""
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]
        result = client.table("contacts").delete().eq("id", contact_id).eq("userid", user_id).execute()
        return {"status": "deleted", "contact_id": contact_id}

    except Exception as e:
        logger.error(f"Error deleting contact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# GET /api/v3/contacts/stats/summary - Get contact stats
@router.get("/stats/summary", include_in_schema=False)
async def get_contact_stats(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Get contact statistics for dashboard"""
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]

        total = client.table("contacts").select("id", count="exact").eq("userid", user_id).execute()
        enriched = client.table("contacts").select("id", count="exact").eq("userid", user_id).eq("enrichmentstatus", "completed").execute()
        pending = client.table("contacts").select("id", count="exact").eq("userid", user_id).eq("enrichmentstatus", "pending").execute()

        return {
            "total": total.count or 0,
            "enriched": enriched.count or 0,
            "pending": pending.count or 0,
        }

    except Exception as e:
        logger.error(f"Error getting contact stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
