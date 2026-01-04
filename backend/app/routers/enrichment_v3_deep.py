# backend/app/routers/enrichment_v3_deep.py

"""
Deep Enrichment API Endpoints - Extends enrichment_v3 router

Endpoints:
  POST /api/v3/enrichment/deep-enrich/{contact_id} - Queue deep enrichment
  GET  /api/v3/enrichment/deep-enrich/{contact_id}/status - Get job status
  GET  /api/v3/enrichment/quota - Check workspace quota
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Header
import logging

from app.database import get_supabase_client
from app.auth import get_current_user
from app.enrichment.deep_enrichment import DeepEnrichmentService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v3/enrichment",
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
    error: Optional[str] = None
    quota_check: Optional[dict] = None


class JobStatusResponse(BaseModel):
    """Response for job status check"""

    success: bool
    job_id: Optional[str] = None
    status: Optional[str] = None
    contact_id: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None


class QuotaResponse(BaseModel):
    """Response for quota check"""

    success: bool
    quota_monthly: int
    used_this_month: int
    remaining: int
    exhausted: bool
    error: Optional[str] = None


# Endpoints


@router.post("/deep-enrich/{contact_id}", response_model=DeepEnrichResponse)
async def request_deep_enrichment(
    contact_id: UUID,
    body: DeepEnrichRequestBody,
    authorization: str = Header(None),
    supabase=Depends(get_supabase_client),
):
    """
    Queue a deep enrichment job for a contact.

    Returns job_id for status polling.
    Requires valid JWT token.
    """
    try:
        # Validate contact exists and belongs to user's workspace
        contact_response = (
            supabase.table("contacts")
            .select("id, firstname, lastname, company")
            .eq("id", str(contact_id))
            .single()
            .execute()
        )

        if not contact_response.data:
            raise HTTPException(status_code=404, detail="Contact not found")

        contact = contact_response.data

        # Check quota
        service = DeepEnrichmentService(supabase)
        
        # Extract workspace_id from JWT or use default
        # In production, extract from JWT token
        workspace_id = UUID("11111111-1111-1111-1111-111111111111")  # TODO: extract from JWT

        quota_check = service.check_quota(workspace_id)

        if not quota_check["success"]:
            raise HTTPException(
                status_code=500, detail="Failed to check quota"
            )

        if quota_check["exhausted"]:
            raise HTTPException(
                status_code=429,
                detail=f"Deep enrichment quota exhausted. Monthly limit: {quota_check['quota_monthly']}",
            )

        # Queue enrichment job
        job_result = service.enrich_contact_async(
            workspace_id=workspace_id,
            contact_id=contact_id,
            contact_name=body.contact_name,
            company_name=body.company_name,
            title=body.title,
            email=body.email,
            linkedin_url=body.linkedin_url,
        )

        if not job_result["success"]:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to queue enrichment: {job_result.get('error')}",
            )

        logger.info(f"Deep enrichment queued for contact {contact_id}")

        return DeepEnrichResponse(
            success=True,
            job_id=job_result["job_id"],
            status="pending",
            contact_id=str(contact_id),
            quota_check={
                "used": quota_check["used_this_month"] + 1,
                "remaining": quota_check["remaining"] - 1,
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Deep enrichment request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/deep-enrich/{contact_id}/status", response_model=JobStatusResponse)
async def get_deep_enrichment_status(
    contact_id: UUID,
    authorization: str = Header(None),
    supabase=Depends(get_supabase_client),
):
    """
    Get status of most recent deep enrichment job for a contact.

    Statuses: pending, processing, completed, failed
    """
    try:
        # Get most recent job for contact
        response = (
            supabase.table("enrichment_deep_jobs")
            .select("*")
            .eq("contact_id", str(contact_id))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail="No enrichment jobs found for this contact")

        job = response.data[0]

        return JobStatusResponse(
            success=True,
            job_id=job["id"],
            status=job["status"],
            contact_id=str(job["contact_id"]),
            created_at=job["created_at"],
            completed_at=job.get("completed_at"),
            error=job.get("error_message"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quota", response_model=QuotaResponse)
async def check_quota(
    authorization: str = Header(None),
    supabase=Depends(get_supabase_client),
):
    """
    Check deep enrichment quota for authenticated user's workspace.

    Returns current usage and remaining quota.
    """
    try:
        # Extract workspace_id from JWT
        # TODO: implement proper JWT extraction
        workspace_id = UUID("11111111-1111-1111-1111-111111111111")

        service = DeepEnrichmentService(supabase)
        quota = service.check_quota(workspace_id)

        if not quota["success"]:
            raise HTTPException(status_code=500, detail="Failed to check quota")

        return QuotaResponse(
            success=True,
            quota_monthly=quota["quota_monthly"],
            used_this_month=quota["used_this_month"],
            remaining=quota["remaining"],
            exhausted=quota["exhausted"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Quota check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
