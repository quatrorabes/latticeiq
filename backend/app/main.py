# backend/app/main.py - CORRECTED FOR USER SIGN-UP FLOW
# This version properly validates JWT tokens from Supabase Auth
# Users sign up → get UUID → enter CRM key → syncs immediately

from __future__ import annotations

import jwt
import os
import sys
import uuid
import logging
from pathlib import Path
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

# ========================================
# CRITICAL: FIX PYTHON PATH FIRST
# ========================================

backend_dir = Path(__file__).parent.resolve()
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _getenv_any(*names: str, default: str = "") -> str:
    """Get environment variable from multiple names (for flexibility)"""
    for n in names:
        v = os.getenv(n)
        if v is not None and str(v).strip() != "":
            return str(v)
    return default


# ========================================
# ROUTER IMPORTS (with error handling)
# ========================================

# CRM Settings Router
try:
    from crm.settings_router import router as settings_router
    SETTINGS_ROUTER_AVAILABLE = True
    print("✅ CRM Settings router imported")
except ImportError as e:
    settings_router = None
    SETTINGS_ROUTER_AVAILABLE = False
    print(f"❌ CRM Settings router import failed: {e}")

# CRM Import Router
try:
    from crm.router import router as crm_router
    CRM_ROUTER_AVAILABLE = True
    print("✅ CRM router imported")
except ImportError as e:
    crm_router = None
    CRM_ROUTER_AVAILABLE = False
    print(f"❌ CRM router import failed: {e}")

# Enrichment Router (support both module spellings)
ENRICHMENT_AVAILABLE = False
enrichment_router = None
try:
    from enrichmentv3 import router as enrichment_router
    ENRICHMENT_AVAILABLE = True
    print("✅ Enrichment router imported (enrichmentv3)")
except ImportError:
    try:
        from enrichment_v3 import router as enrichment_router
        ENRICHMENT_AVAILABLE = True
        print("✅ Enrichment router imported (enrichment_v3)")
    except ImportError as e:
        enrichment_router = None
        ENRICHMENT_AVAILABLE = False
        print(f"❌ Enrichment router import failed: {e}")

# Scoring Router
try:
    from scoring.router import router as scoring_router
    SCORING_AVAILABLE = True
    print("✅ Scoring router imported")
except ImportError as e:
    scoring_router = None
    SCORING_AVAILABLE = False
    print(f"❌ Scoring router import failed: {e}")


# ========================================
# SETTINGS
# ========================================

class Settings(BaseModel):
    SUPABASE_URL: str = Field(default="")
    SUPABASE_ANON_KEY: str = Field(default="")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(default="")
    LOG_LEVEL: str = Field(default="INFO")
    ENVIRONMENT: str = Field(default="development")

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            SUPABASE_URL=_getenv_any("SUPABASEURL", "SUPABASE_URL", default=""),
            SUPABASE_ANON_KEY=_getenv_any("SUPABASEANONKEY", "SUPABASE_ANON_KEY", "SUPABASE_ANONKEY", default=""),
            SUPABASE_SERVICE_ROLE_KEY=_getenv_any(
                "SUPABASESERVICEROLEKEY",
                "SUPABASE_SERVICE_ROLE_KEY",
                "SUPABASE_SERVICE_ROLE",
                default="",
            ),
            LOG_LEVEL=_getenv_any("LOGLEVEL", "LOG_LEVEL", default="INFO"),
            ENVIRONMENT=_getenv_any("ENVIRONMENT", default="development"),
        )


@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()


settings = get_settings()

# ========================================
# LOGGING
# ========================================


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    logger = logging.getLogger("latticeiq")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s")
    handler.setFormatter(formatter)
    logger.handlers.clear()
    logger.addHandler(handler)
    return logger


logger = setup_logging(settings.LOG_LEVEL)

# ========================================
# SUPABASE CLIENTS
# ========================================


