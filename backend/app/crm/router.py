# ============================================================================
# FILE: backend/app/crm/router.py
# ============================================================================
"""CRM import endpoints - v3 API
FIXED: Proper JWT auth that uses settings from Render env vars
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Header
from fastapi.responses import JSONResponse
from uuid import UUID, uuid4
from typing import Optional
from datetime import datetime
import os

from supabase import create_client

# Local module imports (within crm/)
from .models import ImportJob, ImportLog, DNCEntry
from .csv_parser import CSVParser
from .hubspot_client import HubSpotClient
from .salesforce_client import SalesforceClient
from .pipedrive_client import PipedriveClient

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

if SUPABASE_URL and SUPABASE_ANON_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
else:
    supabase = None

router = APIRouter(prefix="/import", tags=["CRM Import"])

# ============================================================================
# AUTH HELPER - Extract user from Bearer token (JWT)
# ============================================================================

async def get_current_user_for_crm(authorization: str = Header(None)) -> dict:
    """
    Extract user from JWT Bearer token.
    Validates token using settings from Render environment.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        # Parse Bearer token
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")
        
        # Import jwt decoder and settings
        from jose import JWTError, jwt
        import os
        
        # Get JWT secret from Render env (matches main.py)
        jwt_secret = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
        jwt_algorithm = "HS256"
        
        # Decode token using Render's JWT_SECRET
        payload = jwt.decode(token, jwt_secret, algorithms=[jwt_algorithm])
        
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        
        if not user_id or not email:
            raise ValueError("Missing required claims (sub, email)")
        
        return {"id": user_id, "email": email}
    
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ============================================================================
# HELPER: Get CRM credentials from crm_integrations table
# ============================================================================

