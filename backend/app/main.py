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

# Quick enrich disabled for now - using router instead
QUICK_ENRICH_AVAILABLE = False

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
    formatter = jsonlogger.JsonFormatter(
        "%(timestamp)s %(level)s %(name)s %(message)s %(request_id)s"
    )
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
        logger.error(
            f"❌ Supabase initialization failed: {str(e)}", extra={"error": str(e)}
        )
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
        user_obj = getattr(user_resp, "user", None) or (
            user_resp.get("user") if isinstance(user_resp, dict) else None
        )

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
        raise HTTPException(
            status_code=401, detail=f"Invalid authorization header format: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ============================================================================
# ROUTER IMPORTS (with error handling)
# ============================================================================

# CRM Settings Router
try:
    from app.crm.settings_router import router as settings_router
    SETTINGS_ROUTER_AVAILABLE = True
    print("✅ CRM Settings router imported")
except ImportError as e:
    settings_router = None
    SETTINGS_ROUTER_AVAILABLE = False
    print(f"❌ CRM Settings router import failed: {e}")

# CRM Import Router (HubSpot, Salesforce, Pipedrive, CSV)
try:
    from app.crm.router import router as crm_router
    CRM_ROUTER_AVAILABLE = True
    print("✅ CRM router imported")
except ImportError as e:
    crm_router = None
    CRM_ROUTER_AVAILABLE = False
    print(f"❌ CRM router import failed: {e}")

# Enrichment Router (Perplexity/GPT-4)
try:
    from app.enrichment_v3.enrich_router import router as enrich_router
    ENRICH_ROUTER_AVAILABLE = True
    print("✅ Enrichment router imported")
except ImportError as e:
    enrich_router = None
    ENRICH_ROUTER_AVAILABLE = False
    print(f"❌ Enrichment router import failed: {e}")

# Scoring Router (MDCP/BANT/SPICE)
try:
    from app.scoring.router import router as scoring_router
    SCORING_AVAILABLE = True
    print("✅ Scoring router imported")
except ImportError as e:
    scoring_router = None
    SCORING_AVAILABLE = False
    print(f"❌ Scoring router import failed: {e}")

# ============================================================================
# REGISTER ALL ROUTERS (after app creation)
# ============================================================================

if SETTINGS_ROUTER_AVAILABLE:
    app.include_router(settings_router, prefix="/api/v3")
    print("✅ Settings router registered at /api/v3")

if CRM_ROUTER_AVAILABLE:
    app.include_router(crm_router, prefix="/api/v3")
    print("✅ CRM router registered at /api/v3")

if ENRICH_ROUTER_AVAILABLE:
    app.include_router(enrich_router, prefix="/api/v3")
    print("✅ Enrichment router registered at /api/v3")

if SCORING_AVAILABLE:
    app.include_router(scoring_router, prefix="/api/v3")
    print("✅ Scoring router registered at /api/v3")

# ============================================================================
# HEALTH CHECK ENDPOINT
# ============================================================================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected" if supabase else "disconnected",
    }

# ============================================================================
# STARTUP/SHUTDOWN EVENTS
# ============================================================================

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 LatticeIQ API starting up...")
    await validate_database_schema()
    logger.info("✅ Application startup complete")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 LatticeIQ API shutting down...")

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "body": exc.body,
        },
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

# ============================================================================
# ROOT ENDPOINT
# ============================================================================

@app.get("/")
async def root():
    return {
        "name": "LatticeIQ Sales Intelligence API",
        "version": "3.0.0",
        "endpoints": {
            "health": "/health",
            "docs": "/api/docs",
            "crm_settings": "/api/v3/settings/crm",
            "crm_import": "/api/v3/import",
            "enrich": "/api/v3/enrich",
            "scoring": "/api/v3/score",
        },
    }
