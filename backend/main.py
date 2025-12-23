# ============================================================================
# FILE: backend/main.py - LatticeIQ Sales Intelligence API
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
import json
from datetime import datetime, timedelta
from typing import Optional
from functools import lru_cache

# FastAPI & Web
from fastapi import FastAPI, Depends, HTTPException, Header, status, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

# Data validation
from pydantic import BaseModel, Field, ValidationError

# Database
from supabase import create_client, Client

# Authentication
from jose import JWTError, jwt

# Logging
from pythonjsonlogger import jsonlogger

# ========================================
# NOW IMPORT LOCAL MODULES (after path fix)
# ========================================
# NOTE: lib.supabase_client removed - doesn't exist and wasn't used

# Import routers with error handling
try:
    from crm.router import router as crm_router
    CRM_AVAILABLE = True
except Exception as e:
    logging.error(f"❌ CRM router import failed: {e}")
    crm_router = None
    CRM_AVAILABLE = False

try:
    from enrichment_v3.api_routes import router as enrichment_router
    ENRICHMENT_AVAILABLE = True
except Exception as e:
    logging.error(f"❌ Enrichment router import failed: {e}")
    enrichment_router = None
    ENRICHMENT_AVAILABLE = False

try:
    from scoring.router import router as scoring_router
    SCORING_AVAILABLE = True
except Exception as e:
    logging.error(f"❌ Scoring router import failed: {e}")
    scoring_router = None
    SCORING_AVAILABLE = False

# ============================================================================
# CONFIGURATION & SETTINGS
# ============================================================================

class Settings(BaseModel):
    """Application configuration"""
    SUPABASE_URL: str = Field(default="", alias="SUPABASE_URL")
    SUPABASE_ANON_KEY: str = Field(default="", alias="SUPABASE_ANON_KEY")
    JWT_SECRET: str = Field(default="dev-secret-change-in-production", alias="JWT_SECRET")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    ALLOWED_HOSTS: list = Field(default=["localhost", "127.0.0.1"])
    LOG_LEVEL: str = Field(default="INFO", alias="LOG_LEVEL")
    ENVIRONMENT: str = Field(default="development", alias="ENVIRONMENT")

    class Config:
        env_file = ".env"
        case_sensitive = True

    @classmethod
    def from_env(cls):
        """Load from environment variables"""
        return cls(
            SUPABASE_URL=os.getenv("SUPABASE_URL", ""),
            SUPABASE_ANON_KEY=os.getenv("SUPABASE_ANON_KEY", ""),
            JWT_SECRET=os.getenv("JWT_SECRET", "dev-secret-change-in-production"),
            ALLOWED_HOSTS=os.getenv("ALLOWED_HOSTS", "localhost").split(","),
            LOG_LEVEL=os.getenv("LOG_LEVEL", "INFO"),
            ENVIRONMENT=os.getenv("ENVIRONMENT", "development"),
        )


@lru_cache
def get_settings() -> Settings:
    """Get cached settings"""
    return Settings.from_env()


# ============================================================================
# LOGGING SETUP
# ============================================================================

def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """Configure structured JSON logging"""
    logger = logging.getLogger("latticeiq")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Console handler with JSON formatter
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        "%(timestamp)s %(level)s %(name)s %(message)s %(request_id)s"
    )

    handler.setFormatter(formatter)

    # Clear existing handlers
    logger.handlers.clear()
    logger.addHandler(handler)

    return logger


settings = get_settings()
logger = setup_logging(settings.LOG_LEVEL)

# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================

def initialize_supabase() -> Optional[Client]:
    """Initialize Supabase client with validation"""
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
    """Verify required tables exist at startup"""
    if not supabase:
        logger.warning("Supabase not initialized, skipping schema validation")
        return

    required_tables = ["contacts", "import_jobs", "import_logs", "dnc_list"]
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
    """Authenticated user context"""
    id: str = Field(..., description="User UUID")
    email: str = Field(..., description="User email address")


