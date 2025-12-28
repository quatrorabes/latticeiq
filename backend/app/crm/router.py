# ============================================================================
# FILE: backend/app/crm/router.py
# PURPOSE: CRM Import - HubSpot, Salesforce, Pipedrive CSV/API imports
# ============================================================================

import os
import csv
import io
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File
from pydantic import BaseModel
from supabase import create_client
import httpx

logger = logging.getLogger("latticeiq")

# ============================================================================
# LAZY LOAD SUPABASE CLIENTS
# ============================================================================

_supabase_anon = None
_supabase_service = None

def get_supabase_anon():
    """Lazy initialize anon client"""
    global _supabase_anon
    if _supabase_anon is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        if url and key:
            _supabase_anon = create_client(url, key)
    return _supabase_anon

def get_supabase_service():
    """Lazy initialize service role client"""
    global _supabase_service
    if _supabase_service is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        if url and key:
            _supabase_service = create_client(url, key)
    return _supabase_service

# ============================================================================
# AUTH DEPENDENCY
# ============================================================================

async def get_current_user(authorization: str = Header(None)) -> dict:
    """Validate Supabase JWT"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")

        client = get_supabase_anon()
        if not client:
            raise HTTPException(status_code=503, detail="Database not configured")

        user_resp = client.auth.get_user(token)
        user = getattr(user_resp, "user", None) or user_resp.get("user") if isinstance(user_resp, dict) else None

        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = getattr(user, "id", None) or user.get("id")
        email = getattr(user, "email", None) or user.get("email") or ""

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user id")

        return {"id": str(user_id), "email": str(email)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ============================================================================
# MODELS
# ============================================================================

class ImportJobCreate(BaseModel):
    crmtype: str  # hubspot, salesforce, pipedrive
    importtype: str  # api, csv
    filename: Optional[str] = None

class ContactData(BaseModel):
    firstname: str
    lastname: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    jobtitle: Optional[str] = None
    linkedinurl: Optional[str] = None

# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(prefix="/import", tags=["Import"])

# Helper: Get credentials from settings
async def get_crm_credentials(user_id: str, crm_type: str) -> Optional[Dict]:
    """Get CRM API credentials for user"""
    service = get_supabase_service()
    if not service:
        return None
    
    try:
        result = service.table("crmintegrations").select("*").eq("userid", user_id).eq("crmtype", crm_type.lower()).single().execute()
        return result.data if result.data else None
    except Exception as e:
        logger.error(f"Error getting CRM credentials: {str(e)}")
        return None

# Helper: Save contact to database
async def save_contact(user_id: str, contact_data: Dict[str, Any], import_job_id: Optional[str] = None) -> Optional[str]:
    """Save a contact to the database"""
    service = get_supabase_service()
    if not service:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    try:
        contact = {
            "userid": user_id,
            "firstname": contact_data.get("firstname", ""),
            "lastname": contact_data.get("lastname", ""),
            "email": contact_data.get("email", ""),
            "phone": contact_data.get("phone"),
            "company": contact_data.get("company"),
            "jobtitle": contact_data.get("jobtitle"),
            "linkedinurl": contact_data.get("linkedinurl"),
            "enrichmentstatus": "pending",
            "createdat": datetime.utcnow().isoformat(),
            "updatedat": datetime.utcnow().isoformat(),
        }
        
        result = service.table("contacts").insert(contact).execute()
        return result.data[0]["id"] if result.data else None
    except Exception as e:
        logger.error(f"Error saving contact: {str(e)}")
        return None

# GET /api/v3/import/jobs - List import jobs
@router.get("/jobs")
async def list_import_jobs(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """List all import jobs for current user"""
    service = get_supabase_service()
    if not service:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]
        result = service.table("importjobs").select("*").eq("userid", user_id).order("createdat", desc=True).execute()
        
        return {
            "jobs": result.data or [],
            "total": len(result.data or []),
        }
    except Exception as e:
        logger.error(f"Error listing import jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# GET /api/v3/import/jobs/{job_id} - Get import job details
@router.get("/jobs/{job_id}")
async def get_import_job(job_id: str, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Get import job details"""
    service = get_supabase_service()
    if not service:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]
        result = service.table("importjobs").select("*").eq("id", job_id).eq("userid", user_id).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        # Get logs for this job
        logs_result = service.table("importlogs").select("*").eq("importjobid", job_id).execute()
        
        return {
            "job": result.data,
            "logs": logs_result.data or [],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting import job: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# POST /api/v3/import/csv - Import contacts from CSV
@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Import contacts from CSV file"""
    service = get_supabase_service()
    if not service:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]
        
        # Create import job
        job_data = {
            "userid": user_id,
            "crmtype": "csv",
            "importtype": "csv",
            "filename": file.filename,
            "status": "processing",
            "totalcontacts": 0,
            "importedcontacts": 0,
            "failedcontacts": 0,
            "createdat": datetime.utcnow().isoformat(),
        }
        job_result = service.table("importjobs").insert(job_data).execute()
        job_id = job_result.data[0]["id"] if job_result.data else None
        
        # Parse CSV
        contents = await file.read()
        csv_file = io.StringIO(contents.decode("utf-8"))
        reader = csv.DictReader(csv_file)
        
        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail="CSV file is empty")
        
        imported_count = 0
        failed_count = 0
        
        for row_num, row in enumerate(reader, start=2):  # Start at 2 (after header)
            try:
                # Map CSV columns to contact fields
                contact = {
                    "firstname": row.get("first_name") or row.get("firstname") or "",
                    "lastname": row.get("last_name") or row.get("lastname") or "",
                    "email": row.get("email") or "",
                    "phone": row.get("phone"),
                    "company": row.get("company"),
                    "jobtitle": row.get("job_title") or row.get("jobtitle"),
                    "linkedinurl": row.get("linkedin_url") or row.get("linkedinurl"),
                }
                
                if not contact["email"] or not contact["firstname"] or not contact["lastname"]:
                    failed_count += 1
                    if job_id:
                        service.table("importlogs").insert({
                            "importjobid": job_id,
                            "rownum": row_num,
                            "status": "skipped",
                            "message": "Missing required fields (email, firstname, lastname)",
                        }).execute()
                    continue
                
                # Save contact
                contact_id = await save_contact(user_id, contact, job_id)
                if contact_id:
                    imported_count += 1
                    if job_id:
                        service.table("importlogs").insert({
                            "importjobid": job_id,
                            "rownum": row_num,
                            "status": "success",
                            "contactid": contact_id,
                        }).execute()
                else:
                    failed_count += 1
                    if job_id:
                        service.table("importlogs").insert({
                            "importjobid": job_id,
                            "rownum": row_num,
                            "status": "failed",
                            "message": "Error saving contact",
                        }).execute()
            
            except Exception as e:
                failed_count += 1
                logger.error(f"Error importing row {row_num}: {str(e)}")
                if job_id:
                    service.table("importlogs").insert({
                        "importjobid": job_id,
                        "rownum": row_num,
                        "status": "error",
                        "message": str(e),
                    }).execute()
        
        # Update job status
        if job_id:
            service.table("importjobs").update({
                "status": "completed",
                "totalcontacts": imported_count + failed_count,
                "importedcontacts": imported_count,
                "failedcontacts": failed_count,
            }).eq("id", job_id).execute()
        
        logger.info(f"CSV import completed: {imported_count} imported, {failed_count} failed", extra={"userid": user_id})
        
        return {
            "job_id": job_id,
            "status": "completed",
            "totalcontacts": imported_count + failed_count,
            "importedcontacts": imported_count,
            "failedcontacts": failed_count,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# POST /api/v3/import/hubspot - Import from HubSpot API
@router.post("/hubspot")
async def import_hubspot(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Import contacts from HubSpot"""
    service = get_supabase_service()
    if not service:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]
        
        # Get HubSpot credentials
        creds = await get_crm_credentials(user_id, "hubspot")
        if not creds or not creds.get("apikey"):
            raise HTTPException(status_code=400, detail="HubSpot API key not configured")
        
        # Create import job
        job_data = {
            "userid": user_id,
            "crmtype": "hubspot",
            "importtype": "api",
            "status": "processing",
            "totalcontacts": 0,
            "importedcontacts": 0,
            "failedcontacts": 0,
            "createdat": datetime.utcnow().isoformat(),
        }
        job_result = service.table("importjobs").insert(job_data).execute()
        job_id = job_result.data[0]["id"] if job_result.data else None
        
        # Fetch from HubSpot
        imported_count = 0
        failed_count = 0
        after = None
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            while True:
                params = {"limit": 100}
                if after:
                    params["after"] = after
                
                response = await http_client.get(
                    "https://api.hubapi.com/crm/v3/objects/contacts",
                    headers={"Authorization": f"Bearer {creds['apikey']}"},
                    params=params,
                )
                
                if response.status_code != 200:
                    raise HTTPException(status_code=response.status_code, detail="HubSpot API error")
                
                data = response.json()
                contacts = data.get("results", [])
                
                if not contacts:
                    break
                
                for contact in contacts:
                    try:
                        props = contact.get("properties", {})
                        contact_data = {
                            "firstname": props.get("firstname", {}).get("value") or "",
                            "lastname": props.get("lastname", {}).get("value") or "",
                            "email": props.get("email", {}).get("value") or "",
                            "phone": props.get("phone", {}).get("value"),
                            "company": props.get("company", {}).get("value"),
                            "jobtitle": props.get("jobtitle", {}).get("value"),
                            "linkedinurl": props.get("linkedinurl", {}).get("value"),
                        }
                        
                        if contact_data["email"] and contact_data["firstname"]:
                            contact_id = await save_contact(user_id, contact_data, job_id)
                            if contact_id:
                                imported_count += 1
                            else:
                                failed_count += 1
                        else:
                            failed_count += 1
                    
                    except Exception as e:
                        failed_count += 1
                        logger.error(f"Error importing HubSpot contact: {str(e)}")
                
                # Check for pagination
                paging = data.get("paging", {})
                after = paging.get("next", {}).get("after")
                if not after:
                    break
        
        # Update job status
        if job_id:
            service.table("importjobs").update({
                "status": "completed",
                "totalcontacts": imported_count + failed_count,
                "importedcontacts": imported_count,
                "failedcontacts": failed_count,
            }).eq("id", job_id).execute()
        
        logger.info(f"HubSpot import completed: {imported_count} imported", extra={"userid": user_id})
        
        return {
            "job_id": job_id,
            "status": "completed",
            "importedcontacts": imported_count,
            "failedcontacts": failed_count,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing from HubSpot: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# POST /api/v3/import/salesforce - Import from Salesforce API
@router.post("/salesforce")
async def import_salesforce(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Import contacts from Salesforce"""
    raise HTTPException(status_code=501, detail="Salesforce import not yet implemented")

# POST /api/v3/import/pipedrive - Import from Pipedrive API
@router.post("/pipedrive")
async def import_pipedrive(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Import contacts from Pipedrive"""
    raise HTTPException(status_code=501, detail="Pipedrive import not yet implemented")

# ============================================================================
# EXPORTS
# ============================================================================
__all__ = ["router", "get_supabase_anon", "get_supabase_service"]
