# backend/app/main.py

"""
LatticeIQ Sales Intelligence API
Enterprise-grade FastAPI application for lead scoring and enrichment

Version 3.3.0 - Cadence System + Phase 2B Integration + Deep Enrichment + CRM Exports
- Added Cadence management (sequences, touches, activity tracking)
- Added ICP management endpoints
- Added Campaign creation endpoints
- Added Template preview endpoints
- Added FieldAccessor, ICPMatcher, VariableSubstitutor, CampaignBuilder
- Added Deep Enrichment service (Perplexity + GPT-4 two-stage pipeline)
- Added CRM Export routers (Salesforce, Pipedrive, CSV for Google/Outlook)
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional
from functools import lru_cache

import jwt
import logging
from fastapi import FastAPI, HTTPException, Header, status, Request
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
    version="3.3.0",  # Updated for Cadence System
    description="Enterprise sales enrichment and lead scoring platform with ICP targeting, campaign management, cadence sequences, two-stage deep enrichment, and CRM exports",
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
    CORS_ALLOW_ORIGIN: str = Field(default="", alias="CORS_ALLOW_ORIGIN")
    CORS_ALLOW_ORIGINS: str = Field(default="", alias="CORS_ALLOW_ORIGINS")
    PERPLEXITY_API_KEY: str = Field(default="", alias="PERPLEXITY_API_KEY")
    OPENAI_API_KEY: str = Field(default="", alias="OPENAI_API_KEY")
    # CRM API Keys
    SALESFORCE_CLIENT_ID: str = Field(default="", alias="SALESFORCE_CLIENT_ID")
    SALESFORCE_CLIENT_SECRET: str = Field(default="", alias="SALESFORCE_CLIENT_SECRET")
    PIPEDRIVE_API_KEY: str = Field(default="", alias="PIPEDRIVE_API_KEY")

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
            PERPLEXITY_API_KEY=os.getenv("PERPLEXITY_API_KEY", ""),
            OPENAI_API_KEY=os.getenv("OPENAI_API_KEY", ""),
            SALESFORCE_CLIENT_ID=os.getenv("SALESFORCE_CLIENT_ID", ""),
            SALESFORCE_CLIENT_SECRET=os.getenv("SALESFORCE_CLIENT_SECRET", ""),
            PIPEDRIVE_API_KEY=os.getenv("PIPEDRIVE_API_KEY", ""),
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
# CORS MIDDLEWARE - MUST BE FIRST
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)


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
# SUPABASE CLIENT GETTER (for dependency injection)
# ============================================================================

def get_supabase() -> Optional[Client]:
    """
    Get Supabase client instance for dependency injection.
    Used by Phase 2B, Deep Enrichment, and Cadence routers.
    """
    return supabase


# ============================================================================
# DEFINE MODELS
# ============================================================================

class CurrentUser(BaseModel):
    id: str
    email: str


class ContactCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., pattern=r".+@.+\..+")
    job_title: Optional[str] = Field(None, max_length=100)
    company: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=500)


class ContactUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, pattern=r".+@.+\..+")
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
# AUTH DEPENDENCY - JWT DECODE
# ============================================================================

async def get_current_user(authorization: str = Header(None)) -> CurrentUser:
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
# IMPORT & REGISTER HUBSPOT ROUTER (SIMPLIFIED & SAFE)
# ============================================================================

logger.info({"event": "attempting_hubspot_import"})
try:
    from app.hubspot.router import router as hubspot_router
    app.include_router(hubspot_router, prefix="/api/v3")
    logger.info({"event": "hubspot_router_registered", "prefix": "/api/v3/hubspot"})
except Exception as e:
    logger.error({"event": "hubspot_import_failed", "error": str(e), "error_type": type(e).__name__})
    import traceback
    logger.error({"event": "hubspot_traceback", "traceback": traceback.format_exc()})


# ============================================================================
# IMPORT OTHER ROUTERS
# ============================================================================

# Contacts Router
try:
    from app.contacts_router import router as contacts_router
    app.include_router(contacts_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "contacts"})
except Exception as e:
    logger.warning({"event": "router_import_failed", "router": "contacts", "error": str(e)})

# CRM Router
try:
    from app.crm.crm_import_router import router as crm_router
    app.include_router(crm_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "crm"})
except Exception as e:
    logger.warning({"event": "router_import_failed", "router": "crm", "error": str(e)})

# Quick Enrichment Router (enrich_simple.py)
try:
    from app.enrichment_v3.enrich_simple import router as simple_enrich_router
    app.include_router(simple_enrich_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "enrich_simple", "endpoints": [
        "POST /api/v3/enrichment/quick-enrich/{contact_id}",
        "GET /api/v3/enrichment/quick-enrich/{contact_id}/debug"
    ]})
    print("✅ Quick Enrichment router loaded (Perplexity sonar-pro)")
except Exception as e:
    logger.warning({"event": "router_import_failed", "router": "enrich_simple", "error": str(e)})
    print(f"⚠️ Quick Enrichment router not loaded: {e}")

# Deep Enrichment Router (NEW - unified schema with boxes)
try:
    from app.routers.enrichment_v3_deep import router as deepenrichrouter
    app.include_router(deepenrichrouter, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "enrichment_deep", "endpoints": [
        "POST /api/v3/enrichment/deep-enrich/{contact_id}",
        "GET /api/v3/enrichment/deep-enrich/{contact_id}/status",
        "GET /api/v3/enrichment/deep-enrich/{contact_id}/result",
        "GET /api/v3/enrichment/deep-enrich/{contact_id}/debug"
    ]})
    print("✅ Deep Enrichment router loaded (unified box schema)")
except Exception as e:
    import traceback
    full_traceback = traceback.format_exc()
    logger.error({"event": "router_import_failed", "router": "enrichment_deep", "error": str(e), "traceback": full_traceback})
    print(f"⚠️ Deep Enrichment router not loaded: {e}")
    print(f"Full traceback:\n{full_traceback}")



# Scoring Router
try:
    from app.scoring.router import router as scoring_router
    app.include_router(scoring_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "scoring"})
except Exception as e:
    logger.warning({"event": "router_import_failed", "router": "scoring", "error": str(e)})


# ============================================================================
# OUTREACH ROUTER - Email Generation + DISC Call Scripts
# ============================================================================

try:
    from app.routers.outreach import router as outreach_router
    app.include_router(outreach_router)  # Note: No prefix needed - router already has /api/v3/outreach
    logger.info({"event": "router_registered", "router": "outreach", "endpoints": [
        "GET /api/v3/outreach/business-profile",
        "POST /api/v3/outreach/business-profile",
        "POST /api/v3/outreach/generate-emails",
        "POST /api/v3/outreach/generate-call-scripts",
        "GET /api/v3/outreach/emails/{contact_id}",
        "GET /api/v3/outreach/call-scripts/{contact_id}",
        "PATCH /api/v3/outreach/emails/{email_id}/favorite",
        "PATCH /api/v3/outreach/emails/{email_id}/sent",
        "DELETE /api/v3/outreach/emails/{email_id}",
        "GET /api/v3/outreach/health"
    ]})
    print("✅ Outreach router loaded (emails + DISC call scripts)")
except Exception as e:
    logger.warning({"event": "router_import_failed", "router": "outreach", "error": str(e)})
    print(f"⚠️ Outreach router not loaded: {e}")


# ============================================================================
# CADENCE ROUTER - Multi-touch Sequences + Activity Tracking
# ============================================================================

cadence_status = "not_loaded"

try:
    from app.routers.cadences import router as cadences_router
    app.include_router(cadences_router)  # Router already has /api/v3/cadences prefix
    cadence_status = "operational"
    logger.info({"event": "router_registered", "router": "cadences", "endpoints": [
        "GET /api/v3/cadences/health",
        "GET /api/v3/cadences/types",
        "POST /api/v3/cadences/start",
        "GET /api/v3/cadences/{contact_id}",
        "POST /api/v3/cadences/{contact_id}/stop",
        "POST /api/v3/cadences/{contact_id}/pause",
        "POST /api/v3/cadences/{contact_id}/resume",
        "POST /api/v3/cadences/touches/{touch_id}/complete",
        "GET /api/v3/cadences/pending/all",
        "GET /api/v3/cadences/pending/today",
        "GET /api/v3/cadences/activities/{contact_id}",
        "GET /api/v3/cadences/stats"
    ]})
    print("✅ Cadence router loaded (sequences, touches, activities)")
except Exception as e:
    logger.warning({"event": "router_import_failed", "router": "cadences", "error": str(e)})
    print(f"⚠️ Cadence router not loaded: {e}")
    import traceback
    traceback.print_exc()


# ============================================================================
# PHASE 2B ROUTER - ICP, CAMPAIGNS, TEMPLATES
# ============================================================================

# Track Phase 2B status
phase2b_status = {
    "field_accessor": "not_loaded",
    "icp_matcher": "not_loaded",
    "variable_substitutor": "not_loaded",
    "campaign_builder": "not_loaded",
    "router": "not_loaded"
}

try:
    from app.routers.phase2_router import router as phase2_router
    app.include_router(phase2_router)
    phase2b_status["router"] = "operational"
    logger.info({"event": "router_registered", "router": "phase2b", "endpoints": [
        "/api/v3/icps",
        "/api/v3/campaigns", 
        "/api/v3/templates/preview",
        "/api/v3/templates/variables/{contact_id}"
    ]})
    print("✅ Phase 2B router loaded (ICP, Campaigns, Templates)")
except Exception as e:
    logger.warning({"event": "router_import_failed", "router": "phase2b", "error": str(e)})
    print(f"⚠️ Phase 2B router not loaded: {e}")
    import traceback
    traceback.print_exc()

# Verify Phase 2B core classes are importable
try:
    from app.fields.field_accessor import FieldAccessor
    phase2b_status["field_accessor"] = "operational"
    logger.info({"event": "phase2b_class_loaded", "class": "FieldAccessor"})
except Exception as e:
    logger.warning({"event": "phase2b_class_failed", "class": "FieldAccessor", "error": str(e)})

try:
    from app.icp.icp_matcher import ICPMatcher
    phase2b_status["icp_matcher"] = "operational"
    logger.info({"event": "phase2b_class_loaded", "class": "ICPMatcher"})
except Exception as e:
    logger.warning({"event": "phase2b_class_failed", "class": "ICPMatcher", "error": str(e)})

try:
    from app.templates.variable_substitutor import VariableSubstitutor
    phase2b_status["variable_substitutor"] = "operational"
    logger.info({"event": "phase2b_class_loaded", "class": "VariableSubstitutor"})
except Exception as e:
    logger.warning({"event": "phase2b_class_failed", "class": "VariableSubstitutor", "error": str(e)})

try:
    from app.campaigns.campaign_builder import CampaignBuilder
    phase2b_status["campaign_builder"] = "operational"
    logger.info({"event": "phase2b_class_loaded", "class": "CampaignBuilder"})
except Exception as e:
    logger.warning({"event": "phase2b_class_failed", "class": "CampaignBuilder", "error": str(e)})

# Track Deep Enrichment status
deep_enrichment_status = {
    "service": "not_loaded",
    "perplexity_key": "not_configured",
    "openai_key": "not_configured"
}

try:
    from app.enrichment_v3.deep_enrichment import DeepEnrichmentService
    deep_enrichment_status["service"] = "operational"
    
    # Check API keys
    if settings.PERPLEXITY_API_KEY:
        deep_enrichment_status["perplexity_key"] = "configured"
    else:
        deep_enrichment_status["perplexity_key"] = "missing"
        logger.warning({"event": "deep_enrichment_config", "issue": "PERPLEXITY_API_KEY not set"})
    
    if settings.OPENAI_API_KEY:
        deep_enrichment_status["openai_key"] = "configured"
    else:
        deep_enrichment_status["openai_key"] = "missing"
        logger.warning({"event": "deep_enrichment_config", "issue": "OPENAI_API_KEY not set"})
    
    logger.info({"event": "deep_enrichment_service_loaded", "status": deep_enrichment_status})
except Exception as e:
    logger.warning({"event": "deep_enrichment_service_failed", "error": str(e)})
    deep_enrichment_status["service"] = "failed"


# ============================================================================
# CRM EXPORT ROUTERS - SALESFORCE, PIPEDRIVE, CSV
# ============================================================================

# Track CRM Export status
crm_export_status = {
    "salesforce": "not_loaded",
    "pipedrive": "not_loaded",
    "csv_export": "not_loaded"
}

# Salesforce Export Router
try:
    from app.routers.crm_export_salesforce import router as salesforce_export_router
    app.include_router(salesforce_export_router, prefix="/api/v3")
    crm_export_status["salesforce"] = "operational"
    logger.info({"event": "router_registered", "router": "salesforce_export", "endpoints": [
        "POST /api/v3/export/salesforce",
        "POST /api/v3/export/salesforce/bulk",
        "GET /api/v3/export/salesforce/field-mapping",
        "GET /api/v3/export/salesforce/job/{job_id}/status"
    ]})
    print("✅ Salesforce Export router loaded")
except Exception as e:
    logger.warning({"event": "router_import_failed", "router": "salesforce_export", "error": str(e)})
    print(f"⚠️ Salesforce Export router not loaded: {e}")

# Pipedrive Export Router
try:
    from app.routers.crm_export_pipedrive import router as pipedrive_export_router
    app.include_router(pipedrive_export_router, prefix="/api/v3")
    crm_export_status["pipedrive"] = "operational"
    logger.info({"event": "router_registered", "router": "pipedrive_export", "endpoints": [
        "POST /api/v3/export/pipedrive",
        "POST /api/v3/export/pipedrive/bulk",
        "GET /api/v3/export/pipedrive/field-mapping",
        "GET /api/v3/export/pipedrive/job/{job_id}/status"
    ]})
    print("✅ Pipedrive Export router loaded")
except Exception as e:
    logger.warning({"event": "router_import_failed", "router": "pipedrive_export", "error": str(e)})
    print(f"⚠️ Pipedrive Export router not loaded: {e}")

# CSV Export Router (Google Contacts / Outlook)
try:
    from app.routers.crm_export_csv import router as csv_export_router
    app.include_router(csv_export_router, prefix="/api/v3")
    crm_export_status["csv_export"] = "operational"
    logger.info({"event": "router_registered", "router": "csv_export", "endpoints": [
        "POST /api/v3/export/csv",
        "POST /api/v3/export/csv/bulk",
        "GET /api/v3/export/csv/formats"
    ]})
    print("✅ CSV Export router loaded (Google Contacts / Outlook)")
except Exception as e:
    logger.warning({"event": "router_import_failed", "router": "csv_export", "error": str(e)})
    print(f"⚠️ CSV Export router not loaded: {e}")


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
# HEALTH CHECK ENDPOINTS
# ============================================================================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "uptime": "running",
    }


@app.get("/api/v3/health")
async def health_v3():
    db_status = "connected" if supabase else "disconnected"
    
    # Check Phase 2B operational status
    phase2b_operational = all(
        status == "operational" 
        for status in phase2b_status.values()
    )
    
    # Check Deep Enrichment operational status
    deep_enrich_operational = (
        deep_enrichment_status["service"] == "operational" and
        deep_enrichment_status["perplexity_key"] == "configured" and
        deep_enrichment_status["openai_key"] == "configured"
    )
    
    # Check CRM Export operational status
    crm_export_operational = all(
        status == "operational"
        for status in crm_export_status.values()
    )
    
    return {
        "status": "ok",
        "version": "3.3.0",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status,
        "hubspot": "available",
        "cadences": cadence_status,
        "phase2b": {
            "status": "operational" if phase2b_operational else "partial",
            "services": phase2b_status
        },
        "deep_enrichment": {
            "status": "operational" if deep_enrich_operational else "partial",
            "services": deep_enrichment_status
        },
        "crm_exports": {
            "status": "operational" if crm_export_operational else "partial",
            "services": crm_export_status
        }
    }


@app.get("/api/v3/phase2/health")
async def phase2_health():
    """
    Detailed health check for Phase 2B services.
    """
    phase2b_operational = all(
        status == "operational" 
        for status in phase2b_status.values()
    )
    
    return {
        "status": "operational" if phase2b_operational else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "services": phase2b_status,
        "endpoints": {
            "icps": {
                "POST /api/v3/icps": "Create ICP",
                "GET /api/v3/icps": "List ICPs",
                "GET /api/v3/icps/{id}": "Get ICP",
                "PUT /api/v3/icps/{id}": "Update ICP",
                "DELETE /api/v3/icps/{id}": "Delete ICP",
                "GET /api/v3/icps/{id}/matches": "Get matching contacts",
                "POST /api/v3/icps/{id}/match": "Bulk match contacts"
            },
            "campaigns": {
                "POST /api/v3/campaigns": "Create campaign",
                "GET /api/v3/campaigns": "List campaigns",
                "GET /api/v3/campaigns/{id}": "Get campaign preview",
                "POST /api/v3/campaigns/{id}/activate": "Activate campaign"
            },
            "templates": {
                "POST /api/v3/templates/preview": "Preview template substitution",
                "GET /api/v3/templates/variables/{contact_id}": "Get available variables"
            },
            "fields": {
                "POST /api/v3/fields/values": "Get field values (debug)"
            }
        }
    }


@app.get("/api/v3/enrichment/health")
async def enrichment_health():
    """
    Detailed health check for enrichment services (quick + deep).
    """
    deep_enrich_operational = (
        deep_enrichment_status["service"] == "operational" and
        deep_enrichment_status["perplexity_key"] == "configured" and
        deep_enrichment_status["openai_key"] == "configured"
    )
    
    return {
        "status": "operational" if deep_enrich_operational else "partial",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "quick_enrichment": {
                "status": "operational",
                "provider": "Perplexity sonar-pro",
                "endpoint": "POST /api/v3/enrichment/quick-enrich/{contact_id}",
                "latency": "50-70ms",
                "quota": "unlimited"
            },
            "deep_enrichment": {
                "status": "operational" if deep_enrich_operational else "not_configured",
                "provider": "Perplexity sonar-pro + GPT-4-turbo",
                "endpoints": [
                    "POST /api/v3/enrichment/deep-enrich/{contact_id}",
                    "GET /api/v3/enrichment/deep-enrich/{contact_id}/status",
                    "GET /api/v3/enrichment/deep-enrich/{contact_id}/result",
                    "GET /api/v3/enrichment/deep-enrich/{contact_id}/debug"
                ],
                "latency": "90-120s (async)",
                "quota": "metered (50/month default)",
                "configuration": deep_enrichment_status
            }
        }
    }


@app.get("/api/v3/export/health")
async def export_health():
    """
    Detailed health check for CRM export services.
    """
    crm_export_operational = all(
        status == "operational"
        for status in crm_export_status.values()
    )
    
    # Check CRM API key configuration
    salesforce_configured = bool(settings.SALESFORCE_CLIENT_ID and settings.SALESFORCE_CLIENT_SECRET)
    pipedrive_configured = bool(settings.PIPEDRIVE_API_KEY)
    
    return {
        "status": "operational" if crm_export_operational else "partial",
        "timestamp": datetime.utcnow().isoformat(),
        "services": crm_export_status,
        "configuration": {
            "salesforce": {
                "client_id": "configured" if settings.SALESFORCE_CLIENT_ID else "missing",
                "client_secret": "configured" if settings.SALESFORCE_CLIENT_SECRET else "missing",
                "ready": salesforce_configured
            },
            "pipedrive": {
                "api_key": "configured" if settings.PIPEDRIVE_API_KEY else "missing",
                "ready": pipedrive_configured
            },
            "csv": {
                "ready": True,  # No external API needed
                "formats": ["google_contacts", "outlook", "generic"]
            }
        },
        "endpoints": {
            "salesforce": {
                "POST /api/v3/export/salesforce": "Export single contact to Salesforce",
                "POST /api/v3/export/salesforce/bulk": "Bulk export contacts to Salesforce",
                "GET /api/v3/export/salesforce/field-mapping": "Get Salesforce field mappings",
                "GET /api/v3/export/salesforce/job/{job_id}/status": "Check bulk export job status"
            },
            "pipedrive": {
                "POST /api/v3/export/pipedrive": "Export single contact to Pipedrive",
                "POST /api/v3/export/pipedrive/bulk": "Bulk export contacts to Pipedrive",
                "GET /api/v3/export/pipedrive/field-mapping": "Get Pipedrive field mappings",
                "GET /api/v3/export/pipedrive/job/{job_id}/status": "Check bulk export job status"
            },
            "csv": {
                "POST /api/v3/export/csv": "Export single contact to CSV",
                "POST /api/v3/export/csv/bulk": "Bulk export contacts to CSV",
                "GET /api/v3/export/csv/formats": "Get available CSV formats"
            }
        }
    }


@app.get("/api/routes")
def list_routes(request: Request):
    return sorted(
        [{"path": r.path, "name": r.name, "methods": sorted(list(r.methods or []))}
         for r in request.app.router.routes],
        key=lambda x: x["path"]
    )


# ============================================================================
# STARTUP / SHUTDOWN EVENTS
# ============================================================================

@app.on_event("startup")
async def startup_event():
    logger.info({"event": "startup", "message": "LatticeIQ API starting up..."})
    
    # Log Phase 2B status
    phase2b_operational = all(status == "operational" for status in phase2b_status.values())
    
    # Log Deep Enrichment status
    deep_enrich_operational = (
        deep_enrichment_status["service"] == "operational" and
        deep_enrichment_status["perplexity_key"] == "configured" and
        deep_enrichment_status["openai_key"] == "configured"
    )
    
    # Log CRM Export status
    crm_export_operational = all(status == "operational" for status in crm_export_status.values())
    
    print("=" * 70)
    print("🚀 LatticeIQ Sales Intelligence API v3.3.0")
    print("=" * 70)
    print("")
    
    print("🎯 Cadence System Status:")
    icon = "✅" if cadence_status == "operational" else "❌"
    print(f"   {icon} cadences: {cadence_status}")
    print("")
    
    print("📦 Phase 2B Services Status:")
    for service, status in phase2b_status.items():
        icon = "✅" if status == "operational" else "❌"
        print(f"   {icon} {service}: {status}")
    print("")
    
    print("📊 Deep Enrichment Status:")
    for service, status in deep_enrichment_status.items():
        if status == "operational" or status == "configured":
            icon = "✅"
        elif status == "missing" or status == "not_configured":
            icon = "⚠️"
        else:
            icon = "❌"
        print(f"   {icon} {service}: {status}")
    print("")
    
    print("📤 CRM Export Status:")
    for service, status in crm_export_status.items():
        icon = "✅" if status == "operational" else "❌"
        print(f"   {icon} {service}: {status}")
    print("")
    
    if cadence_status == "operational":
        print("📅 Cadence Endpoints Available:")
        print("   POST   /api/v3/cadences/start              - Start cadence for contact")
        print("   GET    /api/v3/cadences/{contact_id}       - Get cadence details")
        print("   POST   /api/v3/cadences/{contact_id}/stop  - Stop active cadence")
        print("   POST   /api/v3/cadences/{contact_id}/pause - Pause cadence")
        print("   POST   /api/v3/cadences/{contact_id}/resume - Resume paused cadence")
        print("   POST   /api/v3/cadences/touches/{id}/complete - Complete touch")
        print("   GET    /api/v3/cadences/pending/today      - Today's pending touches")
        print("   GET    /api/v3/cadences/stats              - Cadence statistics")
        print("")
    
    if phase2b_operational:
        print("🎯 Phase 2B Endpoints Available:")
        print("   ICP Management:")
        print("      POST   /api/v3/icps              - Create ICP")
        print("      GET    /api/v3/icps              - List ICPs")
        print("      GET    /api/v3/icps/{id}         - Get ICP details")
        print("      PUT    /api/v3/icps/{id}         - Update ICP")
        print("      DELETE /api/v3/icps/{id}         - Delete ICP")
        print("      GET    /api/v3/icps/{id}/matches - Get matching contacts")
        print("      POST   /api/v3/icps/{id}/match   - Bulk match contacts")
        print("")
        print("   Campaign Management:")
        print("      POST   /api/v3/campaigns              - Create campaign")
        print("      GET    /api/v3/campaigns              - List campaigns")
        print("      GET    /api/v3/campaigns/{id}         - Get campaign preview")
        print("      POST   /api/v3/campaigns/{id}/activate - Activate campaign")
        print("")
        print("   Template Personalization:")
        print("      POST   /api/v3/templates/preview           - Preview substitution")
        print("      GET    /api/v3/templates/variables/{id}    - Available variables")
        print("")
    else:
        print("⚠️  Phase 2B partially loaded - check logs for errors")
        print("")
    
    if deep_enrich_operational:
        print("🧠 Deep Enrichment Endpoints Available:")
        print("   Two-Stage Enrichment (Perplexity + GPT-4):")
        print("      POST   /api/v3/enrichment/deep-enrich/{contact_id}        - Run deep enrichment")
        print("      GET    /api/v3/enrichment/deep-enrich/{contact_id}/status - Check status")
        print("      GET    /api/v3/enrichment/deep-enrich/{contact_id}/result - Get unified result")
        print("      GET    /api/v3/enrichment/deep-enrich/{contact_id}/debug  - Debug payload")
        print("")
        print("   Configuration:")
        print(f"      Perplexity API:  {'✅ Configured' if settings.PERPLEXITY_API_KEY else '❌ Missing PERPLEXITY_API_KEY'}")
        print(f"      OpenAI API:      {'✅ Configured' if settings.OPENAI_API_KEY else '❌ Missing OPENAI_API_KEY'}")
        print("")
    else:
        print("⚠️  Deep Enrichment not fully configured - check .env for API keys")
        print("")
    
    if crm_export_operational:
        print("📤 CRM Export Endpoints Available:")
        print("   Salesforce:")
        print("      POST   /api/v3/export/salesforce                  - Export single contact")
        print("      POST   /api/v3/export/salesforce/bulk             - Bulk export contacts")
        print("      GET    /api/v3/export/salesforce/field-mapping    - Get field mappings")
        print("      GET    /api/v3/export/salesforce/job/{id}/status  - Check job status")
        print("")
        print("   Pipedrive:")
        print("      POST   /api/v3/export/pipedrive                   - Export single contact")
        print("      POST   /api/v3/export/pipedrive/bulk              - Bulk export contacts")
        print("      GET    /api/v3/export/pipedrive/field-mapping     - Get field mappings")
        print("      GET    /api/v3/export/pipedrive/job/{id}/status   - Check job status")
        print("")
        print("   CSV (Google Contacts / Outlook):")
        print("      POST   /api/v3/export/csv                         - Export single contact")
        print("      POST   /api/v3/export/csv/bulk                    - Bulk export contacts")
        print("      GET    /api/v3/export/csv/formats                 - Available formats")
        print("")
        print("   Configuration:")
        print(f"      Salesforce:  {'✅ Configured' if (settings.SALESFORCE_CLIENT_ID and settings.SALESFORCE_CLIENT_SECRET) else '⚠️ Missing credentials'}")
        print(f"      Pipedrive:   {'✅ Configured' if settings.PIPEDRIVE_API_KEY else '⚠️ Missing API key'}")
        print("      CSV Export:  ✅ Ready (no API needed)")
        print("")
    else:
        print("⚠️  CRM Exports partially loaded - check logs for errors")
        print("")
    
    print("=" * 70)
    
    logger.info({
        "event": "startup_complete",
        "version": "3.3.0",
        "cadence_status": cadence_status,
        "phase2b_status": phase2b_status,
        "phase2b_operational": phase2b_operational,
        "deep_enrichment_status": deep_enrichment_status,
        "deep_enrichment_operational": deep_enrich_operational,
        "crm_export_status": crm_export_status,
        "crm_export_operational": crm_export_operational
    })


@app.on_event("shutdown")
async def shutdown_event():
    logger.info({"event": "shutdown", "message": "LatticeIQ API shutting down..."})


# ============================================================================
# ROOT ENDPOINT
# ============================================================================

@app.get("/")
async def root():
    return {
        "name": "LatticeIQ Sales Intelligence API",
        "version": "3.3.0",
        "docs": "/api/docs",
        "status": "running",
        "features": {
            "contacts": "CRUD operations",
            "enrichment": {
                "quick": "AI-powered data enrichment (Perplexity sonar-pro)",
                "deep": "Two-stage enrichment (Perplexity + GPT-4) - metered"
            },
            "scoring": "MDCP/BANT/SPICE frameworks",
            "hubspot": "CRM integration",
            "cadences": "Multi-touch sales sequences with activity tracking",
            "phase2b": {
                "icps": "Ideal Client Profile management",
                "campaigns": "Campaign creation & targeting",
                "templates": "Variable substitution & personalization"
            },
            "exports": {
                "salesforce": "Export contacts to Salesforce CRM",
                "pipedrive": "Export contacts to Pipedrive CRM",
                "csv": "Export to CSV (Google Contacts, Outlook, generic)"
            }
        },
        "health_checks": {
            "basic": "/health",
            "full": "/api/v3/health",
            "phase2b": "/api/v3/phase2/health",
            "enrichment": "/api/v3/enrichment/health",
            "exports": "/api/v3/export/health",
            "cadences": "/api/v3/cadences/health"
        }
    }


# ============================================================================
# PREMIUM FEATURE ROUTERS
# ============================================================================

try:
    from app.routers.ai_writer_router import router as ai_writer_router
    app.include_router(ai_writer_router, prefix="/api/v3")
    print("✅ AI Writer router loaded")
except Exception as e:
    print(f"⚠️ AI Writer router not loaded: {e}")

try:
    from app.routers.smart_lists_router import router as smart_lists_router
    app.include_router(smart_lists_router, prefix="/api/v3")
    print("✅ Smart Lists router loaded")
except Exception as e:
    print(f"⚠️ Smart Lists router not loaded: {e}")

try:
    from app.routers.pipeline_router import router as pipeline_router
    app.include_router(pipeline_router, prefix="/api/v3")
    print("✅ Pipeline router loaded")
except Exception as e:
    print(f"⚠️ Pipeline router not loaded: {e}")

try:
    from app.routers.integrations_router import router as integrations_router
    app.include_router(integrations_router, prefix="/api/v3")
    print("✅ Integrations router loaded")
except Exception as e:
    print(f"⚠️ Integrations router not loaded: {e}")

try:
    from app.routers.import_router import router as import_router
    app.include_router(import_router, prefix="/api/v3")
    print("✅ Import router loaded")
except Exception as e:
    print(f"⚠️ Import router not loaded: {e}")


# ============================================================================
# UVICORN ENTRY POINT (for local development)
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
