from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import os
import sys
from supabase import create_client, Client

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ============================================================
# SUPABASE INITIALIZATION
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("❌ WARNING: SUPABASE_URL or SUPABASE_ANON_KEY not set")
    supabase = None
else:
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    print("✅ Supabase initialized")

# ============================================================
# PYDANTIC MODELS
# ============================================================

class CurrentUser(BaseModel):
    id: str
    email: str

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
# DEPENDENCY INJECTION
# ============================================================

async def get_current_user() -> CurrentUser:
    # Fallback user for testing (replace with real JWT validation)
    return CurrentUser(id="test-user-123", email="test@example.com")

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
# HEALTH ENDPOINTS
# ============================================================

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "supabase": "connected" if supabase else "not_connected"
    }

@app.get("/api/health")
async def api_health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "supabase": "connected" if supabase else "not_connected"
    }

@app.get("/")
async def root():
    return {
        "message": "LatticeIQ Sales Intelligence API",
        "version": "1.0.0",
        "docs": "/docs"
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

    return result.data[0]

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

    return result.data[0]

@app.put("/api/contacts/{contact_id}")
async def update_contact(
    contact_id: str,
    patch: ContactUpdate,
    user: CurrentUser = Depends(get_current_user),
):
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

    return result.data[0]

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
# SCORING ROUTER (if it exists)
# ============================================================

scoring_router = None
try:
    from scoring.router import router as scoring_router
    print("✅ Scoring router imported successfully")
    if scoring_router:
        app.include_router(scoring_router)
except (ImportError, ModuleNotFoundError) as e:
    print(f"⚠️ Scoring router not available: {e}")

# ============================================================
# STARTUP EVENT
# ============================================================

@app.on_event("startup")
async def startup_event():
    print("\n" + "=" * 60)
    print("🚀 LatticeIQ API Starting Up")
    print("=" * 60)
    print(f"✅ FastAPI initialized")
    print(f"✅ Supabase: {'CONNECTED' if supabase else 'NOT CONNECTED'}")
    print(f"✅ Scoring router: {'LOADED' if scoring_router else 'NOT LOADED'}")
    print("=" * 60 + "\n")

# ============================================================
# STARTUP
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
