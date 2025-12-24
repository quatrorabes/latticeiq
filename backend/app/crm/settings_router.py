"""
CRM Settings Router - Manages CRM integration credentials and settings
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from supabase import create_client, Client
import os
import httpx

router = APIRouter()

# ─────────────────────────────────────────────────────────────────────────────
# Supabase clients
# ─────────────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase_anon: Optional[Client] = None
supabase_service: Optional[Client] = None

if SUPABASE_URL and SUPABASE_ANON_KEY:
    supabase_anon = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase_service = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────────────────────────────────────
class CRMIntegrationIn(BaseModel):
    crm_type: str  # hubspot, salesforce, pipedrive
    api_key: str
    base_url: Optional[str] = None
    is_active: bool = True


class CRMIntegrationOut(BaseModel):
    id: str
    crm_type: str
    base_url: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: Optional[str] = None


class TestConnectionRequest(BaseModel):
    api_key: str
    base_url: Optional[str] = None


class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    details: Optional[dict] = None


# ─────────────────────────────────────────────────────────────────────────────
# Helper: Extract user from request
# ─────────────────────────────────────────────────────────────────────────────
def get_user_from_request(request: Request) -> Optional[dict]:
    """Extract user from request state (set by auth middleware)"""
    return getattr(request.state, "user", None)


# ─────────────────────────────────────────────────────────────────────────────
# Test Connection Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/integrations/hubspot/test", response_model=TestConnectionResponse, tags=["Settings"])
async def test_hubspot_connection(body: TestConnectionRequest):
    """Test HubSpot API connection with provided credentials"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.hubapi.com/crm/v3/objects/contacts",
                headers={"Authorization": f"Bearer {body.api_key}"},
                params={"limit": 1}
            )
            if response.status_code == 200:
                data = response.json()
                total = data.get("total", 0)
                return TestConnectionResponse(
                    success=True,
                    message=f"Connected successfully. Found {total} contacts.",
                    details={"total_contacts": total}
                )
            else:
                return TestConnectionResponse(
                    success=False,
                    message=f"Connection failed: {response.status_code}",
                    details={"error": response.text}
                )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"Connection error: {str(e)}"
        )


@router.post("/integrations/salesforce/test", response_model=TestConnectionResponse, tags=["Settings"])
async def test_salesforce_connection(body: TestConnectionRequest):
    """Test Salesforce API connection with provided credentials"""
    if not body.base_url:
        return TestConnectionResponse(
            success=False,
            message="Salesforce requires a base_url (your instance URL)"
        )
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{body.base_url}/services/data/v57.0/sobjects/Contact",
                headers={"Authorization": f"Bearer {body.api_key}"}
            )
            if response.status_code == 200:
                return TestConnectionResponse(
                    success=True,
                    message="Connected to Salesforce successfully."
                )
            else:
                return TestConnectionResponse(
                    success=False,
                    message=f"Connection failed: {response.status_code}",
                    details={"error": response.text}
                )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"Connection error: {str(e)}"
        )


@router.post("/integrations/pipedrive/test", response_model=TestConnectionResponse, tags=["Settings"])
async def test_pipedrive_connection(body: TestConnectionRequest):
    """Test Pipedrive API connection with provided credentials"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.pipedrive.com/v1/persons",
                params={"api_token": body.api_key, "limit": 1}
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    return TestConnectionResponse(
                        success=True,
                        message="Connected to Pipedrive successfully."
                    )
            return TestConnectionResponse(
                success=False,
                message=f"Connection failed: {response.status_code}",
                details={"error": response.text}
            )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"Connection error: {str(e)}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# CRUD Endpoints for CRM Integrations
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/integrations", response_model=List[CRMIntegrationOut], tags=["Settings"])
async def list_integrations(request: Request):
    """List all CRM integrations for the current user"""
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not supabase_anon:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    res = (
        supabase_anon.table("crm_integrations")
        .select("id, crm_type, base_url, is_active, created_at, updated_at")
        .eq("user_id", user["id"])
        .execute()
    )

    return [
        CRMIntegrationOut(
            id=row["id"],
            crm_type=row["crm_type"],
            base_url=row.get("base_url"),
            is_active=row["is_active"],
            created_at=row["created_at"],
            updated_at=row.get("updated_at"),
        )
        for row in res.data
    ]


@router.post("/integrations", response_model=CRMIntegrationOut, tags=["Settings"])
async def upsert_integration(body: CRMIntegrationIn, request: Request):
    """Create or update a CRM integration"""
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not supabase_anon or not supabase_service:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    row = {
        "user_id": user["id"],
        "crm_type": body.crm_type,
        "api_key_encrypted": body.api_key,
        "base_url": body.base_url,
        "is_active": body.is_active,
    }

    # Use native Postgres upsert with on_conflict
    res = (
        supabase_service.table("crm_integrations")
        .upsert(row, on_conflict="user_id,crm_type")
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save integration")

    saved = res.data[0]
    return CRMIntegrationOut(
        id=saved["id"],
        crm_type=saved["crm_type"],
        base_url=saved.get("base_url"),
        is_active=saved["is_active"],
        created_at=saved["created_at"],
        updated_at=saved.get("updated_at"),
    )


@router.delete("/integrations/{crm_type}", tags=["Settings"])
async def delete_integration(crm_type: str, request: Request):
    """Delete a CRM integration"""
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not supabase_service:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    res = (
        supabase_service.table("crm_integrations")
        .delete()
        .eq("user_id", user["id"])
        .eq("crm_type", crm_type)
        .execute()
    )

    return {"success": True, "deleted": crm_type}
