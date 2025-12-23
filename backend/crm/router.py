

# ============================================================================
# FILE: backend/crm/router.py
# ============================================================================
"""CRM import endpoints - v3 API"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse
from uuid import UUID, uuid4
from typing import Optional
from datetime import datetime
import os

from .models import ImportJob, ImportLog, DNCEntry
from .csv_parser import CSVParser
from .hubspot_client import HubSpotClient
from .salesforce_client import SalesforceClient
from .pipedrive_client import PipedriveClient
from ..lib.supabase_client import supabase
from ..lib.dependencies import get_current_user

router = APIRouter(prefix="/api/v3/import", tags=["CRM Import"])


# ============================================================================
# CSV IMPORT ENDPOINT
# ============================================================================

@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    user_id: UUID = Depends(get_current_user)
) -> dict:
    """
    Upload CSV and import contacts
    
    CSV must contain 'email' column. Optional: first_name, last_name, company, title, phone, linkedin_url
    
    Returns: ImportJob with tracking
    """
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
        import_job = ImportJob(
            id=job_id,
            user_id=user_id,
            crm_type="csv",
            status="running",
            total_contacts=len(contacts),
            metadata={"filename": file.filename, "parse_errors": errors}
        )

        # Save job to DB
        await supabase.table("import_jobs").insert({
            "id": str(import_job.id),
            "user_id": str(import_job.user_id),
            "crm_type": "csv",
            "status": "running",
            "total_contacts": len(contacts),
            "metadata": import_job.metadata
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HUBSPOT IMPORT ENDPOINT
# ============================================================================

@router.post("/hubspot")
async def import_hubspot(
    api_key: str,
    background_tasks: BackgroundTasks = None,
    user_id: UUID = Depends(get_current_user)
) -> dict:
    """
    Import contacts from HubSpot via API key
    
    Returns: ImportJob with tracking
    """
    try:
        client = HubSpotClient(api_key=api_key)
        
        if not client.test_connection():
            raise HTTPException(status_code=401, detail="Invalid HubSpot API key")

        # Create import job
        job_id = uuid4()
        
        # Save job
        await supabase.table("import_jobs").insert({
            "id": str(job_id),
            "user_id": str(user_id),
            "crm_type": "hubspot",
            "status": "running",
            "metadata": {"api_key_length": len(api_key)}
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# SALESFORCE IMPORT ENDPOINT
# ============================================================================

@router.post("/salesforce")
async def import_salesforce(
    instance_url: str,
    client_id: str,
    client_secret: str,
    username: str,
    password: str,
    background_tasks: BackgroundTasks = None,
    user_id: UUID = Depends(get_current_user)
) -> dict:
    """
    Import contacts from Salesforce via OAuth credentials
    
    Returns: ImportJob with tracking
    """
    try:
        client = SalesforceClient(
            instance_url=instance_url,
            client_id=client_id,
            client_secret=client_secret,
            username=username,
            password=password
        )

        if not client.test_connection():
            raise HTTPException(status_code=401, detail="Invalid Salesforce credentials")

        # Create import job
        job_id = uuid4()
        
        await supabase.table("import_jobs").insert({
            "id": str(job_id),
            "user_id": str(user_id),
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PIPEDRIVE IMPORT ENDPOINT
# ============================================================================

@router.post("/pipedrive")
async def import_pipedrive(
    api_token: str,
    background_tasks: BackgroundTasks = None,
    user_id: UUID = Depends(get_current_user)
) -> dict:
    """
    Import contacts from Pipedrive via API token
    
    Returns: ImportJob with tracking
    """
    try:
        client = PipedriveClient(api_token=api_token)
        
        if not client.test_connection():
            raise HTTPException(status_code=401, detail="Invalid Pipedrive API token")

        # Create import job
        job_id = uuid4()
        
        await supabase.table("import_jobs").insert({
            "id": str(job_id),
            "user_id": str(user_id),
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# IMPORT STATUS ENDPOINT
# ============================================================================

@router.get("/status/{job_id}")
async def get_import_status(
    job_id: UUID,
    user_id: UUID = Depends(get_current_user)
) -> dict:
    """Get import job status and progress"""
    try:
        response = await supabase.table("import_jobs").select("*").eq("id", str(job_id)).eq("user_id", str(user_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Import job not found")

        job = response.data[0]

        # Get logs for this job
        logs_response = await supabase.table("import_logs").select("*").eq("job_id", str(job_id)).execute()
        logs = logs_response.data or []

        return {
            "job_id": job["id"],
            "status": job["status"],
            "total_contacts": job["total_contacts"],
            "imported_contacts": job["imported_contacts"],
            "skipped_contacts": job["skipped_contacts"],
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# BACKGROUND IMPORT TASKS
# ============================================================================

async def _process_csv_import(job_id: UUID, user_id: UUID, contacts: list):
    """Background task: Process CSV contacts"""
    imported = 0
    skipped = 0

    try:
        for contact in contacts:
            try:
                # Check DNC
                dnc = await supabase.table("dnc_list").select("*").eq("user_id", str(user_id)).eq("email", contact.email).execute()
                
                if dnc.data:
                    skipped += 1
                    await supabase.table("import_logs").insert({
                        "id": str(uuid4()),
                        "job_id": str(job_id),
                        "email": contact.email,
                        "status": "skipped",
                        "reason": "DNC"
                    }).execute()
                    continue

                # Check duplicate
                existing = await supabase.table("contacts").select("*").eq("user_id", str(user_id)).eq("email", contact.email).execute()
                
                if existing.data:
                    skipped += 1
                    await supabase.table("import_logs").insert({
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
                await supabase.table("contacts").insert({
                    "id": str(contact_id),
                    "user_id": str(user_id),
                    "first_name": contact.first_name,
                    "last_name": contact.last_name,
                    "email": contact.email,
                    "phone": contact.phone,
                    "company": contact.company,
                    "title": contact.title,
                    "linkedin_url": contact.linkedin_url,
                    "enrichment_status": "pending"
                }).execute()

                imported += 1
                await supabase.table("import_logs").insert({
                    "id": str(uuid4()),
                    "job_id": str(job_id),
                    "contact_id": str(contact_id),
                    "email": contact.email,
                    "status": "success"
                }).execute()

            except Exception as e:
                skipped += 1
                await supabase.table("import_logs").insert({
                    "id": str(uuid4()),
                    "job_id": str(job_id),
                    "email": contact.email,
                    "status": "error",
                    "reason": str(e)[:200]
                }).execute()

        # Update job status
        await supabase.table("import_jobs").update({
            "status": "completed",
            "imported_contacts": imported,
            "skipped_contacts": skipped,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()

    except Exception as e:
        await supabase.table("import_jobs").update({
            "status": "failed",
            "error_message": str(e)[:500],
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()


async def _process_hubspot_import(job_id: UUID, user_id: UUID, client: HubSpotClient):
    """Background task: Sync HubSpot contacts"""
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
                dnc = await supabase.table("dnc_list").select("*").eq("user_id", str(user_id)).eq("email", email).execute()
                
                if dnc.data:
                    skipped += 1
                    continue

                # Check duplicate
                existing = await supabase.table("contacts").select("*").eq("user_id", str(user_id)).eq("email", email).execute()
                
                if existing.data:
                    skipped += 1
                    continue

                # Create contact
                contact_id = uuid4()
                await supabase.table("contacts").insert({
                    "id": str(contact_id),
                    "user_id": str(user_id),
                    "first_name": contact_data.get("first_name"),
                    "last_name": contact_data.get("last_name"),
                    "email": email,
                    "phone": contact_data.get("phone"),
                    "company": contact_data.get("company"),
                    "title": contact_data.get("title"),
                    "external_id": contact_data.get("external_id"),
                    "crm_type": "hubspot",
                    "enrichment_status": "pending"
                }).execute()

                imported += 1

            except Exception as e:
                skipped += 1

        # Update job
        await supabase.table("import_jobs").update({
            "status": "completed",
            "imported_contacts": imported,
            "skipped_contacts": skipped,
            "total_contacts": imported + skipped,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()

    except Exception as e:
        await supabase.table("import_jobs").update({
            "status": "failed",
            "error_message": str(e)[:500],
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()


async def _process_salesforce_import(job_id: UUID, user_id: UUID, client: SalesforceClient):
    """Background task: Sync Salesforce contacts"""
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
                dnc = await supabase.table("dnc_list").select("*").eq("user_id", str(user_id)).eq("email", email).execute()
                
                if dnc.data:
                    skipped += 1
                    continue

                # Check duplicate
                existing = await supabase.table("contacts").select("*").eq("user_id", str(user_id)).eq("email", email).execute()
                
                if existing.data:
                    skipped += 1
                    continue

                # Create contact
                contact_id = uuid4()
                await supabase.table("contacts").insert({
                    "id": str(contact_id),
                    "user_id": str(user_id),
                    "first_name": contact_data.get("first_name"),
                    "last_name": contact_data.get("last_name"),
                    "email": email,
                    "phone": contact_data.get("phone"),
                    "company": contact_data.get("company"),
                    "title": contact_data.get("title"),
                    "external_id": contact_data.get("external_id"),
                    "crm_type": "salesforce",
                    "enrichment_status": "pending"
                }).execute()

                imported += 1

            except Exception as e:
                skipped += 1

        # Update job
        await supabase.table("import_jobs").update({
            "status": "completed",
            "imported_contacts": imported,
            "skipped_contacts": skipped,
            "total_contacts": imported + skipped,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()

    except Exception as e:
        await supabase.table("import_jobs").update({
            "status": "failed",
            "error_message": str(e)[:500],
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()


async def _process_pipedrive_import(job_id: UUID, user_id: UUID, client: PipedriveClient):
    """Background task: Sync Pipedrive contacts"""
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
                dnc = await supabase.table("dnc_list").select("*").eq("user_id", str(user_id)).eq("email", email).execute()
                
                if dnc.data:
                    skipped += 1
                    continue

                # Check duplicate
                existing = await supabase.table("contacts").select("*").eq("user_id", str(user_id)).eq("email", email).execute()
                
                if existing.data:
                    skipped += 1
                    continue

                # Create contact
                contact_id = uuid4()
                await supabase.table("contacts").insert({
                    "id": str(contact_id),
                    "user_id": str(user_id),
                    "first_name": contact_data.get("first_name"),
                    "last_name": contact_data.get("last_name"),
                    "email": email,
                    "phone": contact_data.get("phone"),
                    "company": contact_data.get("company"),
                    "title": contact_data.get("title"),
                    "external_id": contact_data.get("external_id"),
                    "crm_type": "pipedrive",
                    "enrichment_status": "pending"
                }).execute()

                imported += 1

            except Exception as e:
                skipped += 1

        # Update job
        await supabase.table("import_jobs").update({
            "status": "completed",
            "imported_contacts": imported,
            "skipped_contacts": skipped,
            "total_contacts": imported + skipped,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()

    except Exception as e:
        await supabase.table("import_jobs").update({
            "status": "failed",
            "error_message": str(e)[:500],
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(job_id)).execute()