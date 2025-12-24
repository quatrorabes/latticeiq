# ============================================================================
# FILE: backend/app/main.py - LatticeIQ Sales Intelligence API
# ============================================================================
"""
Enterprise-grade FastAPI application for LatticeIQ
Handles authentication, CRM imports, contact management, and scoring
"""

import os
import sys
from pathlib import Path

# ========================================
# CRITICAL: FIX PYTHON PATH FIRST
# Must be at the very top before any local imports
# ========================================
backend_dir = Path(__file__).parent.resolve()
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Also add legacy support (if needed)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# ========================================

import uuid
import logging
from datetime import datetime
from typing import Optional
from functools import lru_cache

from fastapi import FastAPI, Depends, HTTPException, Header, status, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from pydantic import BaseModel, Field

from supabase import create_client, Client
from pythonjsonlogger import jsonlogger

# ============================================================================
# ROUTER IMPORTS (with error handling)
# ============================================================================

# CRM Settings Router
try:
    from crm.settings_router import router as settings_router
    SETTINGS_ROUTER_AVAILABLE = True
    print("✅ CRM Settings router imported")
except ImportError as e:
    settings_router = None
    SETTINGS_ROUTER_AVAILABLE = False
    print(f"❌ CRM Settings router import failed: {e}")

# CRM Import Router (HubSpot, Salesforce, Pipedrive, CSV)
try:
    from crm.router import router as crm_router
    CRM_ROUTER_AVAILABLE = True
    print("✅ CRM router imported")
except ImportError as e:
    crm_router = None
    CRM_ROUTER_AVAILABLE = False
    print(f"❌ CRM router import failed: {e}")

# Enrichment Router (Perplexity/GPT-4)
try:
    from enrichment_v3 import router as enrichment_router
    ENRICHMENT_AVAILABLE = True
    print("✅ Enrichment router imported")
except ImportError as e:
    enrichment_router = None
    ENRICHMENT_AVAILABLE = False
    print(f"❌ Enrichment router import failed: {e}")

# Scoring Router (MDCP/BANT/SPICE)
try:
    from scoring.router import router as scoring_router
    SCORING_AVAILABLE = True
    print("✅ Scoring router imported")
except ImportError as e:
    scoring_router = None
    SCORING_AVAILABLE = False
    print(f"❌ Scoring router import failed: {e}")

# ============================================================================
# CONFIGURATION & SETTINGS
# ============================================================================

class Settings(BaseModel):
    """Application configuration"""
    SUPABASE_URL: str = Field(default="", alias="SUPABASE_URL")
    SUPABASE_ANON_KEY: str = Field(default="", alias="SUPABASE_ANON_KEY")
    LOG_LEVEL: str = Field(default="INFO", alias="LOG_LEVEL")
    ENVIRONMENT: str = Field(default="development", alias="ENVIRONMENT")

    class Config:
        env_file = ".env"
        case_sensitive = True

    @classmethod
    def from_env(cls):
        return cls(
            SUPABASE_URL=os.getenv("SUPABASE_URL", ""),
            SUPABASE_ANON_KEY=os.getenv("SUPABASE_ANON_KEY", ""),
            LOG_LEVEL=os.getenv("LOG_LEVEL", "INFO"),
            ENVIRONMENT=os.getenv("ENVIRONMENT", "development"),
        )

@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()

settings = get_settings()

# ============================================================================
# LOGGING SETUP
# ============================================================================

def setup_logging(log_level: str = "INFO") -> logging.Logger:
    logger = logging.getLogger("latticeiq")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter("%(timestamp)s %(level)s %(name)s %(message)s %(request_id)s")
    handler.setFormatter(formatter)

    logger.handlers.clear()
    logger.addHandler(handler)
    return logger

logger = setup_logging(settings.LOG_LEVEL)

# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================

def initialize_supabase() -> Optional[Client]:
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        logger.warning("⚠️ SUPABASE_URL or SUPABASE_ANON_KEY not configured")
        return None

    try:
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        logger.info("✅ Supabase initialized successfully")
        return client
    except Exception as e:
        logger.error(f"❌ Supabase initialization failed: {str(e)}", extra={"error": str(e)})
        return None

supabase = initialize_supabase()

