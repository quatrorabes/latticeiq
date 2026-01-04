# backend/app/routers/enrichment_v3_deep.py

"""
Deep Enrichment API Endpoints - Extends enrichment_v3 router

Endpoints:
  POST /api/v3/enrichment/deep-enrich/{contact_id} - Queue deep enrichment
  GET  /api/v3/enrichment/deep-enrich/{contact_id}/status - Get job status
  GET  /api/v3/enrichment/quota - Check workspace quota
"""

import os
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Header
from supabase import create_client, Client
import logging

from app.enrichment_v3.deep_enrichment import DeepEnrichmentService

logger = logging.getLogger(__name__)

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

supabase: Optional[Client] = None

try:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("✅ Supabase connected for deep enrichment")
except Exception as e:
    logger.warning(f"⚠️ Supabase connection failed: {e}")

router = APIRouter(
    prefix="/enrichment",
    tags=["Enrichment - Deep"],
)


# Models
from pydantic import BaseModel


class DeepEnrichRequestBody(BaseModel):
    """Request body for deep enrichment"""

    contact_name: str
    company_name: str
    title: str
    email: Optional[str] = None
    linkedin_url: Optional[str] = None


class DeepEnrichResponse(BaseModel):
    """Response for deep enrichment request"""

    success: bool
    job_id: Optional[str] = None
    status: Optional[str] = None
    contact_id: Optional[str] = None


# Endpoints


@router.post("/deep-enrich/{contact_id}")
async def deep_enrich_contact(
    contact_id: str,
    request_body: DeepEnrichRequestBody,
    x_workspace_id: str = Header(None),
):
    """
    Queue a deep enrichment job for a contact.
    
    Two-stage pipeline:
    1. Perplexity sonar-pro: Research & data gathering
    2. GPT-4: Polish into sales-ready dossier
    
    Returns job_id for status polling.
    """
    if not supabase:
        raise HTTPException(
            status_code=503,
            detail="Deep enrichment service unavailable (Supabase not connected)"
        )
    
    if not x_workspace_id:
        raise HTTPException(status_code=401, detail="Missing workspace ID")
    
    try:
        # Initialize service
        service = DeepEnrichmentService(
            supabase_client=supabase,
            perplexity_key=os.getenv("PERPLEXITY_API_KEY"),
            openai_key=os.getenv("OPENAI_API_KEY"),
        )
        
        # Queue enrichment job
        job_id = await service.queue_enrichment(
            contact_id=contact_id,
            contact_name=request_body.contact_name,
            company_name=request_body.company_name,
            title=request_body.title,
            email=request_body.email,
            linkedin_url=request_body.linkedin_url,
            workspace_id=x_workspace_id,
        )
        
        return DeepEnrichResponse(
            success=True,
            job_id=job_id,
            status="queued",
            contact_id=contact_id,
        )
    
    except Exception as e:
        logger.error(f"Error queuing deep enrichment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/deep-enrich/{contact_id}/status")
async def get_enrichment_status(
    contact_id: str,
    x_workspace_id: str = Header(None),
):
    """Get status of a deep enrichment job."""
    if not supabase:
        raise HTTPException(
            status_code=503,
            detail="Deep enrichment service unavailable"
        )
    
    if not x_workspace_id:
        raise HTTPException(status_code=401, detail="Missing workspace ID")
    
    try:
        # Query job status
        result = supabase.table("enrichment_jobs").select("*").eq(
            "contact_id", contact_id
        ).eq("workspace_id", x_workspace_id).order("created_at", desc=True).limit(1).execute()
        
        if result.data:
            job = result.data[0]
            return {
                "success": True,
                "job_id": job.get("id"),
                "status": job.get("status"),
                "progress": job.get("progress", 0),
                "result": job.get("result"),
            }
        else:
            return {
                "success": False,
                "status": "not_found",
                "message": "No enrichment job found for this contact",
            }
    
    except Exception as e:
        logger.error(f"Error fetching enrichment status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quota")
async def get_quota(x_workspace_id: str = Header(None)):
    """Check workspace enrichment quota."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Service unavailable")
    
    if not x_workspace_id:
        raise HTTPException(status_code=401, detail="Missing workspace ID")
    
    try:
        # Query quota
        result = supabase.table("enrichment_quota").select("*").eq(
            "workspace_id", x_workspace_id
        ).execute()
        
        if result.data:
            quota = result.data[0]
            return {
                "success": True,
                "monthly_limit": quota.get("monthly_limit", 50),
                "used": quota.get("used", 0),
                "remaining": quota.get("monthly_limit", 50) - quota.get("used", 0),
            }
        else:
            # Default quota
            return {
                "success": True,
                "monthly_limit": 50,
                "used": 0,
                "remaining": 50,
            }
    
    except Exception as e:
        logger.error(f"Error fetching quota: {e}")
        raise HTTPException(status_code=500, detail=str(e))