def get_crm_credentials(user_id: str, crm_type: str) -> dict:
    """
    Fetch stored CRM credentials from crm_integrations table.
    User configures these in Settings page.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    result = (supabase.table("crm_integrations")
              .select("*")
              .eq("user_id", user_id)
              .eq("crm_type", crm_type)
              .eq("is_active", True)
              .execute())
    
    if not result.data:
        raise HTTPException(
            status_code=400, 
            detail=f"No {crm_type} integration configured. Please add your API key in Settings first."
        )
    
    integration = result.data[0]
    
    if integration.get("test_status") != "success":
        raise HTTPException(
            status_code=400,
            detail=f"Your {crm_type} integration hasn't been tested. Please test the connection in Settings first."
        )
    
    return {
        "api_key": integration.get("api_key"),
        "api_url": integration.get("api_url"),
        "import_filters": integration.get("import_filters", {}),
        "required_fields": integration.get("required_fields", {})
    }

# ============================================================================
# CSV IMPORT ENDPOINT
# ============================================================================

@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    user: dict = Depends(get_current_user_for_crm)
) -> dict:
    """
    Upload CSV and import contacts
    CSV must contain 'email' column. Optional: first_name, last_name, company, job_title, phone, linkedin_url
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    user_id = user["id"]
    
    try:
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="File must be CSV")
        
        content = await file.read()
        
        # Parse CSV
        parser = CSVParser(user_id=user_id)
        contacts, errors = parser.parse(content)
        
        if not contacts:
            raise HTTPException(status_code=400, detail=f"No valid contacts found. Errors: {errors}")
        
        # Create import job
        job_id = uuid4()
        
        supabase.table("import_jobs").insert({
            "id": str(job_id),
            "user_id": user_id,
            "crm_type": "csv",
            "status": "running",
            "total_contacts": len(contacts),
            "metadata": {"filename": file.filename, "parse_errors": errors}
        }).execute()
        
        # Queue background import
        if background_tasks:
            background_tasks.add_task(
                _process_csv_import,
                job_id=job_id,
                user_id=user_id,
                contacts=contacts
            )
        
        return {
            "job_id": str(job_id),
            "status": "running",
            "total_contacts": len(contacts),
            "message": f"Importing {len(contacts)} contacts. Parse errors: {len(errors)}"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# HUBSPOT IMPORT ENDPOINT
# ============================================================================

@router.post("/hubspot")
async def import_hubspot(
    background_tasks: BackgroundTasks = None,
    user: dict = Depends(get_current_user_for_crm)
) -> dict:
    """
    Import contacts from HubSpot.
    API key is fetched from crm_integrations table (configured in Settings).
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    user_id = user["id"]
    
    try:
        # Get credentials from database (saved in Settings page)
        creds = get_crm_credentials(user_id, "hubspot")
        api_key = creds["api_key"]
        
        if not api_key:
            raise HTTPException(status_code=400, detail="No HubSpot API key configured. Go to Settings to add one.")
        
        client = HubSpotClient(api_key=api_key)
        
        if not client.test_connection():
            raise HTTPException(status_code=401, detail="HubSpot API key is invalid or expired. Update it in Settings.")
        
        # Create import job
        job_id = uuid4()
        
        supabase.table("import_jobs").insert({
            "id": str(job_id),
            "user_id": user_id,
            "crm_type": "hubspot",
            "status": "running",
            "metadata": {"source": "crm_integrations"}
        }).execute()
        
        # Queue background sync
        if background_tasks:
            background_tasks.add_task(
                _process_hubspot_import,
                job_id=job_id,
                user_id=user_id,
                client=client
            )
        
        return {
            "job_id": str(job_id),
            "status": "running",
            "message": "HubSpot sync started"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# SALESFORCE IMPORT ENDPOINT
# ============================================================================

@router.post("/salesforce")
async def import_salesforce(
    background_tasks: BackgroundTasks = None,
    user: dict = Depends(get_current_user_for_crm)
) -> dict:
    """
    Import contacts from Salesforce.
    Credentials fetched from crm_integrations table (configured in Settings).
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    user_id = user["id"]
    
    try:
        # Get credentials from database
        creds = get_crm_credentials(user_id, "salesforce")
        
        # For Salesforce we need more fields - stored in api_key as JSON or separate fields
        api_key = creds["api_key"]
        instance_url = creds.get("api_url", "")
        
        if not api_key or not instance_url:
            raise HTTPException(status_code=400, detail="Salesforce not fully configured. Go to Settings.")
        
        client = SalesforceClient(
            instance_url=instance_url,
            access_token=api_key  # Simplified OAuth
        )
        
        if not client.test_connection():
            raise HTTPException(status_code=401, detail="Salesforce credentials invalid. Update in Settings.")
        
        job_id = uuid4()
        
        supabase.table("import_jobs").insert({
            "id": str(job_id),
            "user_id": user_id,
            "crm_type": "salesforce",
            "status": "running",
            "metadata": {"instance_url": instance_url}
        }).execute()
        
        if background_tasks:
            background_tasks.add_task(
                _process_salesforce_import,
                job_id=job_id,
                user_id=user_id,
                client=client
            )
        
        return {
            "job_id": str(job_id),
            "status": "running",
            "message": "Salesforce sync started"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# PIPEDRIVE IMPORT ENDPOINT
# ============================================================================

@router.post("/pipedrive")
async def import_pipedrive(
    background_tasks: BackgroundTasks = None,
    user: dict = Depends(get_current_user_for_crm)
) -> dict:
    """
    Import contacts from Pipedrive.
    API token fetched from crm_integrations table (configured in Settings).
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    user_id = user["id"]
    
    try:
        # Get credentials from database
        creds = get_crm_credentials(user_id, "pipedrive")
        api_token = creds["api_key"]
        
        if not api_token:
            raise HTTPException(status_code=400, detail="No Pipedrive API token configured. Go to Settings.")
        
        client = PipedriveClient(api_token=api_token)
        
        if not client.test_connection():
            raise HTTPException(status_code=401, detail="Pipedrive API token invalid. Update in Settings.")
        
        job_id = uuid4()
        
        supabase.table("import_jobs").insert({
            "id": str(job_id),
            "user_id": user_id,
            "crm_type": "pipedrive",
            "status": "running"
        }).execute()
        
        if background_tasks:
            background_tasks.add_task(
                _process_pipedrive_import,
                job_id=job_id,
                user_id=user_id,
                client=client
            )
        
        return {
            "job_id": str(job_id),
            "status": "running",
            "message": "Pipedrive sync started"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# IMPORT STATUS ENDPOINT
# ============================================================================

@router.get("/status/{job_id}")
async def get_import_status(
    job_id: UUID,
    user: dict = Depends(get_current_user_for_crm)
) -> dict:
    """Get import job status and progress"""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    user_id = user["id"]
    
    try:
        response = supabase.table("import_jobs").select("*").eq("id", str(job_id)).eq("user_id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        job = response.data[0]
        
        logs_response = supabase.table("import_logs").select("*").eq("job_id", str(job_id)).execute()
        logs = logs_response.data or []
        
        return {
            "job_id": job["id"],
            "status": job["status"],
            "total_contacts": job.get("total_contacts"),
            "imported_contacts": job.get("imported_contacts"),
            "skipped_contacts": job.get("skipped_contacts"),
            "error_message": job.get("error_message"),
            "completed_at": job.get("completed_at"),
            "log_summary": {
                "total_logs": len(logs),
                "successes": sum(1 for l in logs if l["status"] == "success"),
                "duplicates": sum(1 for l in logs if l["status"] == "duplicate"),
                "errors": sum(1 for l in logs if l["status"] == "error"),
                "skipped": sum(1 for l in logs if l["status"] == "skipped")
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# BACKGROUND IMPORT TASKS (keep existing implementations)
# ============================================================================

def _process_csv_import(job_id: UUID, user_id: str, contacts: list):
    """Background task: Process CSV contacts"""
    if not supabase:
        return
    
    imported = 0
    skipped = 0
    
    try:
        for contact in contacts:
            try:
                # Check DNC
                dnc = supabase.table("dnc_list").select("*").eq("user_id", user_id).eq("email", contact.email).execute()
                if dnc.data:
                    skipped += 1
                    supabase.table("import_logs").insert({
                        "id": str(uuid4()),
                        "job_id": str(job_id),
                        "email": contact.email,
                        "status": "skipped",
                        "reason": "DNC"
                    }).execute()
                    continue
                
                # Check duplicate
                existing = supabase.table("contacts").select("*").eq("user_id", user_id).eq("email", contact.email).execute()
                if existing.data:
                    skipped += 1
                    supabase.table("import_logs").insert({
                        "id": str(uuid4()),
                        "job_id": str(job_id),
                        "contact_id": existing.data[0]["id"],
                        "email": contact.email,
                        "status": "duplicate",
                        "reason": "Email already exists"
                    }).execute()
                    continue
                
                # Create contact
                contact_id = uuid4()
                supabase.table("contacts").insert({
                    "id": str(contact_id),
                    "user_id": user_id,
                    "first_name": contact.first_name,
                    "last_name": contact.last_name,
                    "email": contact.email,
                    "phone": contact.phone,
                    "company": contact.company,
                    "job_title": contact.title,
                    "linkedin_url": contact.linkedin_url,
                    "enrichment_status": "pending"
                }).execute()
                
                imported += 1
                supabase.table("import_logs").insert({
                    "id": str(uuid4()),
                    "job_id": str(job_id),
                    "contact_id": str(contact_id),
                    "email": contact.email,
                    "status": "success"
                }).execute()
                
            except Exception as e:
                skipped += 1
                supabase.table("import_logs").insert({
                    "id": str(uuid4()),
                    "job_id": str(job_id),
                    "email": contact.email,
                    "status": "error",
                    "reason": str(e)[:200]
                }).execute()
        
        # Update job status
        supabase.table("import_jobs").update({
            "status": "completed",
            "imported_contacts": imported,
            "skipped_contacts": skipped,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()
        
    except Exception as e:
        supabase.table("import_jobs").update({
            "status": "failed",
            "error_message": str(e)[:500],
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()


def _process_hubspot_import(job_id: UUID, user_id: str, client: HubSpotClient):
    """Background task: Sync HubSpot contacts"""
    if not supabase:
        return
    
    imported = 0
    skipped = 0
    
    try:
        hs_contacts = client.get_all_contacts()
        
        for hs_contact in hs_contacts:
            try:
                contact_data = client.map_to_latticeiq(hs_contact)
                email = contact_data.get("email")
                
                if not email:
                    skipped += 1
                    continue
                
                # Check DNC
                dnc = supabase.table("dnc_list").select("*").eq("user_id", user_id).eq("email", email).execute()
                if dnc.data:
                    skipped += 1
                    continue
                
                # Check duplicate
                existing = supabase.table("contacts").select("*").eq("user_id", user_id).eq("email", email).execute()
                if existing.data:
                    skipped += 1
                    continue
                
                # Create contact
                contact_id = uuid4()
                supabase.table("contacts").insert({
                    "id": str(contact_id),
                    "user_id": user_id,
                    "first_name": contact_data.get("first_name"),
                    "last_name": contact_data.get("last_name"),
                    "email": email,
                    "phone": contact_data.get("phone"),
                    "company": contact_data.get("company"),
                    "job_title": contact_data.get("title"),
                    "external_id": contact_data.get("external_id"),
                    "crm_type": "hubspot",
                    "enrichment_status": "pending"
                }).execute()
                
                imported += 1
                
            except Exception:
                skipped += 1
        
        # Update job
        supabase.table("import_jobs").update({
            "status": "completed",
            "imported_contacts": imported,
            "skipped_contacts": skipped,
            "total_contacts": imported + skipped,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()
        
    except Exception as e:
        supabase.table("import_jobs").update({
            "status": "failed",
            "error_message": str(e)[:500],
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()


def _process_salesforce_import(job_id: UUID, user_id: str, client: SalesforceClient):
    """Background task: Sync Salesforce contacts"""
    if not supabase:
        return
    
    imported = 0
    skipped = 0
    
    try:
        sf_contacts = client.get_contacts()
        
        for sf_contact in sf_contacts:
            try:
                contact_data = client.map_to_latticeiq(sf_contact)
                email = contact_data.get("email")
                
                if not email:
                    skipped += 1
                    continue
                
                # Check DNC
                dnc = supabase.table("dnc_list").select("*").eq("user_id", user_id).eq("email", email).execute()
                if dnc.data:
                    skipped += 1
                    continue
                
                # Check duplicate
                existing = supabase.table("contacts").select("*").eq("user_id", user_id).eq("email", email).execute()
                if existing.data:
                    skipped += 1
                    continue
                
                # Create contact
                contact_id = uuid4()
                supabase.table("contacts").insert({
                    "id": str(contact_id),
                    "user_id": user_id,
                    "first_name": contact_data.get("first_name"),
                    "last_name": contact_data.get("last_name"),
                    "email": email,
                    "phone": contact_data.get("phone"),
                    "company": contact_data.get("company"),
                    "job_title": contact_data.get("title"),
                    "external_id": contact_data.get("external_id"),
                    "crm_type": "salesforce",
                    "enrichment_status": "pending"
                }).execute()
                
                imported += 1
                
            except Exception:
                skipped += 1
        
        supabase.table("import_jobs").update({
            "status": "completed",
            "imported_contacts": imported,
            "skipped_contacts": skipped,
            "total_contacts": imported + skipped,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()
        
    except Exception as e:
        supabase.table("import_jobs").update({
            "status": "failed",
            "error_message": str(e)[:500],
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()


def _process_pipedrive_import(job_id: UUID, user_id: str, client: PipedriveClient):
    """Background task: Sync Pipedrive contacts"""
    if not supabase:
        return
    
    imported = 0
    skipped = 0
    
    try:
        pd_persons = client.get_all_persons()
        
        for pd_person in pd_persons:
            try:
                contact_data = client.map_to_latticeiq(pd_person)
                email = contact_data.get("email")
                
                if not email:
                    skipped += 1
                    continue
                
                # Check DNC
                dnc = supabase.table("dnc_list").select("*").eq("user_id", user_id).eq("email", email).execute()
                if dnc.data:
                    skipped += 1
                    continue
                
                # Check duplicate
                existing = supabase.table("contacts").select("*").eq("user_id", user_id).eq("email", email).execute()
                if existing.data:
                    skipped += 1
                    continue
                
                # Create contact
                contact_id = uuid4()
                supabase.table("contacts").insert({
                    "id": str(contact_id),
                    "user_id": user_id,
                    "first_name": contact_data.get("first_name"),
                    "last_name": contact_data.get("last_name"),
                    "email": email,
                    "phone": contact_data.get("phone"),
                    "company": contact_data.get("company"),
                    "job_title": contact_data.get("title"),
                    "external_id": contact_data.get("external_id"),
                    "crm_type": "pipedrive",
                    "enrichment_status": "pending"
                }).execute()
                
                imported += 1
                
            except Exception:
                skipped += 1
        
        supabase.table("import_jobs").update({
            "status": "completed",
            "imported_contacts": imported,
            "skipped_contacts": skipped,
            "total_contacts": imported + skipped,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()
        
    except Exception as e:
        supabase.table("import_jobs").update({
            "status": "failed",
            "error_message": str(e)[:500],
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()
