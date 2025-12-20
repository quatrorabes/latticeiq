"""
LatticeIQ FastAPI Application
Core API entry point with Supabase auth and contacts CRUD.
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Dict, Optional
from uuid import UUID
import os

from supabase import create_client, Client
from pydantic import BaseModel, EmailStr

# Optional: import enrichment router (existing enrichment_v3 implementation)
try:
    from enrichment_v3.api_routes import router as enrichment_router, set_auth_dependency
except ImportError:
    enrichment_router = None
    set_auth_dependency = None

# ============================================================================
# APP & CORS
# ============================================================================

app = FastAPI(title="LatticeIQ API", version="1.0.0", description="Sales Intelligence Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# SUPABASE CLIENT & AUTH
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

security = HTTPBearer()


class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    """
    Validate Supabase JWT from Authorization: Bearer <token>
    and return the Supabase user object.
    """
    try:
        user_response = supabase.auth.get_user(credentials.credentials)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token (no user)")
        return CurrentUser(id=user.id, email=user.email)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# If enrichment_v3 supports auth injection, wire it
if set_auth_dependency is not None:
    set_auth_dependency(get_current_user)
if enrichment_router is not None:
    app.include_router(enrichment_router, prefix="/api/v3", tags=["enrichment"])

# ============================================================================
# Pydantic Models for Contacts
# ============================================================================

class ContactCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    vertical: Optional[str] = None
    persona_type: Optional[str] = None


class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    vertical: Optional[str] = None
    persona_type: Optional[str] = None


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/health")
async def health_check_root():
    """Health check for Render (no /api prefix)"""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
    }
    

# ============================================================================
# CONTACTS CRUD (UUID-SAFE)
# ============================================================================

@app.get("/api/contacts")
async def list_contacts(user: CurrentUser = Depends(get_current_user)):
    """
    Return all contacts for the current Supabase user.
    Shape: { "contacts": [ ... ] }
    """
    result = (
        supabase
        .table("contacts")
        .select("*")
        .eq("user_id", user.id)
        .execute()
    )
    return {"contacts": result.data or []}


@app.get("/api/contacts/{contact_id}")
async def get_contact(contact_id: UUID, user: CurrentUser = Depends(get_current_user)):
    """
    Get a single contact by UUID.
    """
    result = (
        supabase
        .table("contacts")
        .select("*")
        .eq("id", str(contact_id))  # UUID column, pass as string
        .eq("user_id", user.id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    return result.data[0]


@app.post("/api/contacts")
async def create_contact(contact: ContactCreate, user: CurrentUser = Depends(get_current_user)):
    """
    Create a new contact for the current user.
    `id` will be generated by Postgres as UUID (default gen_random_uuid()).
    """
    data = contact.dict()
    data["user_id"] = user.id
    data.setdefault("enrichment_status", "pending")

    result = supabase.table("contacts").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create contact")
    return result.data[0]


@app.put("/api/contacts/{contact_id}")
async def update_contact(
    contact_id: UUID,
    patch: ContactUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    """
    Update an existing contact (partial update).
    """
    update_data = {k: v for k, v in patch.dict().items() if v is not None}
    if not update_data:
        return {"updated": False, "message": "No fields to update"}

    result = (
        supabase
        .table("contacts")
        .update(update_data)
        .eq("id", str(contact_id))
        .eq("user_id", user.id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    return result.data[0]


@app.delete("/api/contacts/{contact_id}")
async def delete_contact(contact_id: UUID, user: CurrentUser = Depends(get_current_user)):
    """
    Delete a contact by UUID for the current user.
    """
    result = (
        supabase
        .table("contacts")
        .delete()
        .eq("id", str(contact_id))
        .eq("user_id", user.id)
        .execute()
    )
    # Supabase doesn't always return deleted rows; just assume success if no error
    return {"deleted": True}


# ============================================================================
# ROOT ENDPOINT
# ============================================================================

from datetime import datetime

@app.get("/")
async def root():
    return {
        "message": "LatticeIQ Sales Intelligence API",
        "version": "1.0.0",
        "docs": "/docs",
    }
    
@app.get("/health")
async def health_check_root():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
    }
    
@app.get("/api/health")
async def health_check_api():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
    }
    