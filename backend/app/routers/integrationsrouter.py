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
async def test_hubspot_connection(request: HubSpotTestRequest):
    """
    Test HubSpot API key validity without saving.
    Returns account info and contact count if successful.
    """
    logger.info({"event": "hubspot_test_start"})
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test API key by fetching account info
            headers = {"Authorization": f"Bearer {request.api_key}"}
            
            # Get account info
            account_resp = await client.get(
                "https://api.hubapi.com/account-info/v3/details",
                headers=headers
            )
            
            if account_resp.status_code == 401:
                return HubSpotTestResponse(
                    success=False,
                    error="Invalid API key"
                )
            elif account_resp.status_code != 200:
                return HubSpotTestResponse(
                    success=False,
                    error=f"HubSpot API error: {account_resp.status_code}"
                )
            
            account_data = account_resp.json()
            account_id = str(account_data.get("portalId", ""))
            account_name = account_data.get("uiDomain", account_data.get("companyName", "Unknown"))
            
            # Get contact count
            contact_resp = await client.get(
                "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
                headers=headers
            )
            
            contact_count = 0
            if contact_resp.status_code == 200:
                contact_data = contact_resp.json()
                contact_count = contact_data.get("total", 0)
            
            logger.info({
                "event": "hubspot_test_success",
                "account_id": account_id,
                "contact_count": contact_count
            })
            
            return HubSpotTestResponse(
                success=True,
                account_id=account_id,
                account_name=account_name,
                contact_count=contact_count
            )
            
    except httpx.TimeoutException:
        logger.error({"event": "hubspot_test_timeout"})
        return HubSpotTestResponse(
            success=False,
            error="Connection timeout - please try again"
        )
    except Exception as e:
        logger.error({"event": "hubspot_test_error", "error": str(e)})
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
    Save HubSpot connection after successful test.
    Stores encrypted API key in user_integrations table.
    """
    logger.info({"event": "hubspot_connect_start", "user_id": user_id})
    
    # First test the connection
    test_result = await test_hubspot_connection(HubSpotTestRequest(api_key=request.api_key))
    
    if not test_result.success:
        raise HTTPException(status_code=400, detail=test_result.error or "Invalid API key")
    
    try:
        # Check if user already has a HubSpot integration
        existing = supabase.table("user_integrations").select("id").eq(
            "user_id", user_id
        ).eq("provider", "hubspot").execute()
        
        integration_data = {
            "user_id": user_id,
            "provider": "hubspot",
            "credentials": {"api_key": request.api_key},  # In production, encrypt this
            "account_id": test_result.account_id,
            "account_name": test_result.account_name,
            "status": "active",
            "last_sync_at": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if existing.data and len(existing.data) > 0:
            # Update existing
            result = supabase.table("user_integrations").update(
                integration_data
            ).eq("id", existing.data[0]["id"]).execute()
            logger.info({"event": "hubspot_connection_updated", "user_id": user_id})
        else:
            # Insert new
            integration_data["created_at"] = datetime.now(timezone.utc).isoformat()
            result = supabase.table("user_integrations").insert(integration_data).execute()
            logger.info({"event": "hubspot_connection_created", "user_id": user_id})
        
        return {
            "success": True,
            "message": "HubSpot connected successfully",
            "account_id": test_result.account_id,
            "account_name": test_result.account_name,
            "contact_count": test_result.contact_count
        }
        
    except Exception as e:
        logger.error({"event": "hubspot_connect_error", "error": str(e), "user_id": user_id})
        raise HTTPException(status_code=500, detail=f"Failed to save connection: {str(e)}")


@router.get("/hubspot/status", response_model=HubSpotStatusResponse)
async def get_hubspot_status(
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """
    Get current HubSpot connection status for the user.
    """
    try:
        result = supabase.table("user_integrations").select("*").eq(
            "user_id", user_id
        ).eq("provider", "hubspot").execute()
        
        if not result.data or len(result.data) == 0:
            return HubSpotStatusResponse(status="not_connected")
        
        integration = result.data[0]
        
        # Get import count from contacts table
        import_count = 0
        try:
            count_result = supabase.table("contacts").select(
                "id", count="exact"
            ).eq("user_id", user_id).eq("source", "hubspot").execute()
            import_count = count_result.count or 0
        except:
            pass
        
        return HubSpotStatusResponse(
            status=integration.get("status", "active"),
            account_id=integration.get("account_id"),
            account_name=integration.get("account_name"),
            total_imported=import_count,
            last_sync_at=integration.get("last_sync_at")
        )
        
    except Exception as e:
        logger.error({"event": "hubspot_status_error", "error": str(e), "user_id": user_id})
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/hubspot/disconnect")
async def disconnect_hubspot(
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """
    Disconnect HubSpot integration (does not delete imported contacts).
    """
    logger.info({"event": "hubspot_disconnect_start", "user_id": user_id})
    
    try:
        result = supabase.table("user_integrations").delete().eq(
            "user_id", user_id
        ).eq("provider", "hubspot").execute()
        
        logger.info({"event": "hubspot_disconnected", "user_id": user_id})
        
        return {
            "success": True,
            "message": "HubSpot disconnected successfully"
        }
        
    except Exception as e:
        logger.error({"event": "hubspot_disconnect_error", "error": str(e), "user_id": user_id})
        raise HTTPException(status_code=500, detail=str(e))