class ContactCreate(BaseModel):
    """Contact creation payload"""
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    title: Optional[str] = Field(None, max_length=100)
    company: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=500)


class ContactUpdate(BaseModel):
    """Contact update payload"""
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    title: Optional[str] = Field(None, max_length=100)
    company: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=500)
    enrichment_data: Optional[dict] = None
    mdcp_score: Optional[int] = Field(None, ge=0, le=100)
    bant_score: Optional[int] = Field(None, ge=0, le=100)
    spice_score: Optional[int] = Field(None, ge=0, le=100)


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    timestamp: str
    supabase: str
    environment: str
    crm_available: bool
    enrichment_available: bool
    scoring_available: bool


# ============================================================================
# AUTHENTICATION
# ============================================================================

async def get_current_user(
    authorization: str = Header(None),
    settings: Settings = Depends(get_settings)
) -> CurrentUser:
    """
    Validate JWT Bearer token and extract user claims

    Raises:
        HTTPException: 401 if token missing, invalid, or expired
    """
    if not authorization:
        logger.warning("Authentication failed: missing authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")

        # Decode JWT token
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )

        user_id: str = payload.get("sub")
        email: str = payload.get("email")

        if not user_id or not email:
            raise ValueError("Missing required claims")

        return CurrentUser(id=user_id, email=email)

    except JWTError as e:
        logger.warning(f"JWT validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except ValueError as e:
        logger.warning(f"Authorization header parsing failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

app = FastAPI(
    title="LatticeIQ Sales Intelligence API",
    version="3.0.0",
    description="Enterprise sales enrichment and lead scoring platform",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url="/api/redoc"
)

# ============================================================================
# MIDDLEWARE STACK
# ============================================================================

# CORS (first middleware - most permissive)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure per environment
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time"],
    max_age=3600,
)

# Trusted hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

# Gzip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ============================================================================
# EXCEPTION HANDLERS
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions with structured response"""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    logger.error(
        f"HTTP {exc.status_code}: {exc.detail}",
        extra={"request_id": request_id, "path": request.url.path}
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Handle validation errors"""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    logger.warning(
        "Validation error",
        extra={"request_id": request_id, "errors": exc.errors()}
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "request_id": request_id
        }
    )


# ============================================================================
# INCLUDE ROUTERS
# ============================================================================

# Register routers (with availability checks)
if crm_router and CRM_AVAILABLE:
    app.include_router(crm_router, prefix="/api/v3/crm", tags=["CRM"])
    logger.info("✅ CRM router registered")
else:
    logger.warning("⚠️ CRM router not available")

if enrichment_router and ENRICHMENT_AVAILABLE:
    app.include_router(enrichment_router, prefix="/api/v3/enrichment", tags=["Enrichment"])
    logger.info("✅ Enrichment router registered")
else:
    logger.warning("⚠️ Enrichment router not available")

if scoring_router and SCORING_AVAILABLE:
    app.include_router(scoring_router, prefix="/api/v3/scoring", tags=["Scoring"])
    logger.info("✅ Scoring router registered")
else:
    logger.warning("⚠️ Scoring router not available")

# ============================================================================
# HEALTH ENDPOINTS
# ============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Root health check endpoint"""
    return HealthResponse(
        status="ok",
        version="3.0.0",
        timestamp=datetime.utcnow().isoformat(),
        supabase="connected" if supabase else "disconnected",
        environment=settings.ENVIRONMENT,
        crm_available=CRM_AVAILABLE,
        enrichment_available=ENRICHMENT_AVAILABLE,
        scoring_available=SCORING_AVAILABLE
    )


