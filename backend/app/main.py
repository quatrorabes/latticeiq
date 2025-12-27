import os
import sys
from pathlib import Path
from typing import Optional
from datetime import datetime
import uuid
import logging

# ========================================
# CRITICAL: PYTHON PATH SETUP FOR MONOREPO
# ========================================

app_dir = Path(__file__).parent.resolve()          # .../backend/app
backend_root = app_dir.parent                      # .../backend
project_root = backend_root.parent                 # .../projects/latticeiq

# Ensure backend root is on path (for app.* imports)
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

# Ensure project root is on path (for domains.*, frontend.*, etc.)
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# ========================================
# LOAD ENVIRONMENT VARIABLES
# ========================================

from dotenv import load_dotenv

ENV_PATH = backend_root / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=False)

# ========================================
# IMPORTS (AFTER PATH SETUP & ENV LOAD)
# ========================================

from fastapi import FastAPI, Depends, HTTPException, Header, status, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.exceptions import RequestValidationError

from pydantic import BaseModel, Field
from supabase import create_client, Client
from pythonjsonlogger import jsonlogger

# ========================================
# LOGGING SETUP
# ========================================

logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
logHandler.setFormatter(formatter)

logger = logging.getLogger("latticeiq")
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)

# ========================================
# FASTAPI APP INITIALIZATION
# ========================================

app = FastAPI(
    title="LatticeIQ Sales Intelligence API",
    version="3.0.0",
    description="Enterprise sales enrichment and lead scoring platform",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url="/api/redoc",
)

# ========================================
# MIDDLEWARE
# ========================================

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================================
# SUPABASE INITIALIZATION
# ========================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment")
    sys.exit(1)

supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
logger.info("✅ Supabase initialized successfully")

# ========================================
# DEPENDENCY INJECTION
# ========================================

def get_supabase() -> Client:
    return supabase_client

# ========================================
# ROUTER IMPORTS (CORRECTED PATHS)
# ========================================

routers_to_register = []

# Contacts Router
try:
    from app.contacts_router import router as contacts_router
    routers_to_register.append(("contacts", contacts_router, "/api/v3/contacts"))
    logger.info("✅ Contacts router imported")
except ImportError as e:
    logger.error(f"❌ Contacts router import failed: {e}")

# CRM Settings Router
try:
    from app.crm.settings_router import router as settings_router
    routers_to_register.append(("settings", settings_router, "/api/v3/settings"))
    logger.info("✅ CRM Settings router imported")
except ImportError as e:
    logger.error(f"❌ CRM Settings router import failed: {e}")
    
# CRM Import Router
try:
    from app.crm.router import router as crm_router
    routers_to_register.append(("crm", crm_router, "/api/v3/import"))
    logger.info("✅ CRM router imported")
except ImportError as e:
    logger.error(f"❌ CRM router import failed: {e}")
    

# Quick Enrichment Router
try:
    from app.enrichment_v3.enrich_router import router as enrichment_router
    routers_to_register.append(("enrichment", enrichment_router, "/api/v3/enrich"))
    logger.info("✅ Quick Enrichment router imported")
except ImportError as e:
    logger.error(f"❌ Quick Enrichment router import failed: {e}")

# Scoring Router
try:
    from app.scoring.router import router as scoring_router
    routers_to_register.append(("scoring", scoring_router, "/api/v3/score"))
    logger.info("✅ Scoring router imported")
except ImportError as e:
    logger.error(f"❌ Scoring router import failed: {e}")

# ICP Router (domains/ doesn't exist yet, so this will fail gracefully)
try:
    from domains.icp.router import router as icp_router
    routers_to_register.append(("icp", icp_router, "/api/v3/icp"))
    logger.info("✅ ICP router imported")
except ImportError as e:
    logger.warning(f"⏭️  ICP router not available (domains/ not deployed yet): {e}")

# ========================================
# REGISTER ROUTERS
# ========================================

for router_name, router, prefix in routers_to_register:
    app.include_router(router, prefix=prefix)
    logger.info(f"✅ {router_name.capitalize()} router registered at {prefix}")

# ========================================
# HEALTH CHECK ENDPOINT
# ========================================

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "LatticeIQ Backend API",
        "version": "3.0.0",
    }

# ========================================
# ROOT ENDPOINT
# ========================================

@app.get("/")
async def root():
    return {
        "message": "LatticeIQ Sales Intelligence API",
        "docs": "/api/docs",
        "version": "3.0.0",
    }

# ========================================
# EXCEPTION HANDLERS
# ========================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "body": exc.body,
        },
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
        },
    )

# ========================================
# STARTUP / SHUTDOWN HOOKS
# ========================================

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 LatticeIQ Backend API starting up...")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 LatticeIQ Backend API shutting down...")

# ========================================
# RUN (for local development only)
# ========================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
    