def initialize_supabase() -> Optional[Client]:
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        logger.warning("⚠️ Supabase anon not configured")
        return None

    try:
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    except Exception as e:
        logger.error(f"❌ Supabase init failed: {str(e)}", extra={"error": str(e)})
        return None


supabase = initialize_supabase()


async def validate_database_schema() -> None:
    if not supabase:
        logger.warning("Supabase not initialized, skipping schema validation")
        return

    required_tables = ["contacts", "importjobs", "importlogs", "dnclist", "crmintegrations"]
    for table in required_tables:
        try:
            supabase.table(table).select("count", count="exact").execute()
            logger.info(f"✅ Table validated: {table}")
        except Exception as e:
            logger.error(f"❌ Table validation failed for {table}: {str(e)}")


# ========================================
# MODELS
# ========================================

class CurrentUser(BaseModel):
    id: str
    email: str = ""


class ContactCreate(BaseModel):
    firstname: str = Field(..., min_length=1, max_length=100)
    lastname: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., pattern=r".+@.+\..+")
    jobtitle: Optional[str] = Field(None, max_length=100)
    company: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    linkedinurl: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=500)


class ContactUpdate(BaseModel):
    firstname: Optional[str] = Field(None, max_length=100)
    lastname: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, pattern=r".+@.+\..+")
    jobtitle: Optional[str] = Field(None, max_length=100)
    company: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    linkedinurl: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=500)
    enrichmentdata: Optional[dict] = None
    mdcpscore: Optional[int] = Field(None, ge=0, le=100)
    bantscore: Optional[int] = Field(None, ge=0, le=100)
    spicescore: Optional[int] = Field(None, ge=0, le=100)


# ========================================
# JWT AUTHENTICATION
# ========================================
# This validates tokens issued by Supabase Auth
# No additional setup needed - works with existing Supabase config

async def get_current_user(authorization: Optional[str] = Header(None)) -> CurrentUser:
    """
    Extract user UUID from Supabase JWT token.
    
    Flow:
    1. User signs up with email/password → Supabase creates JWT
    2. Frontend sends: Authorization: Bearer <jwt_token>
    3. Backend validates token → extracts user.id (UUID)
    4. All subsequent requests filtered by this UUID
    
    No environment variable setup needed!
    """
    
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Extract token from "Bearer <token>" format
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization format")

        token = authorization[7:]  # Remove "Bearer " prefix

        # Validate token using Supabase auth
        # This is the standard way - no JWT secret needed
        user_resp = supabase.auth.get_user(token)
        
        user_obj = getattr(user_resp, "user", None) or (
            user_resp.get("user") if isinstance(user_resp, dict) else None
        )

        if not user_obj:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        # Extract UUID from token
        user_id = getattr(user_obj, "id", None) or (
            user_obj.get("id") if isinstance(user_obj, dict) else None
        )
        email = getattr(user_obj, "email", None) or (
            user_obj.get("email") if isinstance(user_obj, dict) else ""
        )

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token (missing user UUID)")

        return CurrentUser(id=str(user_id), email=str(email or ""))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")


# ========================================
# APP
# ========================================

app = FastAPI(
    title="LatticeIQ Sales Intelligence API",
    version="3.0.0",
    description="Enterprise sales enrichment and lead scoring platform",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url="/api/redoc",
)

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


# ========================================
# EXCEPTION HANDLERS
# ========================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
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
async def validation_exception_handler(request, exc: RequestValidationError):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    logger.warning("Validation error", extra={"request_id": request_id, "errors": exc.errors()})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "request_id": request_id},
    )


# ========================================
# HEALTH
# ========================================

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


# ========================================
# CONTACTS (v3)
# ========================================

contacts_router = APIRouter(prefix="/api/v3/contacts", tags=["Contacts"])


