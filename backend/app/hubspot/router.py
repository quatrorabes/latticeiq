# backend/app/hubspot/router.py
# COMPLETE SELF-CONTAINED FILE - NO EXTERNAL DEPENDENCIES

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import aiohttp
import logging

logger = logging.getLogger(__name__)

# Router with prefix - will be mounted at /api/v3/hubspot
router = APIRouter(prefix="/hubspot", tags=["hubspot"])

# ============================================================================
# RESPONSE MODELS
# ============================================================================

class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    contact_count: Optional[int] = None

class ContactData(BaseModel):
    hubspot_id: Optional[str] = None
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None

class ImportResponse(BaseModel):
    success: bool
    message: str
    total_fetched: int
    contacts: List[Dict[str, Any]]

# ============================================================================
# HUBSPOT API FUNCTIONS
# ============================================================================

async def test_hubspot_connection(api_key: str) -> Dict[str, Any]:
    """Test the HubSpot API connection"""
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
            if resp.status == 200:
                data = await resp.json()
                return {"authenticated": True, "contact_count": data.get("total", 0)}
            text = await resp.text()
            raise Exception(f"HubSpot API error: {resp.status} - {text}")

async def fetch_hubspot_contacts(api_key: str, batch_size: int = 50) -> List[Dict[str, Any]]:
    """Fetch contacts from HubSpot API"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    all_contacts = []
    after = None
    remaining = batch_size
    
    async with aiohttp.ClientSession() as session:
        while remaining > 0:
            # Build URL with params
            fetch_count = min(remaining, 100)  # HubSpot max is 100 per request
            url = f"https://api.hubapi.com/crm/v3/objects/contacts?limit={fetch_count}&properties=firstname,lastname,email,company,phone,jobtitle"
            if after:
                url += f"&after={after}"
            
            async with session.get(url, headers=headers) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"Failed to fetch contacts: {resp.status} - {text}")
                
                data = await resp.json()
                contacts = data.get("results", [])
                all_contacts.extend(contacts)
                remaining -= len(contacts)
                
                # Check for next page
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
    return {"status": "ok", "service": "hubspot", "version": "1.0"}

@router.post("/test-connection")
async def test_connection(api_key: str = Query(..., description="HubSpot Private App API Key")):
    """Test HubSpot API key connection"""
    try:
        logger.info(f"Testing HubSpot connection...")
        result = await test_hubspot_connection(api_key)
        return TestConnectionResponse(
            success=True,
            message="Connected to HubSpot successfully!",
            contact_count=result.get("contact_count", 0)
        )
    except Exception as e:
        logger.error(f"HubSpot connection error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/import-batch")
async def import_batch(
    api_key: str = Query(..., description="HubSpot Private App API Key"),
    batch_size: int = Query(50, ge=10, le=500, description="Number of contacts to import")
):
    """Import a batch of contacts from HubSpot"""
    try:
        logger.info(f"Importing {batch_size} contacts from HubSpot...")
        
        # Fetch contacts from HubSpot
        contacts = await fetch_hubspot_contacts(api_key, batch_size)
        
        if not contacts:
            return ImportResponse(
                success=True,
                message="No contacts found in HubSpot",
                total_fetched=0,
                contacts=[]
            )
        
        # Transform to simple format
        transformed = []
        for contact in contacts:
            props = contact.get("properties", {})
            transformed.append({
                "hubspot_id": contact.get("id"),
                "email": props.get("email"),
                "first_name": props.get("firstname"),
                "last_name": props.get("lastname"),
                "company": props.get("company"),
                "phone": props.get("phone"),
                "job_title": props.get("jobtitle"),
            })
        
        logger.info(f"Successfully fetched {len(transformed)} contacts")
        
        return ImportResponse(
            success=True,
            message=f"Successfully fetched {len(transformed)} contacts from HubSpot",
            total_fetched=len(transformed),
            contacts=transformed
        )
        
    except Exception as e:
        logger.error(f"HubSpot import error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# Log when module loads
logger.info("HubSpot router module loaded successfully")
