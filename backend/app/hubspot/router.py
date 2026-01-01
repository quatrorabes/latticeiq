# backend/app/hubspot/router.py
# BEST PRACTICES VERSION - API key in request body, saves to Supabase

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import aiohttp
import logging
import uuid
import os
from datetime import datetime
from supabase import create_client, Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hubspot", tags=["hubspot"])

# ============================================================================
# SUPABASE CLIENT
# ============================================================================

def get_supabase() -> Client:
    """Get Supabase client"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(url, key)

# ============================================================================
# REQUEST MODELS
# ============================================================================

class TestConnectionRequest(BaseModel):
    api_key: str = Field(..., min_length=10, description="HubSpot Private App Token")

class ImportRequest(BaseModel):
    api_key: str = Field(..., min_length=10, description="HubSpot Private App Token")
    batch_size: int = Field(default=50, ge=1, le=500, description="Number of contacts to import")
    workspace_id: Optional[str] = Field(default=None, description="Workspace UUID for multi-tenant isolation")
    skip_duplicates: bool = Field(default=True, description="Skip contacts that already exist by email")

# ============================================================================
# RESPONSE MODELS
# ============================================================================

class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    contact_count: int = 0
    portal_id: Optional[str] = None

class ImportedContact(BaseModel):
    contact_id: str
    hubspot_id: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    status: str = "success"

class ImportResponse(BaseModel):
    success: bool
    message: str
    imported: int
    total: int
    duplicates_skipped: int = 0
    failed: int = 0
    contacts: List[ImportedContact] = []

# ============================================================================
# HUBSPOT API FUNCTIONS
# ============================================================================

async def test_hubspot_connection(api_key: str) -> Dict[str, Any]:
    """Test the HubSpot API connection and return account info"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.get(
            "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
            headers=headers
        ) as resp:
            if resp.status == 401:
                raise Exception("Invalid API key - check your HubSpot Private App token")
            if resp.status == 403:
                raise Exception("Access forbidden - ensure your Private App has 'crm.objects.contacts.read' scope")
            if resp.status != 200:
                text = await resp.text()
                raise Exception(f"HubSpot API error: {resp.status} - {text}")
            
            await resp.json()

        async with session.get(
            "https://api.hubapi.com/crm/v3/objects/contacts?limit=0",
            headers=headers
        ) as resp:
            if resp.status == 200:
                count_data = await resp.json()
                total = count_data.get("total", 0)
            else:
                total = 0
                
        return {"authenticated": True, "contact_count": total}

