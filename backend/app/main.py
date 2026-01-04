# backend/app/main.py

"""
LatticeIQ Sales Intelligence API
Enterprise-grade FastAPI application for lead scoring and enrichment


Version 3.1.0 - Phase 2B Integration + Deep Enrichment
- Added ICP management endpoints
- Added Campaign creation endpoints
- Added Template preview endpoints
- Added FieldAccessor, ICPMatcher, VariableSubstitutor, CampaignBuilder
- Added Deep Enrichment service (Perplexity + GPT-4 two-stage pipeline)
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
    version="3.1.0",  # Updated for Phase 2B + Deep Enrichment
    description="Enterprise sales enrichment and lead scoring platform with ICP targeting, campaign management, and two-stage deep enrichment",
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
    Used by Phase 2B and Deep Enrichment routers.
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


# Enrichment Router (Quick Enrichment)
try:
    from app.enrichment_v3.enrich_simple import router as simple_enrich_router
    app.include_router(simple_enrich_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "enrich_simple"})
except Exception as e:
    logger.warning({"event": "router_import_failed", "router": "enrich_simple", "error": str(e)})


# Deep Enrichment Router (NEW - Perplexity + GPT-4)
try:
    from app.routers.enrichment_v3_deep import router as deep_enrich_router
    app.include_router(deep_enrich_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "enrichment_deep", "endpoints": [
        "POST /api/v3/enrichment/deep-enrich/{contact_id}",
        "GET /api/v3/enrichment/deep-enrich/{contact_id}/status",
        "GET /api/v3/enrichment/quota"
    ]})
    print("✅ Deep Enrichment router loaded (Perplexity + GPT-4)")
except Exception as e:
    logger.warning({"event": "router_import_failed", "router": "enrichment_deep", "error": str(e)})
    print(f"⚠️ Deep Enrichment router not loaded: {e}")


# Scoring Router
try:
    from app.scoring.router import router as scoring_router
    app.include_router(scoring_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "scoring"})
except Exception as e:
    logger.warning({"event": "router_import_failed", "router": "scoring", "error": str(e)})



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
    from app.enrichment.deep_enrichment import DeepEnrichmentService
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
    
    return {
        "status": "ok",
        "version": "3.1.0",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status,
        "hubspot": "available",
        "phase2b": {
            "status": "operational" if phase2b_operational else "partial",
            "services": phase2b_status
        },
        "deep_enrichment": {
            "status": "operational" if deep_enrich_operational else "partial",
            "services": deep_enrichment_status
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
                    "GET /api/v3/enrichment/quota"
                ],
                "latency": "90-120s (async)",
                "quota": "metered (50/month default)",
                "configuration": deep_enrichment_status
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
    
    print("=" * 70)
    print("🚀 LatticeIQ Sales Intelligence API v3.1.0")
    print("=" * 70)
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
        print("      POST   /api/v3/enrichment/deep-enrich/{contact_id}       - Queue enrichment job")
        print("      GET    /api/v3/enrichment/deep-enrich/{contact_id}/status - Check job status")
        print("      GET    /api/v3/enrichment/quota                           - Check quota usage")
        print("")
        print("   Configuration:")
        print(f"      Perplexity API:  {'✅ Configured' if settings.PERPLEXITY_API_KEY else '❌ Missing PERPLEXITY_API_KEY'}")
        print(f"      OpenAI API:      {'✅ Configured' if settings.OPENAI_API_KEY else '❌ Missing OPENAI_API_KEY'}")
        print("")
    else:
        print("⚠️  Deep Enrichment not fully configured - check .env for API keys")
        print("")
    
    print("=" * 70)
    
    logger.info({
        "event": "startup_complete",
        "version": "3.1.0",
        "phase2b_status": phase2b_status,
        "phase2b_operational": phase2b_operational,
        "deep_enrichment_status": deep_enrichment_status,
        "deep_enrichment_operational": deep_enrich_operational
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
        "version": "3.1.0",
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
            "phase2b": {
                "icps": "Ideal Client Profile management",
                "campaigns": "Campaign creation & targeting",
                "templates": "Variable substitution & personalization"
            }
        },
        "health_checks": {
            "basic": "/health",
            "full": "/api/v3/health",
            "phase2b": "/api/v3/phase2/health",
            "enrichment": "/api/v3/enrichment/health"
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
