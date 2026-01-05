# backend/app/routers/crm_export_pipedrive.py
"""
Pipedrive CRM Export Router
Export LatticeIQ contacts to Pipedrive as Persons or Deals
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging
import uuid
import os
from datetime import datetime
from supabase import create_client, Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export/pipedrive", tags=["crm-export", "pipedrive"])

def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(url, key)

# Field mapping: LatticeIQ -> Pipedrive Person
PIPEDRIVE_PERSON_MAPPING = {
    "first_name": "first_name",
    "last_name": "last_name",
    "email": "email",
    "phone": "phone",
    "company": "org_name",
    "title": "job_title",
    "linkedin_url": "linkedin",
}

class PipedriveExportRequest(BaseModel):
    contact_id: str
    object_type: str = Field(default="person", description="person or deal")
    include_enrichment: bool = True
    include_scores: bool = True

class PipedriveBulkExportRequest(BaseModel):
    contact_ids: List[str] = Field(..., max_length=500)
    object_type: str = Field(default="person")
    include_enrichment: bool = True
    include_scores: bool = True

class PipedriveExportResponse(BaseModel):
    success: bool
    message: str
    pipedrive_id: Optional[str] = None
    mapped_fields: int = 0

class PipedriveBulkExportResponse(BaseModel):
    success: bool
    message: str
    job_id: str
    total: int
    queued: int

def map_contact_to_pipedrive(contact: Dict[str, Any]) -> Dict[str, Any]:
    """Map LatticeIQ contact to Pipedrive Person format"""
    pd_record = {}
    
    # Build name
    first = contact.get("first_name", "")
    last = contact.get("last_name", "")
    pd_record["name"] = f"{first} {last}".strip() or "Unknown"
    
    # Email as array
    if contact.get("email"):
        pd_record["email"] = [{"value": contact["email"], "primary": True}]
    
    # Phone as array
    if contact.get("phone"):
        pd_record["phone"] = [{"value": contact["phone"], "primary": True}]
    
    # Direct mappings
    for our_field, pd_field in PIPEDRIVE_PERSON_MAPPING.items():
        if our_field not in ["email", "phone", "first_name", "last_name"]:
            value = contact.get(our_field)
            if value:
                pd_record[pd_field] = value
    
    return pd_record

@router.get("/health")
async def pipedrive_export_health():
    return {
        "status": "ok",
        "service": "pipedrive_export",
        "version": "1.0",
        "note": "Requires PIPEDRIVE_API_KEY in environment"
    }

@router.get("/field-mapping")
async def get_pipedrive_field_mapping():
    return {
        "person_mapping": PIPEDRIVE_PERSON_MAPPING,
        "supported_objects": ["person", "deal", "organization"]
    }

@router.post("/", response_model=PipedriveExportResponse)
async def export_to_pipedrive(request: PipedriveExportRequest):
    """Export single contact to Pipedrive"""
    try:
        supabase = get_supabase()
        
        result = supabase.table("contacts").select("*").eq("id", request.contact_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact = result.data[0]
        pd_record = map_contact_to_pipedrive(contact)
        
        logger.info(f"Mapped contact {request.contact_id} to Pipedrive {request.object_type}")
        
        # Update export history
        supabase.table("contacts").update({
            "last_exported_at": datetime.utcnow().isoformat(),
            "export_history": contact.get("export_history", []) + [{
                "platform": "pipedrive",
                "object_type": request.object_type,
                "exported_at": datetime.utcnow().isoformat(),
                "status": "mapped"
            }]
        }).eq("id", request.contact_id).execute()
        
        return PipedriveExportResponse(
            success=True,
            message=f"Contact mapped for Pipedrive. Set PIPEDRIVE_API_KEY to complete export.",
            mapped_fields=len(pd_record)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pipedrive export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk", response_model=PipedriveBulkExportResponse)
async def bulk_export_to_pipedrive(request: PipedriveBulkExportRequest):
    """Queue bulk export to Pipedrive"""
    try:
        supabase = get_supabase()
        job_id = str(uuid.uuid4())
        
        supabase.table("crm_export_jobs").insert({
            "id": job_id,
            "platform": "pipedrive",
            "status": "pending",
            "contact_ids": request.contact_ids,
            "total_contacts": len(request.contact_ids),
            "options": {
                "object_type": request.object_type,
                "include_enrichment": request.include_enrichment,
                "include_scores": request.include_scores
            }
        }).execute()
        
        return PipedriveBulkExportResponse(
            success=True,
            message="Bulk export job queued",
            job_id=job_id,
            total=len(request.contact_ids),
            queued=len(request.contact_ids)
        )
    except Exception as e:
        logger.error(f"Bulk export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/job/{job_id}/status")
async def get_pipedrive_job_status(job_id: str):
    """Check bulk export job status"""
    try:
        supabase = get_supabase()
        result = supabase.table("crm_export_jobs").select("*").eq("id", job_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Job not found")
        
        job = result.data[0]
        return {
            "job_id": job_id,
            "status": job.get("status"),
            "total": job.get("total_contacts"),
            "processed": job.get("processed_contacts", 0),
            "successful": job.get("successful_exports", 0),
            "failed": job.get("failed_exports", 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

logger.info("Pipedrive Export router loaded")
