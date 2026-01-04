# backend/app/routers/enrichment_v3_deep.py

"""
Deep Enrichment API Endpoints - Extends enrichment_v3 router
"""

import os
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Header
from supabase import create_client, Client
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

supabase: Optional[Client] = None
supabase_error: Optional[str] = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("✅ Supabase connected for deep enrichment")
    except Exception as e:
        supabase_error = str(e)
        logger.error(f"❌ Supabase connection failed: {e}")
else:
    supabase_error = "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY"
    logger.error(f"❌ {supabase_error}")

router = APIRouter(
    prefix="/enrichment",
    tags=["Enrichment - Deep"],
)


class DeepEnrichRequestBody(BaseModel):
    contact_name: str
    company_name: str
    title: str
    email: Optional[str] = None
    linkedin_url: Optional[str] = None


@router.post("/deep-enrich/{contact_id}")
async def deep_enrich_contact(
    contact_id: str,
    request_body: DeepEnrichRequestBody,
    x_workspace_id: str = Header(None),
):
    """Queue a deep enrichment job for a contact."""
    
    if not supabase:
        raise HTTPException(
            status_code=503,
            detail=f"Supabase not connected: {supabase_error}"
        )
    
    if not x_workspace_id:
        raise HTTPException(status_code=401, detail="Missing x-workspace-id header")
    
    # Direct insert - simpler, with error capture
    try:
        job_data = {
            "contact_id": contact_id,
            "workspace_id": x_workspace_id,
            "status": "pending",
        }
        
        logger.info(f"Inserting job: {job_data}")
        
        response = supabase.table("enrichment_deep_jobs").insert(job_data).execute()
        
        logger.info(f"Insert response: {response}")
        
        if response.data and len(response.data) > 0:
            job_id = response.data[0].get("id")
            return {
                "success": True,
                "job_id": job_id,
                "status": "queued",
                "contact_id": contact_id,
            }
        else:
            # No data returned - log it
            logger.error(f"Insert returned no data. Response: {response}")
            return {
                "success": False,
                "job_id": None,
                "status": "failed",
                "contact_id": contact_id,
                "error": "Insert returned no data",
            }
    
    except Exception as e:
        logger.error(f"Deep enrichment error: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/deep-enrich/{contact_id}/status")
async def get_enrichment_status(
    contact_id: str,
    x_workspace_id: str = Header(None),
):
    """Get status of a deep enrichment job."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Service unavailable")
    
    if not x_workspace_id:
        raise HTTPException(status_code=401, detail="Missing x-workspace-id header")
    
    try:
        result = supabase.table("enrichment_deep_jobs").select("*").eq(
            "contact_id", contact_id
        ).eq("workspace_id", x_workspace_id).order("created_at", desc=True).limit(1).execute()
        
        if result.data:
            job = result.data[0]
            return {
                "success": True,
                "job_id": job.get("id"),
                "status": job.get("status"),
                "result": job.get("polished_profile"),
            }
        else:
            return {"success": False, "status": "not_found"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