async def fetch_hubspot_contacts(api_key: str, batch_size: int = 50) -> List[Dict[str, Any]]:
    """Fetch contacts from HubSpot API with pagination"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    all_contacts: List[Dict[str, Any]] = []
    after: Optional[str] = None
    remaining = batch_size
    
    async with aiohttp.ClientSession() as session:
        while remaining > 0:
            fetch_count = min(remaining, 100)
            
            url = "https://api.hubapi.com/crm/v3/objects/contacts"
            params: Dict[str, Any] = {
                "limit": fetch_count,
                "properties": ["firstname", "lastname", "email", "company", "phone", "jobtitle"]
            }
            if after:
                params["after"] = after
            
            async with session.get(url, headers=headers, params=params) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"Failed to fetch contacts: {resp.status} - {text}")
                
                data = await resp.json()
                contacts = data.get("results", [])
                
                logger.info(f"Fetched {len(contacts)} contacts from HubSpot")
                if contacts:
                    sample_props = contacts[0].get("properties", {})
                    logger.info(f"Sample contact: email={sample_props.get('email')}, firstname={sample_props.get('firstname')}")
                
                all_contacts.extend(contacts)
                remaining -= len(contacts)
                
                paging = data.get("paging", {})
                next_link = paging.get("next", {})
                after = next_link.get("after") if next_link else None
                
                if not after or len(contacts) == 0:
                    break
    
    return all_contacts[:batch_size]

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/health")
async def hubspot_health():
    """HubSpot router health check"""
    return {
        "status": "ok",
        "service": "hubspot",
        "version": "2.2",
        "features": ["test-connection", "import-batch", "debug-fetch"]
    }

@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(request: TestConnectionRequest):
    """Test HubSpot API connection."""
    try:
        logger.info("Testing HubSpot connection...")
        result = await test_hubspot_connection(request.api_key)
        
        return TestConnectionResponse(
            success=True,
            message="Connected to HubSpot successfully!",
            contact_count=result.get("contact_count", 0)
        )
    except Exception as e:
        logger.error(f"HubSpot connection error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/debug-fetch")
async def debug_fetch(request: TestConnectionRequest):
    """Debug: Show raw HubSpot contact data"""
    try:
        contacts = await fetch_hubspot_contacts(request.api_key, 5)
        return {
            "count": len(contacts),
            "sample": contacts[:5]
        }
    except Exception as e:
        logger.error(f"Debug fetch error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/import-batch", response_model=ImportResponse)
async def import_batch(request: ImportRequest):
    """Import contacts from HubSpot and save to database."""
    try:
        logger.info(f"Importing {request.batch_size} contacts from HubSpot...")
        
        hubspot_contacts = await fetch_hubspot_contacts(request.api_key, request.batch_size)
        
        if not hubspot_contacts:
            return ImportResponse(
                success=True,
                message="No contacts found in HubSpot",
                imported=0,
                total=0,
                contacts=[]
            )
        
        supabase = get_supabase()
        
        imported_contacts: List[ImportedContact] = []
        duplicates_skipped = 0
        failed = 0
        
        for contact in hubspot_contacts:
            try:
                props = contact.get("properties") or {}
                hubspot_id = contact.get("id", "")
                email = props.get("email")
                
                logger.info(f"Processing contact: hubspot_id={hubspot_id}, email={email}")
                
                if not email:
                    logger.warning(f"Skipping contact {hubspot_id}: no email")
                    failed += 1
                    continue
                
                if request.skip_duplicates:
                    existing = supabase.table("contacts").select("id").eq("email", email).execute()
                    
                    if existing.data and len(existing.data) > 0:
                        duplicates_skipped += 1
                        imported_contacts.append(ImportedContact(
                            contact_id=existing.data[0]["id"],
                            hubspot_id=hubspot_id,
                            email=email,
                            first_name=props.get("firstname"),
                            last_name=props.get("lastname"),
                            company=props.get("company"),
                            status="duplicate_skipped"
                        ))
                        continue
                
                contact_id = str(uuid.uuid4())
                new_contact = {
                    "id": contact_id,
                    "workspace_id": None,  # workspace_id is UUID type, use NULL for now
                    "email": email,
                    "first_name": props.get("firstname") or "",
                    "last_name": props.get("lastname") or "",
                    "company": props.get("company") or "",
                    "phone": props.get("phone") or "",
                    "job_title": props.get("jobtitle") or "",
                    "source": "hubspot",
                    "hubspot_id": hubspot_id,
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                }
                
                logger.info(f"Inserting contact: {email}")
                result = supabase.table("contacts").insert(new_contact).execute()
                
                if result.data:
                    logger.info(f"Successfully inserted: {email}")
                    imported_contacts.append(ImportedContact(
                        contact_id=contact_id,
                        hubspot_id=hubspot_id,
                        email=email,
                        first_name=props.get("firstname"),
                        last_name=props.get("lastname"),
                        company=props.get("company"),
                        status="success"
                    ))
                else:
                    logger.error(f"Insert returned no data for: {email}")
                    failed += 1
                    
            except Exception as e:
                logger.error(f"Error saving contact: {str(e)}")
                failed += 1
                continue
        
        imported_count = len([c for c in imported_contacts if c.status == "success"])
        
        logger.info(f"HubSpot import complete: {imported_count} imported, {duplicates_skipped} duplicates, {failed} failed")
        
        return ImportResponse(
            success=True,
            message=f"Successfully imported {imported_count} contacts from HubSpot",
            imported=imported_count,
            total=len(hubspot_contacts),
            duplicates_skipped=duplicates_skipped,
            failed=failed,
            contacts=imported_contacts
        )
        
    except Exception as e:
        logger.error(f"HubSpot import error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

logger.info("HubSpot router loaded (v2.2 - workspace_id fix)")