@contacts_router.get("", response_model=dict)
def list_contacts(limit: int = 100, offset: int = 0, user: CurrentUser = Depends(get_current_user)):
    """List all contacts for authenticated user"""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    result = (
        supabase.table("contacts")
        .select("*", count="exact")
        .eq("userid", user.id)  # Filter by user UUID
        .order("createdat", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return {
        "contacts": result.data or [],
        "count": result.count,
        "total": result.count,
        "limit": limit,
        "offset": offset,
    }


@contacts_router.post("", response_model=dict, status_code=201)
def create_contact(contact: ContactCreate, user: CurrentUser = Depends(get_current_user)):
    """Create new contact for authenticated user"""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    data = contact.model_dump()
    data["userid"] = user.id  # Associate with user UUID
    data["id"] = str(uuid.uuid4())
    data["createdat"] = datetime.utcnow().isoformat()

    result = supabase.table("contacts").insert(data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create contact")

    return result.data[0]


@contacts_router.put("/{contactid}", response_model=dict)
def update_contact(contactid: str, patch: ContactUpdate, user: CurrentUser = Depends(get_current_user)):
    """Update contact (must belong to authenticated user)"""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    update_data = {k: v for k, v in patch.model_dump().items() if v is not None}

    if not update_data:
        return {"updated": False, "message": "No fields to update"}

    update_data["updatedat"] = datetime.utcnow().isoformat()

    result = (
        supabase.table("contacts")
        .update(update_data)
        .eq("id", contactid)
        .eq("userid", user.id)  # Ensure user can only update own contacts
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    return result.data[0]


@contacts_router.delete("/{contactid}", status_code=204)
def delete_contact(contactid: str, user: CurrentUser = Depends(get_current_user)):
    """Delete contact (must belong to authenticated user)"""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    result = (
        supabase.table("contacts")
        .delete()
        .eq("id", contactid)
        .eq("userid", user.id)  # Ensure user can only delete own contacts
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    return None


app.include_router(contacts_router)
print("✅ Contacts router registered at /api/v3/contacts")


# ========================================
# OPTIONAL ROUTERS
# ========================================

if CRM_ROUTER_AVAILABLE and crm_router is not None:
    app.include_router(crm_router, prefix="/api/v3/crm")
    print("✅ CRM router registered at /api/v3/crm")
else:
    logger.warning("⚠️ CRM router not available")

if ENRICHMENT_AVAILABLE and enrichment_router is not None:
    app.include_router(enrichment_router, prefix="/api/v3/enrichment")
    print("✅ Enrichment router registered at /api/v3/enrichment")
else:
    logger.warning("⚠️ Enrichment router not available")

if SCORING_AVAILABLE and scoring_router is not None:
    app.include_router(scoring_router, prefix="/api/v3/scoring")
    print("✅ Scoring router registered at /api/v3/scoring")
else:
    logger.warning("⚠️ Scoring router not available")

if SETTINGS_ROUTER_AVAILABLE and settings_router is not None:
    # settings_router defines its own prefix (/api/v3/settings/crm)
    app.include_router(settings_router)
    print("✅ Settings router registered")
else:
    logger.warning("⚠️ Settings router not available")


# ========================================
# STARTUP / SHUTDOWN
# ========================================

@app.on_event("startup")
async def startup_event():
    logger.info("=" * 70)
    logger.info("🚀 LatticeIQ API Starting Up")
    logger.info("=" * 70)
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info("Version: 3.0.0")
    logger.info(f"Supabase (anon): {'Connected' if supabase else 'Disconnected'}")
    logger.info(f"CRM Module: {'✅ Available' if CRM_ROUTER_AVAILABLE else '❌ Not Available'}")
    logger.info(f"Settings Module: {'✅ Available' if SETTINGS_ROUTER_AVAILABLE else '❌ Not Available'}")
    logger.info(f"Enrichment Module: {'✅ Available' if ENRICHMENT_AVAILABLE else '❌ Not Available'}")
    logger.info(f"Scoring Module: {'✅ Available' if SCORING_AVAILABLE else '❌ Not Available'}")
    await validate_database_schema()
    logger.info("=" * 70)


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 LatticeIQ API Shutting Down")
