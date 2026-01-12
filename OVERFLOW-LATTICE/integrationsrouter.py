# backend/app/routers/integrationsrouter.py
# ============================================================================
# FILE: backend/app/routers/integrationsrouter.py
# PURPOSE: Integration management endpoints (HubSpot, Salesforce, etc.)
# VERSION: 1.0.0
# ============================================================================

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import logging
import httpx
import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["Integrations"])


# ============================================================================
# DEPENDENCIES
# ============================================================================

def get_supabase():
    """Get Supabase client."""
    from app.main import supabase
    return supabase


async def get_current_user_id(authorization: str = Header(...)) -> str:
    """Extract user ID from JWT."""
    try:
        parts = authorization.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization format")
        
        token = parts[1]
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return str(user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


# ============================================================================
# MODELS
# ============================================================================

class HubSpotTestRequest(BaseModel):
    api_key: str


class HubSpotConnectRequest(BaseModel):
    api_key: str


class HubSpotTestResponse(BaseModel):
    success: bool
    provider: str = "hubspot"
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    contact_count: Optional[int] = None
    error: Optional[str] = None


class HubSpotStatusResponse(BaseModel):
    status: str
    provider: str = "hubspot"
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    total_imported: int = 0
    last_sync_at: Optional[str] = None


# ============================================================================
# HUBSPOT ENDPOINTS
# ============================================================================

@router.post("/hubspot/test", response_model=HubSpotTestResponse)
async def test_hubspot_connection(
    request: HubSpotTestRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Test HubSpot API key validity.
    Returns account info and contact count if successful.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test the API key by fetching account info
            headers = {
                "Authorization": f"Bearer {request.api_key}",
                "Content-Type": "application/json"
            }
            
            # Get account info
            account_resp = await client.get(
                "https://api.hubapi.com/account-info/v3/details",
                headers=headers
            )
            
            if account_resp.status_code != 200:
                error_detail = "Invalid API key or insufficient permissions"
                try:
                    error_data = account_resp.json()
                    error_detail = error_data.get("message", error_detail)
                except:
                    pass
                return HubSpotTestResponse(
                    success=False,
                    error=error_detail
                )
            
            account_data = account_resp.json()
            account_id = str(account_data.get("portalId", ""))
            account_name = f"Portal {account_id}"
            
            # Get contact count
            contacts_resp = await client.get(
                "https://api.hubapi.com/crm/v3/objects/contacts",
                headers=headers,
                params={"limit": 1}
            )
            
            contact_count = 0
            if contacts_resp.status_code == 200:
                contacts_data = contacts_resp.json()
                contact_count = contacts_data.get("total", 0)
            
            return HubSpotTestResponse(
                success=True,
                account_id=account_id,
                account_name=account_name,
                contact_count=contact_count
            )
            
    except httpx.TimeoutException:
        return HubSpotTestResponse(
            success=False,
            error="Connection timeout - please try again"
        )
    except Exception as e:
        logger.error(f"HubSpot test error: {e}")
        return HubSpotTestResponse(
            success=False,
            error=str(e)
        )


@router.post("/hubspot/connect")
async def connect_hubspot(
    request: HubSpotConnectRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """
    Save HubSpot credentials for the user.
    """
    try:
        # First verify the API key is valid
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "Authorization": f"Bearer {request.api_key}",
                "Content-Type": "application/json"
            }
            
            account_resp = await client.get(
                "https://api.hubapi.com/account-info/v3/details",
                headers=headers
            )
            
            if account_resp.status_code != 200:
                raise HTTPException(
                    status_code=400, 
                    detail="Invalid HubSpot API key"
                )
            
            account_data = account_resp.json()
            account_id = str(account_data.get("portalId", ""))
            account_name = f"Portal {account_id}"
        
        # Check if integration already exists
        existing = supabase.table("user_integrations")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("provider", "hubspot")\
            .execute()
        
        now = datetime.now(timezone.utc).isoformat()
        
        integration_data = {
            "user_id": user_id,
            "provider": "hubspot",
            "api_key": request.api_key,
            "account_id": account_id,
            "account_name": account_name,
            "status": "connected",
            "connected_at": now,
            "updated_at": now
        }
        
        if existing.data and len(existing.data) > 0:
            # Update existing
            result = supabase.table("user_integrations")\
                .update(integration_data)\
                .eq("user_id", user_id)\
                .eq("provider", "hubspot")\
                .execute()
        else:
            # Insert new
            integration_data["total_imported"] = 0
            integration_data["created_at"] = now
            result = supabase.table("user_integrations")\
                .insert(integration_data)\
                .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to save integration"
            )
        
        return {
            "success": True,
            "status": "connected",
            "account_id": account_id,
            "account_name": account_name,
            "message": "HubSpot connected successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"HubSpot connect error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save integration: {str(e)}"
        )


@router.get("/hubspot/status", response_model=HubSpotStatusResponse)
async def get_hubspot_status(
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """
    Get current HubSpot connection status for the user.
    """
    try:
        result = supabase.table("user_integrations")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("provider", "hubspot")\
            .single()\
            .execute()
        
        if not result.data:
            return HubSpotStatusResponse(
                status="disconnected"
            )
        
        data = result.data
        return HubSpotStatusResponse(
            status=data.get("status", "connected"),
            account_id=data.get("account_id"),
            account_name=data.get("account_name"),
            total_imported=data.get("total_imported", 0),
            last_sync_at=data.get("last_sync_at")
        )
        
    except Exception as e:
        logger.warning(f"Could not get HubSpot status: {e}")
        return HubSpotStatusResponse(status="disconnected")


@router.delete("/hubspot/disconnect")
async def disconnect_hubspot(
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """
    Disconnect HubSpot integration.
    """
    try:
        result = supabase.table("user_integrations")\
            .update({
                "status": "disconnected",
                "api_key": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            })\
            .eq("user_id", user_id)\
            .eq("provider", "hubspot")\
            .execute()
        
        return {"success": True, "message": "HubSpot disconnected"}
        
    except Exception as e:
        logger.error(f"HubSpot disconnect error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to disconnect: {str(e)}"
        )
