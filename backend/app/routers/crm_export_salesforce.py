# backend/app/routers/crm_export_salesforce.py
"""
Salesforce CRM Export Router
Export LatticeIQ contacts to Salesforce as Leads or Contacts
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging
import uuid
import os
from datetime import datetime
from supabase import create_client, Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export/salesforce", tags=["crm-export", "salesforce"])

# Supabase client
def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(url, key)

# Field mapping: LatticeIQ -> Salesforce Lead
SALESFORCE_LEAD_MAPPING = {
    "first_name": "FirstName",
    "last_name": "LastName",
    "email": "Email",
    "phone": "Phone",
    "mobile_phone": "MobilePhone",
    "company": "Company",
    "title": "Title",
    "website": "Website",
    "street_address": "Street",
    "city": "City",
    "state": "State",
    "postal_code": "PostalCode",
    "country": "Country",
    "industry": "Industry",
    "employee_count": "NumberOfEmployees",
    "annual_revenue": "AnnualRevenue",
    "lead_status": "Status",
    "notes": "Description",
    "linkedin_url": "LinkedIn_URL__c",
}

# Request models
class SalesforceExportRequest(BaseModel):
    contact_id: str = Field(..., description="LatticeIQ contact UUID")
    object_type: str = Field(default="Lead", description="Salesforce object: Lead or Contact")
    include_enrichment: bool = Field(default=True)
    include_scores: bool = Field(default=True)
    custom_mapping: Optional[Dict[str, str]] = None

class SalesforceBulkExportRequest(BaseModel):
    contact_ids: List[str] = Field(..., max_length=1000)
    object_type: str = Field(default="Lead")
    include_enrichment: bool = Field(default=True)
    include_scores: bool = Field(default=True)

# Response models
class SalesforceExportResult(BaseModel):
    contact_id: str
    salesforce_id: Optional[str] = None
    status: str
    error: Optional[str] = None

class SalesforceExportResponse(BaseModel):
    success: bool
    message: str
    salesforce_id: Optional[str] = None
    mapped_fields: int = 0

class SalesforceBulkExportResponse(BaseModel):
    success: bool
    message: str
    job_id: str
    total: int
    queued: int

def map_contact_to_salesforce(contact: Dict[str, Any], object_type: str = "Lead") -> Dict[str, Any]:
    """Map LatticeIQ contact to Salesforce Lead/Contact format"""
    sf_record = {}
    mapping = SALESFORCE_LEAD_MAPPING
    
    for our_field, sf_field in mapping.items():
        value = contact.get(our_field)
        if value:
            sf_record[sf_field] = value
    
    # Add enrichment data as custom fields
    enrichment = contact.get("enrichment_data") or {}
    if enrichment:
        if enrichment.get("company_description"):
            sf_record["Description"] = enrichment.get("company_description", "")[:32000]
    
    # Add scores
    if contact.get("mdcp_score"):
        sf_record["MDCP_Score__c"] = contact.get("mdcp_score")
    if contact.get("bant_score"):
        sf_record["BANT_Score__c"] = contact.get("bant_score")
    if contact.get("composite_score"):
        sf_record["LatticeIQ_Score__c"] = contact.get("composite_score")
    
    return sf_record

@router.get("/health")
async def salesforce_export_health():
    return {
        "status": "ok",
        "service": "salesforce_export",
        "version": "1.0",
        "note": "Requires Salesforce OAuth credentials in environment"
    }

@router.get("/field-mapping")
async def get_salesforce_field_mapping():
    """Get LatticeIQ to Salesforce field mapping"""
    return {
        "lead_mapping": SALESFORCE_LEAD_MAPPING,
        "custom_fields": ["LinkedIn_URL__c", "MDCP_Score__c", "BANT_Score__c", "LatticeIQ_Score__c"],
        "supported_objects": ["Lead", "Contact"]
    }

@router.post("/", response_model=SalesforceExportResponse)
async def export_to_salesforce(request: SalesforceExportRequest):
    """Export single contact to Salesforce"""
    try:
        supabase = get_supabase()
        
        result = supabase.table("contacts").select("*").eq("id", request.contact_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact = result.data[0]
        sf_record = map_contact_to_salesforce(contact, request.object_type)
        
        # Log export (actual Salesforce API call would go here)
        logger.info(f"Mapped contact {request.contact_id} to Salesforce {request.object_type}")
        
        # Update contact with export timestamp
        supabase.table("contacts").update({
            "last_exported_at": datetime.utcnow().isoformat(),
            "export_history": contact.get("export_history", []) + [{
                "platform": "salesforce",
                "object_type": request.object_type,
                "exported_at": datetime.utcnow().isoformat(),
                "status": "mapped"
            }]
        }).eq("id", request.contact_id).execute()
        
        return SalesforceExportResponse(
            success=True,
            message=f"Contact mapped for Salesforce {request.object_type}. Connect Salesforce OAuth to complete export.",
            salesforce_id=None,
            mapped_fields=len(sf_record)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Salesforce export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk", response_model=SalesforceBulkExportResponse)
async def bulk_export_to_salesforce(request: SalesforceBulkExportRequest):
    """Queue bulk export to Salesforce"""
    try:
        supabase = get_supabase()
        job_id = str(uuid.uuid4())
        
        # Create export job record
        supabase.table("crm_export_jobs").insert({
            "id": job_id,
            "platform": "salesforce",
            "status": "pending",
            "contact_ids": request.contact_ids,
            "total_contacts": len(request.contact_ids),
            "options": {
                "object_type": request.object_type,
                "include_enrichment": request.include_enrichment,
                "include_scores": request.include_scores
            }
        }).execute()
        
        return SalesforceBulkExportResponse(
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
async def get_salesforce_job_status(job_id: str):
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
            "failed": job.get("failed_exports", 0),
            "created_at": job.get("created_at"),
            "completed_at": job.get("completed_at")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

logger.info("Salesforce Export router loaded")