async def validate_database_schema():
    if not supabase:
        logger.warning("Supabase not initialized, skipping schema validation")
        return
    required_tables = ["contacts", "import_jobs", "import_logs", "dnc_list", "crm_integrations"]
    for table in required_tables:
        try:
            supabase.table(table).select("count", count="exact").execute()
            logger.info(f"✅ Table validated: {table}")
        except Exception as e:
            logger.error(f"❌ Table validation failed for {table}: {str(e)}")

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class CurrentUser(BaseModel):
    id: str
    email: str = ""

class ContactCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    job_title: Optional[str] = Field(None, max_length=100)
    company: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=500)

class ContactUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    job_title: Optional[str] = Field(None, max_length=100)
    company: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=500)
    enrichment_data: Optional[dict] = None
    mdcp_score: Optional[int] = Field(None, ge=0, le=100)
    bant_score: Optional[int] = Field(None, ge=0, le=100)
    spice_score: Optional[int] = Field(None, ge=0, le=100)

# ============================================================================
# AUTHENTICATION (Supabase-validated)
# ============================================================================

async def get_current_user(
    authorization: str = Header(None),
) -> CurrentUser:
    """
    Correct Supabase flow:
    - Frontend sends Supabase access_token (JWT) in Authorization header
    - Backend validates token by calling supabase.auth.get_user(token)
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")

        user_resp = supabase.auth.get_user(token)
        user_obj = getattr(user_resp, "user", None) or (user_resp.get("user") if isinstance(user_resp, dict) else None)
        if not user_obj:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user_id = getattr(user_obj, "id", None) or user_obj.get("id")
        email = getattr(user_obj, "email", None) or user_obj.get("email") or ""

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token (missing user id)")

        return CurrentUser(id=str(user_id), email=str(email))

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid authorization header format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

app = FastAPI(
    title="LatticeIQ Sales Intelligence API",
    version="3.0.0",
    description="Enterprise sales enrichment and lead scoring platform",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url="/api/redoc",
)

# ============================================================================
# MIDDLEWARE STACK
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time"],
    max_age=3600,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# ============================================================================
# EXCEPTION HANDLERS
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    logger.error(
        f"HTTP {exc.status_code}: {exc.detail}",
        extra={"request_id": request_id, "path": request.url.path},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "request_id": request_id, "timestamp": datetime.utcnow().isoformat()},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    logger.warning("Validation error", extra={"request_id": request_id, "errors": exc.errors()})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "request_id": request_id},
    )

# ============================================================================
# HEALTH ENDPOINTS
# ============================================================================

def _health_payload() -> dict:
    return {
        "status": "ok",
        "version": "3.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "supabase": "connected" if supabase else "disconnected",
        "environment": settings.ENVIRONMENT,
        "crm_available": CRM_ROUTER_AVAILABLE,
        "enrichment_available": ENRICHMENT_AVAILABLE,
        "scoring_available": SCORING_AVAILABLE,
        "settings_available": SETTINGS_ROUTER_AVAILABLE,
    }

@app.get("/health")
async def health_check():
    return _health_payload()

@app.get("/api/health")
async def api_health():
    return _health_payload()

@app.get("/apihealth")
async def apihealth_alias():
    return _health_payload()

@app.get("/api/v3/health")
async def api_v3_health():
    return _health_payload()

@app.get("/")
async def root():
    return {
        "message": "LatticeIQ Sales Intelligence API",
        "version": "3.0.0",
        "docs": "/api/docs",
        "environment": settings.ENVIRONMENT,
        "modules": {
            "crm": CRM_ROUTER_AVAILABLE,
            "enrichment": ENRICHMENT_AVAILABLE,
            "scoring": SCORING_AVAILABLE,
            "settings": SETTINGS_ROUTER_AVAILABLE,
        },
    }

# ============================================================================
# CONTACTS CRUD ENDPOINTS (v3) - Supabase SDK is synchronous!
# ============================================================================

contacts_router = APIRouter(prefix="/api/v3/contacts", tags=["Contacts"])

@contacts_router.get("", response_model=dict)
def list_contacts(
    limit: int = 100,
    offset: int = 0,
    user: CurrentUser = Depends(get_current_user),
):
    request_id = str(uuid.uuid4())
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")

        result = (
            supabase.table("contacts")
            .select("*", count="exact")
            .eq("user_id", user.id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        logger.info(f"Retrieved {len(result.data or [])} contacts", extra={"user_id": user.id, "request_id": request_id})

        return {
            "contacts": result.data or [],
            "count": result.count,
            "total": result.count,
            "limit": limit,
            "offset": offset,
        }

    except Exception as e:
        logger.error(f"Error listing contacts: {str(e)}", extra={"user_id": user.id, "request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve contacts")

@contacts_router.get("/{contact_id}", response_model=dict)
def get_contact(
    contact_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")

        result = (
            supabase.table("contacts")
            .select("*")
            .eq("id", contact_id)
            .eq("user_id", user.id)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        return result.data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve contact")

@contacts_router.post("", response_model=dict, status_code=201)
def create_contact(
    contact: ContactCreate,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")

        data = contact.model_dump()
        data["user_id"] = user.id
        data["id"] = str(uuid.uuid4())
        data["created_at"] = datetime.utcnow().isoformat()

        result = supabase.table("contacts").insert(data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create contact")

        logger.info(f"Contact created: {data['id']}", extra={"user_id": user.id})
        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating contact: {str(e)}", extra={"user_id": user.id})
        raise HTTPException(status_code=500, detail="Failed to create contact")

@contacts_router.put("/{contact_id}", response_model=dict)
def update_contact(
    contact_id: str,
    patch: ContactUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")

        update_data = {k: v for k, v in patch.model_dump().items() if v is not None}
        if not update_data:
            return {"updated": False, "message": "No fields to update"}

        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = (
            supabase.table("contacts")
            .update(update_data)
            .eq("id", contact_id)
            .eq("user_id", user.id)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")

        logger.info(f"Contact updated: {contact_id}", extra={"user_id": user.id})
        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update contact")

@contacts_router.delete("/{contact_id}", status_code=204)
def delete_contact(
    contact_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")

        result = (
            supabase.table("contacts")
            .delete()
            .eq("id", contact_id)
            .eq("user_id", user.id)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")

        logger.info(f"Contact deleted: {contact_id}", extra={"user_id": user.id})
        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete contact")

# ============================================================================
# ROUTER REGISTRATION
# ============================================================================

app.include_router(contacts_router)

if CRM_ROUTER_AVAILABLE and crm_router is not None:
    app.include_router(crm_router, prefix="/api/v3/crm")
    print("✅ CRM router registered at /api/v3/crm")

if ENRICHMENT_AVAILABLE and enrichment_router is not None:
    app.include_router(enrichment_router, prefix="/api/v3/enrichment")
    print("✅ Enrichment router registered at /api/v3/enrichment")

if SCORING_AVAILABLE and scoring_router is not None:
    app.include_router(scoring_router, prefix="/api/v3/scoring")
    print("✅ Scoring router registered at /api/v3/scoring")

if SETTINGS_ROUTER_AVAILABLE and settings_router is not None:
    # This router already defines its own prefix (per your earlier implementation),
    # so we include without adding another prefix here.
    app.include_router(settings_router)
    print("✅ Settings router registered")

# ============================================================================
# STARTUP
# ============================================================================

@app.on_event("startup")
async def startup_event():
    logger.info("=" * 70)
    logger.info("🚀 LatticeIQ API Starting Up")
    logger.info("=" * 70)
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Version: 3.0.0")
    logger.info(f"Supabase: {'Connected' if supabase else 'Disconnected'}")
    logger.info(f"CRM Module: {'✅ Available' if CRM_ROUTER_AVAILABLE else '❌ Not Available'}")
    logger.info(f"Settings Module: {'✅ Available' if SETTINGS_ROUTER_AVAILABLE else '❌ Not Available'}")
    logger.info(f"Enrichment Module: {'✅ Available' if ENRICHMENT_AVAILABLE else '❌ Not Available'}")
    logger.info(f"Scoring Module: {'✅ Available' if SCORING_AVAILABLE else '❌ Not Available'}")
    await validate_database_schema()
    logger.info("=" * 70)

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 LatticeIQ API Shutting Down")
