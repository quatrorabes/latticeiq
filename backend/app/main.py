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
from datetime import datetime
from typing import Optional
from functools import lru_cache

import jwt  # PyJWT (must be "PyJWT" in requirements)

import logging
from fastapi import FastAPI, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client
from pythonjsonlogger import jsonlogger

# ============================================================================
# CRITICAL: FIX PYTHON PATH FIRST
# ============================================================================

backend_dir = Path(__file__).parent.resolve()
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ============================================================================
# CREATE APP FIRST
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
# LOAD ENVIRONMENT & SUPABASE
# ============================================================================

class Settings(BaseModel):
    SUPABASE_URL: str = Field(default="", alias="SUPABASE_URL")
    SUPABASE_ANON_KEY: str = Field(default="", alias="SUPABASE_ANON_KEY")
    SUPABASE_SERVICE_KEY: str = Field(default="", alias="SUPABASE_SERVICE_KEY")
    LOG_LEVEL: str = Field(default="INFO", alias="LOG_LEVEL")
    ENVIRONMENT: str = Field(default="development", alias="ENVIRONMENT")

    # Support BOTH Render keys:
    # - CORS_ALLOW_ORIGIN (singular) matches your Render env var
    # - CORS_ALLOW_ORIGINS (plural) optional comma-separated override
    CORS_ALLOW_ORIGIN: str = Field(default="", alias="CORS_ALLOW_ORIGIN")
    CORS_ALLOW_ORIGINS: str = Field(default="", alias="CORS_ALLOW_ORIGINS")

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
            CORS_ALLOW_ORIGIN=os.getenv("CORS_ALLOW_ORIGIN", ""),
            CORS_ALLOW_ORIGINS=os.getenv("CORS_ALLOW_ORIGINS", ""),
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
    formatter = jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    handler.setFormatter(formatter)
    logger.handlers.clear()
    logger.addHandler(handler)
    logger.propagate = False
    return logger

logger = setup_logging(settings.LOG_LEVEL)

# ============================================================================
# MIDDLEWARE
# ============================================================================

app.add_middleware(GZipMiddleware, minimum_size=1000)

