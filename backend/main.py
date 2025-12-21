from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
import os
import sys
from supabase import create_client, Client

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ============================================================
# ROUTER IMPORTS (with try-except to handle missing modules)
# ============================================================

# Quick Enrich Router
quick_enrich_router = None
try:
    from quick_enrich.router import router as quick_enrich_router
    print("✅ quick_enrich router imported successfully")
except (ImportError, ModuleNotFoundError) as e:
    print(f"⚠️ quick_enrich router import error: {e}")
    quick_enrich_router = None

# Scoring Router (from backend/scoring/)
scoring_router = None
try:
    from scoring.router import router as scoring_router
    print("✅ scoring router imported successfully")
except (ImportError, ModuleNotFoundError) as e:
    print(f"⚠️ scoring router import error: {e}")
    scoring_router = None

# Auth imports (with fallback)
CurrentUser = None
get_current_user = None
verify_jwt_token = None

try:
    from core.auth import verify_jwt_token, CurrentUser, get_current_user
    print("✅ core.auth imported successfully")
except (ImportError, ModuleNotFoundError) as e:
    print(f"⚠️ core.auth import error: {e}")
    # Define a simple fallback
    class CurrentUser(BaseModel):
        id: str
        email: str
    
    async def get_current_user():
        return CurrentUser(id="test-user", email="test@example.com")
    
    async def verify_jwt_token(token: str):
        return {"user_id": "test-user"}

# Database imports (with fallback)
get_db = None
try:
    from core.database import get_db
    print("✅ core.database imported successfully")
except (ImportError, ModuleNotFoundError) as e:
    print(f"⚠️ core.database import error: {e}")
    get_db = None

# ============================================================
# INITIALIZE SUPABASE
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ WARNING: SUPABASE_URL or SUPABASE_ANON_KEY not set")
    supabase = None
else:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"✅ Supabase initialized")

# ============================================================
# ENRICHMENT SERVICE STATUS
# ============================================================

ENRICHMENT_AVAILABLE = False
ENRICHMENT_ERROR = None

try:
    import perplexity_service
    ENRICHMENT_AVAILABLE = True
    print("✅ Perplexity enrichment service available")
except (ImportError, ModuleNotFoundError) as e:
    ENRICHMENT_ERROR = str(e)
    print(f"⚠️ Perplexity enrichment not available: {e}")

QUICK_ENRICH_AVAILABLE = False
QUICK_ENRICH_ERROR = None

try:
    from quick_enrich.service import enrich_contact_quick
    QUICK_ENRICH_AVAILABLE = True
    print("✅ Quick enrichment service available")
except (ImportError, ModuleNotFoundError) as e:
    QUICK_ENRICH_ERROR = str(e)
    print(f"⚠️ Quick enrichment not available: {e}")

# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="LatticeIQ Sales Intelligence API",
    version="1.0.0",
    description="Sales enrichment and lead scoring platform"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# PYDANTIC MODELS
# ============================================================

class ContactCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    title: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None

class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    enrichment_data: Optional[dict] = None
    mdcp_score: Optional[int] = None
    bant_score: Optional[int] = None
    spice_score: Optional[int] = None

# ============================================================
# HEALTH + ROOT ENDPOINTS
# ============================================================

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

# ============================================================
# CONTACTS CRUD ENDPOINTS
# ============================================================

@app.get("/api/contacts")
async def list_contacts(user: CurrentUser = Depends(get_current_user)):
    """List all contacts for the authenticated user"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    print(f"🔍 DEBUG: user.id = {user.id}")
    result = supabase.table("contacts").select("*").eq("user_id", user.id).execute()
    print(f"🔍 DEBUG: found {len(result.data or [])} contacts")
    return {"contacts": result.data or []}

@app.get("/api/contacts/{contact_id}")
async def get_contact(contact_id: str, user: CurrentUser = Depends(get_current_user)):
    """Get a single contact by ID"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    result = (
        supabase.table("contacts")
        .select("*")
        .eq("id", contact_id)
        .eq("user_id", user.id)
        .execute()
    )
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    return result.data

@app.post("/api/contacts")
async def create_contact(contact: ContactCreate, user: CurrentUser = Depends(get_current_user)):
    """Create a new contact"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    data = contact.dict()
    data["user_id"] = user.id
    result = supabase.table("contacts").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create contact")
    return result.data

@app.put("/api/contacts/{contact_id}")
async def update_contact(contact_id: str, patch: ContactUpdate, user: CurrentUser = Depends(get_current_user)):
    """Update a contact"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    update_data = {k: v for k, v in patch.dict().items() if v is not None}
    if not update_data:
        return {"updated": False, "message": "No fields to update"}
    
    result = (
        supabase.table("contacts")
        .update(update_data)
        .eq("id", contact_id)
        .eq("user_id", user.id)
        .execute()
    )
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    return result.data

@app.delete("/api/contacts/{contact_id}")
async def delete_contact(contact_id: str, user: CurrentUser = Depends(get_current_user)):
    """Delete a contact"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    result = (
        supabase.table("contacts")
        .delete()
        .eq("id", contact_id)
        .eq("user_id", user.id)
        .execute()
    )
    
    return {"deleted": True, "contact_id": contact_id}

# ============================================================
# ROUTER REGISTRATION
# ============================================================

# Quick Enrich Router
if quick_enrich_router is not None:
    print("✅ Registering quick_enrich router at /api/v3/enrichment")
    app.include_router(quick_enrich_router)
else:
    print("⚠️ quick_enrich router NOT registered")

# Scoring Router
if scoring_router is not None:
    print("✅ Registering scoring router at /api/v3/scoring")
    app.include_router(scoring_router)
else:
    print("⚠️ scoring router NOT registered")

# ============================================================
# STARTUP MESSAGE
# ============================================================

@app.on_event("startup")
async def startup_event():
    print("\n" + "="*60)
    print("🚀 LatticeIQ API Starting Up")
    print("="*60)
    print(f"✅ FastAPI initialized")
    print(f"✅ Scoring router: {'LOADED' if scoring_router else 'NOT LOADED'}")
    print(f"✅ Quick enrich router: {'LOADED' if quick_enrich_router else 'NOT LOADED'}")
    print(f"✅ Supabase: {'CONNECTED' if supabase else 'NOT CONNECTED'}")
    print("="*60 + "\n")

# ============================================================
# STARTUP
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
