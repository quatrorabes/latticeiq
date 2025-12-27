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

from fastapi import FastAPI, Depends, HTTPException, Header, status, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.exceptions import RequestValidationError

from pydantic import BaseModel, Field
from supabase import create_client, Client
from pythonjsonlogger import jsonlogger

# ============================================================================
# CREATE APP FIRST (before importing routers)
# ============================================================================

app = FastAPI(
    title="LatticeIQ Sales Intelligence API",
    version="3.0.0",
    description="Enterprise sales enrichment and lead scoring platform",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url="/api/redoc",
)

# ========================================
# Add middleware
# ========================================

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# LOAD ENVIRONMENT & SUPABASE
# ============================================================================

class Settings(BaseModel):
    SUPABASE_URL: str = Field(default="", alias="SUPABASE_URL")
    SUPABASE_ANON_KEY: str = Field(default="", alias="SUPABASE_ANON_KEY")
    SUPABASE_SERVICE_KEY: str = Field(default="", alias="SUPABASE_SERVICE_KEY")
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
            SUPABASE_SERVICE_KEY=os.getenv("SUPABASE_SERVICE_KEY", ""),
            LOG_LEVEL=os.getenv("LOG_LEVEL", "INFO"),
            ENVIRONMENT=os.getenv("ENVIRONMENT", "development"),
        )

@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()

settings = get_settings()

# ============================================================================
# SETUP LOGGING
# ============================================================================

def setup_logging(log_level: str = "INFO") -> logging.Logger:
    logger = logging.getLogger("latticeiq")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(timestamps=True, levels=True, names=True, messages=True, request_ids=True)
    handler.setFormatter(formatter)

    logger.handlers.clear()
    logger.addHandler(handler)

    return logger

logger = setup_logging(settings.LOG_LEVEL)

# ============================================================================
# INITIALIZE SUPABASE
# ============================================================================

def initialize_supabase() -> Optional[Client]:
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        logger.warning("SUPABASE_URL or SUPABASE_ANON_KEY not configured")
        return None

    try:
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        logger.info("✅ Supabase initialized successfully")
        return client
    except Exception as e:
        logger.error(f"Supabase initialization failed: {str(e)}", extra={"error": str(e)})
        return None

supabase = initialize_supabase()

# ============================================================================
# DEFINE MODELS
# ============================================================================

class CurrentUser(BaseModel):
    id: str
    email: str

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

# ============================================================================
# AUTH DEPENDENCY
# ============================================================================

async def get_current_user(authorization: str = Header(None)) -> CurrentUser:
    """
    Validate JWT token from Supabase and extract user info
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

        # Use Supabase to validate token
        user_resp = supabase.auth.get_user(token)

        user_obj = (
            getattr(user_resp, "user", None) or user_resp.get("user")
            if isinstance(user_resp, dict)
            else user_resp
        )

        if not user_obj:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user_id = getattr(user_obj, "id", None) or user_obj.get("id")
        email = getattr(user_obj, "email", None) or user_obj.get("email") or ""

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user id")

        return CurrentUser(id=str(user_id), email=str(email))

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid authorization header format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ============================================================================
# IMPORT ROUTERS (with error handling)
# ============================================================================

# Contacts Router (CRUD)
try:
    from contacts_router import router as contacts_router
    CONTACTS_ROUTER_AVAILABLE = True
    print("✅ Contacts router imported")
except ImportError as e:
    try:
        from app.contacts_router import router as contacts_router
        CONTACTS_ROUTER_AVAILABLE = True
        print("✅ Contacts router imported (from app.)")
    except ImportError:
        contacts_router = None
        CONTACTS_ROUTER_AVAILABLE = False
        print(f"❌ Contacts router import failed: {e}")

# CRM Settings Router
try:
    from crm.settings_router import router as settings_router
    SETTINGS_ROUTER_AVAILABLE = True
    print("✅ CRM Settings router imported")
except ImportError as e:
    try:
        from app.crm.settings_router import router as settings_router
        SETTINGS_ROUTER_AVAILABLE = True
        print("✅ CRM Settings router imported (from app.)")
    except ImportError:
        settings_router = None
        SETTINGS_ROUTER_AVAILABLE = False
        print(f"❌ CRM Settings router import failed: {e}")

# CRM Import Router
try:
    from crm.router import router as crm_router
    CRM_ROUTER_AVAILABLE = True
    print("✅ CRM router imported")
except ImportError as e:
    try:
        from app.crm.router import router as crm_router
        CRM_ROUTER_AVAILABLE = True
        print("✅ CRM router imported (from app.)")
    except ImportError:
        crm_router = None
        CRM_ROUTER_AVAILABLE = False
        print(f"❌ CRM router import failed: {e}")

# Enrichment Router
try:
    from enrichment_v3.enrich_router import router as enrich_router
    ENRICH_ROUTER_AVAILABLE = True
    print("✅ Quick Enrichment router imported")
except ImportError as e:
    try:
        from app.enrichment_v3.enrich_router import router as enrich_router
        ENRICH_ROUTER_AVAILABLE = True
        print("✅ Quick Enrichment router imported (from app.)")
    except ImportError:
        enrich_router = None
        ENRICH_ROUTER_AVAILABLE = False
        print(f"❌ Quick Enrichment router import failed: {e}")

# Scoring Router
try:
    from scoring.router import router as scoring_router
    SCORING_AVAILABLE = True
    print("✅ Scoring router imported")
except ImportError as e:
    try:
        from app.scoring.router import router as scoring_router
        SCORING_AVAILABLE = True
        print("✅ Scoring router imported (from app.)")
    except ImportError:
        scoring_router = None
        SCORING_AVAILABLE = False
        print(f"❌ Scoring router import failed: {e}")

# ============================================================================
# REGISTER ROUTERS
# ============================================================================

if CONTACTS_ROUTER_AVAILABLE:
    app.include_router(contacts_router, prefix="/api/v3")
    print("✅ Contacts router registered at /api/v3/contacts")

if SETTINGS_ROUTER_AVAILABLE:
    app.include_router(settings_router, prefix="/api/v3")
    print("✅ Settings router registered at /api/v3/settings")

if CRM_ROUTER_AVAILABLE:
    app.include_router(crm_router, prefix="/api/v3")
    print("✅ CRM router registered at /api/v3/import")

if ENRICH_ROUTER_AVAILABLE:
    app.include_router(enrich_router, prefix="/api/v3")
    print("✅ Quick Enrichment router registered at /api/v3/enrich")

if SCORING_AVAILABLE:
    app.include_router(scoring_router, prefix="/api/v3")
    print("✅ Scoring router registered at /api/v3/score")

# ============================================================================
# HEALTH CHECK ENDPOINTS
# ============================================================================

@app.get("/health")
async def health():
    """Simple health check for Render compatibility"""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected" if supabase else "disconnected",
    }

@app.get("/api/health")
async def api_health():
    """Detailed health check"""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected" if supabase else "disconnected",
        "version": "3.0.0",
        "routers": {
            "contacts": CONTACTS_ROUTER_AVAILABLE,
            "settings": SETTINGS_ROUTER_AVAILABLE,
            "crm": CRM_ROUTER_AVAILABLE,
            "enrichment": ENRICH_ROUTER_AVAILABLE,
            "scoring": SCORING_AVAILABLE,
        },
    }

# ============================================================================
# STARTUP / SHUTDOWN EVENTS
# ============================================================================

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 LatticeIQ API starting up...")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 LatticeIQ API shutting down...")