# IMPORTANT: do NOT use "*" with allow_credentials=True.
default_origins = [
    "https://latticeiq.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Start with defaults, then merge in env overrides.
allow_origins = list(default_origins)

# If Render sets a single allowed origin (your case: CORS_ALLOW_ORIGIN)
if getattr(settings, "CORS_ALLOW_ORIGIN", "").strip():
    origin = settings.CORS_ALLOW_ORIGIN.strip()
    if origin not in allow_origins:
        allow_origins.append(origin)

# If you later set a comma-separated list (CORS_ALLOW_ORIGINS), merge them too.
if settings.CORS_ALLOW_ORIGINS.strip():
    for o in settings.CORS_ALLOW_ORIGINS.split(","):
        o = o.strip()
        if o and o not in allow_origins:
            allow_origins.append(o)

logger.info({"event": "cors_config", "allow_origins": allow_origins})

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
# ============================================================================
# INITIALIZE SUPABASE
# ============================================================================

def initialize_supabase() -> Optional[Client]:
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        logger.warning({"event": "supabase_not_configured"})
        return None

    try:
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        logger.info({"event": "supabase_initialized"})
        return client
    except Exception as e:
        logger.error({"event": "supabase_init_failed", "error": str(e)})
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
# AUTH DEPENDENCY - JWT DECODE
# ============================================================================

async def get_current_user(authorization: str = Header(None)) -> CurrentUser:
    """
    Validate JWT token from Supabase using simple JWT decode.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        parts = authorization.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization format")

        token = parts[1]
        payload = jwt.decode(token, options={"verify_signature": False})

        user_id = payload.get("sub")
        email = payload.get("email", "")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user id")

        return CurrentUser(id=str(user_id), email=str(email))

    except HTTPException:
        raise
    except Exception as e:
        logger.error({"event": "auth_error", "error_type": type(e).__name__, "error": str(e)})
        raise HTTPException(status_code=401, detail="Invalid token")

# ============================================================================
# IMPORT ROUTERS (with error handling)
# ============================================================================

# Contacts Router (CRUD)
try:
    from contacts_router import router as contacts_router
    CONTACTS_ROUTER_AVAILABLE = True
    logger.info({"event": "router_imported", "router": "contacts", "source": "contacts_router"})
except ImportError as e:
    try:
        from app.contacts_router import router as contacts_router
        CONTACTS_ROUTER_AVAILABLE = True
        logger.info({"event": "router_imported", "router": "contacts", "source": "app.contacts_router"})
    except ImportError:
        contacts_router = None
        CONTACTS_ROUTER_AVAILABLE = False
        logger.error({"event": "router_import_failed", "router": "contacts", "error": str(e)})

# CRM Settings Router
try:
    from crm.settings_router import router as settings_router
    SETTINGS_ROUTER_AVAILABLE = True
    logger.info({"event": "router_imported", "router": "settings", "source": "crm.settings_router"})
except ImportError as e:
    try:
        from app.crm.settings_router import router as settings_router
        SETTINGS_ROUTER_AVAILABLE = True
        logger.info({"event": "router_imported", "router": "settings", "source": "app.crm.settings_router"})
    except ImportError:
        settings_router = None
        SETTINGS_ROUTER_AVAILABLE = False
        logger.error({"event": "router_import_failed", "router": "settings", "error": str(e)})

# CRM Import Router
try:
    from crm.router import router as crm_router
    CRM_ROUTER_AVAILABLE = True
    logger.info({"event": "router_imported", "router": "crm", "source": "crm.router"})
except ImportError as e:
    try:
        from app.crm.router import router as crm_router
        CRM_ROUTER_AVAILABLE = True
        logger.info({"event": "router_imported", "router": "crm", "source": "app.crm.router"})
    except ImportError:
        crm_router = None
        CRM_ROUTER_AVAILABLE = False
        logger.error({"event": "router_import_failed", "router": "crm", "error": str(e)})

# Enrichment Router
try:
    from enrichment_v3.enrich_router import router as enrich_router
    ENRICH_ROUTER_AVAILABLE = True
    logger.info({"event": "router_imported", "router": "enrichment", "source": "enrichment_v3.enrich_router"})
except ImportError as e:
    try:
        from app.enrichment_v3.enrich_router import router as enrich_router
        ENRICH_ROUTER_AVAILABLE = True
        logger.info({"event": "router_imported", "router": "enrichment", "source": "app.enrichment_v3.enrich_router"})
    except ImportError:
        enrich_router = None
        ENRICH_ROUTER_AVAILABLE = False
        logger.error({"event": "router_import_failed", "router": "enrichment", "error": str(e)})

# Scoring Router
try:
    from app.scoring.router import router as scoring_router
    SCORING_AVAILABLE = True
    logger.info({"event": "router_imported", "router": "scoring", "source": "app.scoring.router"})
except ImportError as e:
    scoring_router = None
    SCORING_AVAILABLE = False
    logger.error({"event": "router_import_failed", "router": "scoring", "error": str(e)})

# ============================================================================
# ICP CONFIG ENDPOINT
# ============================================================================

@app.get("/api/v3/icp-config")
async def get_icp_config():
    return {
        "frameworks": {
            "mdcp": {"name": "MDCP", "description": "Match-Data-Contact-Profile", "weight": 0.33},
            "bant": {"name": "BANT", "description": "Budget-Authority-Need-Timeline", "weight": 0.33},
            "spice": {"name": "SPICE", "description": "Situation-Problem-Implication-Critical Event-Decision", "weight": 0.34},
        },
        "scoring_thresholds": {"high": 80, "medium": 60, "low": 40},
    }

# ============================================================================
# REGISTER ROUTERS
# ============================================================================

if CONTACTS_ROUTER_AVAILABLE and contacts_router is not None:
    app.include_router(contacts_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "contacts", "prefix": "/api/v3"})

if SETTINGS_ROUTER_AVAILABLE and settings_router is not None:
    app.include_router(settings_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "settings", "prefix": "/api/v3"})

if CRM_ROUTER_AVAILABLE and crm_router is not None:
    app.include_router(crm_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "crm", "prefix": "/api/v3"})

if ENRICH_ROUTER_AVAILABLE and enrich_router is not None:
    app.include_router(enrich_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "enrichment", "prefix": "/api/v3"})

if SCORING_AVAILABLE and scoring_router is not None:
    app.include_router(scoring_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "scoring", "prefix": "/api/v3"})

# ============================================================================
# HEALTH CHECK ENDPOINTS
# ============================================================================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected" if supabase else "disconnected",
    }

@app.get("/api/health")
async def api_health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected" if supabase else "disconnected",
        "version": "3.0.0",
        "cors_allow_origins": allow_origins,
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
    logger.info({"event": "startup", "message": "LatticeIQ API starting up..."})

@app.on_event("shutdown")
async def shutdown_event():
    logger.info({"event": "shutdown", "message": "LatticeIQ API shutting down..."})
