# backend/app/hubspot/router.py
# COMPLETE FILE - Simple API key based HubSpot import

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import aiohttp
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/hubspot", tags=["hubspot"])

# ============================================================================
# HUBSPOT CLIENT (inline for simplicity)
# ============================================================================

class HubSpotClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.hubapi.com"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    async def test_connection(self) -> Dict[str, Any]:
        """Test the API connection"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/crm/v3/objects/contacts?limit=1",
                headers=self.headers
            ) as resp:
                if resp.status == 401:
                    raise Exception("Invalid API key")
                if resp.status == 200:
                    data = await resp.json()
                    total = data.get("total", 0)
                    return {"authenticated": True, "contact_count": total}
                text = await resp.text()
                raise Exception(f"Connection failed: {resp.status} - {text}")

    async def get_contacts(self, limit: int = 100, after: Optional[str] = None) -> Dict[str, Any]:
        """Fetch contacts from HubSpot"""
        url = f"{self.base_url}/crm/v3/objects/contacts"
        params = {
            "limit": min(limit, 100),  # HubSpot max is 100 per request
            "properties": "firstname,lastname,email,company,phone,jobtitle,lifecyclestage,hs_lead_status"
        }
        if after:
            params["after"] = after

        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self.headers, params=params) as resp:
                if resp.status == 200:
                    return await resp.json()
                text = await resp.text()
                raise Exception(f"Failed to fetch contacts: {resp.status} - {text}")

    async def get_contacts_batch(self, batch_size: int = 50) -> List[Dict[str, Any]]:
        """Fetch a batch of contacts"""
        all_contacts = []
        after = None
        remaining = batch_size

        while remaining > 0:
            fetch_count = min(remaining, 100)  # HubSpot max per request
            data = await self.get_contacts(limit=fetch_count, after=after)
            contacts = data.get("results", [])
            all_contacts.extend(contacts)
            remaining -= len(contacts)

            # Check for next page
            paging = data.get("paging", {})
            after = paging.get("next", {}).get("after")
            if not after or len(contacts) == 0:
                break

        return all_contacts[:batch_size]  # Ensure we don't exceed batch_size

# ============================================================================
# RESPONSE MODELS
# ============================================================================

class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    contact_count: Optional[int] = None

class ImportResponse(BaseModel):
    success: bool
    message: str
    total_fetched: int
    contacts: List[Dict[str, Any]]

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/health")
async def hubspot_health():
    """HubSpot router health check"""
    return {"status": "ok", "service": "hubspot"}

@router.post("/test-connection")
async def test_connection(api_key: str = Query(..., description="HubSpot API Key")):
    """Test HubSpot API key connection"""
    try:
        client = HubSpotClient(api_key=api_key)
        result = await client.test_connection()
        return TestConnectionResponse(
            success=True,
            message="Connected to HubSpot successfully",
            contact_count=result.get("contact_count", 0)
        )
    except Exception as e:
        logger.error(f"HubSpot connection error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/import-batch")
async def import_batch(
    api_key: str = Query(..., description="HubSpot API Key"),
    batch_size: int = Query(50, ge=10, le=500, description="Number of contacts to import")
):
    """Import a batch of contacts from HubSpot"""
    try:
        client = HubSpotClient(api_key=api_key)
        
        # Fetch contacts
        contacts = await client.get_contacts_batch(batch_size=batch_size)
        
        # Transform contacts to simple format
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
                "lifecycle_stage": props.get("lifecyclestage"),
                "lead_status": props.get("hs_lead_status"),
            })
        
        return ImportResponse(
            success=True,
            message=f"Successfully fetched {len(transformed)} contacts from HubSpot",
            total_fetched=len(transformed),
            contacts=transformed
        )
        
    except Exception as e:
        logger.error(f"HubSpot import error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