@app.get("/api/health", response_model=HealthResponse)
async def api_health() -> HealthResponse:
    """API health check endpoint"""
    return HealthResponse(
        status="ok",
        version="3.0.0",
        timestamp=datetime.utcnow().isoformat(),
        supabase="connected" if supabase else "disconnected",
        environment=settings.ENVIRONMENT,
        crm_available=CRM_AVAILABLE,
        enrichment_available=ENRICHMENT_AVAILABLE,
        scoring_available=SCORING_AVAILABLE
    )


@app.get("/api/v3/health", response_model=HealthResponse)
async def api_v3_health() -> HealthResponse:
    """API v3 health check endpoint"""
    return HealthResponse(
        status="ok",
        version="3.0.0",
        timestamp=datetime.utcnow().isoformat(),
        supabase="connected" if supabase else "disconnected",
        environment=settings.ENVIRONMENT,
        crm_available=CRM_AVAILABLE,
        enrichment_available=ENRICHMENT_AVAILABLE,
        scoring_available=SCORING_AVAILABLE
    )


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "LatticeIQ Sales Intelligence API",
        "version": "3.0.0",
        "docs": "/api/docs",
        "environment": settings.ENVIRONMENT,
        "modules": {
            "crm": CRM_AVAILABLE,
            "enrichment": ENRICHMENT_AVAILABLE,
            "scoring": SCORING_AVAILABLE
        }
    }


# ============================================================================
# CONTACTS CRUD ENDPOINTS (v3)
# ============================================================================

contacts_router = APIRouter(prefix="/api/v3/contacts", tags=["Contacts"])


@contacts_router.get("", response_model=dict)
async def list_contacts(
    limit: int = 100,
    offset: int = 0,
    user: CurrentUser = Depends(get_current_user)
):
    """List all contacts for the authenticated user"""
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

        logger.info(
            f"Retrieved {len(result.data or [])} contacts",
            extra={"user_id": user.id, "request_id": request_id}
        )

        return {
            "contacts": result.data or [],
            "count": result.count,
            "total": result.count,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        logger.error(
            f"Error listing contacts: {str(e)}",
            extra={"user_id": user.id, "request_id": request_id}
        )
        raise HTTPException(status_code=500, detail="Failed to retrieve contacts")


@contacts_router.get("/{contact_id}", response_model=dict)
async def get_contact(
    contact_id: str,
    user: CurrentUser = Depends(get_current_user)
):
    """Get a single contact by ID"""
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
async def create_contact(
    contact: ContactCreate,
    user: CurrentUser = Depends(get_current_user)
):
    """Create a new contact"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")

        data = contact.dict()
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
async def update_contact(
    contact_id: str,
    patch: ContactUpdate,
    user: CurrentUser = Depends(get_current_user)
):
    """Update a contact"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")

        update_data = {k: v for k, v in patch.dict().items() if v is not None}
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
async def delete_contact(
    contact_id: str,
    user: CurrentUser = Depends(get_current_user)
):
    """Delete a contact"""
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

# Register contacts router
app.include_router(contacts_router)

# ============================================================================
# STARTUP & SHUTDOWN EVENTS
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Application startup hook"""
    logger.info("=" * 70)
    logger.info("🚀 LatticeIQ API Starting Up")
    logger.info("=" * 70)
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Version: 3.0.0")
    logger.info(f"FastAPI: Initialized")
    logger.info(f"Supabase: {'Connected' if supabase else 'Disconnected'}")
    logger.info(f"CRM Module: {'✅ Available' if CRM_AVAILABLE else '❌ Not Available'}")
    logger.info(f"Enrichment Module: {'✅ Available' if ENRICHMENT_AVAILABLE else '❌ Not Available'}")
    logger.info(f"Scoring Module: {'✅ Available' if SCORING_AVAILABLE else '❌ Not Available'}")

    # Validate database schema
    await validate_database_schema()

    logger.info("=" * 70)


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown hook"""
    logger.info("🛑 LatticeIQ API Shutting Down")


# ============================================================================
# END OF MAIN.PY
# ============================================================================
