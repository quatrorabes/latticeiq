"""
LatticeIQ FastAPI Application

Core API entry point with Supabase auth and contacts CRUD.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client

# ============================================================================
# OPTIONAL ROUTERS
# ============================================================================

ENRICHMENT_AVAILABLE = False
ENRICHMENT_ERROR: Optional[str] = None
try:
    from enrichment_v3.api_routes import router as enrichment_router, set_auth_dependency as set_enrichment_auth
    ENRICHMENT_AVAILABLE = True
except Exception as e:
    enrichment_router = None
    set_enrichment_auth = None
    ENRICHMENT_ERROR = str(e)
    print(f"⚠️  enrichment_v3 import failed: {ENRICHMENT_ERROR}")

QUICK_ENRICH_AVAILABLE = False
QUICK_ENRICH_ERROR: Optional[str] = None
try:
    from quick_enrich import router as quick_enrich_router, set_auth_dependency as set_quick_enrich_auth
    QUICK_ENRICH_AVAILABLE = True
except Exception as e:
    quick_enrich_router = None
    set_quick_enrich_auth = None
    QUICK_ENRICH_ERROR = str(e)
    print(f"⚠️ quick_enrich import failed: {QUICK_ENRICH_ERROR}")
    

# ============================================================================
# APP & CORS
# ============================================================================

app = FastAPI(title="LatticeIQ API", version="1.0.0", description="Sales Intelligence Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# SUPABASE CLIENT & AUTH
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("SUPABASEURL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASEKEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
security = HTTPBearer()


class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    try:
        user_response = supabase.auth.get_user(credentials.credentials)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token (no user)")
        print(f"🔍 AUTH DEBUG: user.id={user.id}, email={user.email}")
        return CurrentUser(id=str(user.id), email=user.email)
    except Exception as e:
        print(f"❌ AUTH ERROR: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
        


# Inject auth into optional routers
if set_enrichment_auth is not None:
    set_enrichment_auth(get_current_user)

if set_quick_enrich_auth is not None:
    set_quick_enrich_auth(get_current_user)

# Register routers
if enrichment_router is not None:
    print("✅ Registering enrichment_v3 router at /api/v3")
    app.include_router(enrichment_router, prefix="/api/v3", tags=["enrichment"])
else:
    print(f"❌ enrichment_v3 NOT available: {ENRICHMENT_ERROR}")

if quick_enrich_router is not None:
    print("✅ Registering quick_enrich router at /api/v3/enrichment")
    app.include_router(quick_enrich_router)  # Router already has /api/v3/enrichment prefix
else:
    print(f"❌ quick_enrich NOT available: {QUICK_ENRICH_ERROR}")


# ============================================================================
# CONTACT MODELS
# ============================================================================

class ContactCreate(BaseModel):
    firstname: str
    lastname: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    vertical: Optional[str] = None
    persona_type: Optional[str] = None


class ContactUpdate(BaseModel):
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    vertical: Optional[str] = None
    persona_type: Optional[str] = None


# ============================================================================
# HEALTH + ROOT
# ============================================================================

@app.get("/health")
async def health_check_root():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "enrichment_available": ENRICHMENT_AVAILABLE,
        "enrichment_error": ENRICHMENT_ERROR,
        "quick_enrich_available": QUICK_ENRICH_AVAILABLE,
        "quick_enrich_error": QUICK_ENRICH_ERROR,
    }


@app.get("/api/health")
async def api_health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "enrichment_available": ENRICHMENT_AVAILABLE,
        "enrichment_error": ENRICHMENT_ERROR,
        "quick_enrich_available": QUICK_ENRICH_AVAILABLE,
        "quick_enrich_error": QUICK_ENRICH_ERROR,
    }


@app.get("/")
async def root():
    return {
        "message": "LatticeIQ Sales Intelligence API",
        "version": "1.0.0",
        "docs": "/docs",
        "enrichment": "available" if ENRICHMENT_AVAILABLE else "unavailable",
        "quick_enrich": "available" if QUICK_ENRICH_AVAILABLE else "unavailable",
    }


# ============================================================================
# CONTACTS CRUD
# ============================================================================

@app.get("/api/contacts")
async def list_contacts(user: CurrentUser = Depends(get_current_user)):
    print(f"🔍 DEBUG: user.id = {user.id}")  # ADD THIS LINE
    result = supabase.table("contacts").select("*").eq("user_id", user.id).execute()
    print(f"🔍 DEBUG: found {len(result.data or [])} contacts")  # ADD THIS LINE
    return {"contacts": result.data or []}



@app.get("/api/contacts/{contact_id}")
async def get_contact(contact_id: UUID, user: CurrentUser = Depends(get_current_user)):
    result = (
        supabase.table("contacts")
        .select("*")
        .eq("id", str(contact_id))
        .eq("user_id", user.id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    return result.data[0]


@app.post("/api/contacts")
async def create_contact(contact: ContactCreate, user: CurrentUser = Depends(get_current_user)):
    data = contact.dict()
    data["user_id"] = user.id
    data.setdefault("enrichment_status", "pending")

    result = supabase.table("contacts").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create contact")
    return result.data[0]


@app.put("/api/contacts/{contact_id}")
async def update_contact(contact_id: UUID, patch: ContactUpdate, user: CurrentUser = Depends(get_current_user)):
    update_data = {k: v for k, v in patch.dict().items() if v is not None}
    if not update_data:
        return {"updated": False, "message": "No fields to update"}

    result = (
        supabase.table("contacts")
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
    supabase.table("contacts").delete().eq("id", str(contact_id)).eq("user_id", user.id).execute()
    return {"deleted": True}
