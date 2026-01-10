# ============================================================================
# FILE: backend/app/routers/integrations_router.py
# PURPOSE: Manage CRM integrations (connect, test, disconnect, settings)
# VERSION: 1.1.0 - Fixed .single() crash when no integration exists
# ============================================================================

from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from enum import Enum
import logging
import httpx
import uuid

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
    """Extract user ID from JWT token."""
    import jwt
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

class IntegrationProvider(str, Enum):
    HUBSPOT = "hubspot"
    SALESFORCE = "salesforce"
    PIPEDRIVE = "pipedrive"
    GOOGLE_CONTACTS = "google_contacts"
    MICROSOFT_CONTACTS = "microsoft_contacts"


class IntegrationStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    EXPIRED = "expired"
    ERROR = "error"


class ConnectHubSpotRequest(BaseModel):
    """Request to connect HubSpot using Private App token."""
    api_key: str = Field(..., min_length=10, description="HubSpot Private App access token")


class ConnectPipedriveRequest(BaseModel):
    """Request to connect Pipedrive."""
    api_key: str = Field(..., min_length=10, description="Pipedrive API token")


class UpdateIntegrationSettingsRequest(BaseModel):
    """Update integration settings."""
    default_filters: Optional[Dict[str, Any]] = None
    field_mapping: Optional[Dict[str, str]] = None


class IntegrationResponse(BaseModel):
    """Response model for integration details."""
    id: str
    provider: str
    status: str
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    account_email: Optional[str] = None
    last_sync_at: Optional[str] = None
    last_sync_status: Optional[str] = None
    last_sync_count: int = 0
    total_imported: int = 0
    default_filters: Dict[str, Any] = {}
    field_mapping: Dict[str, str] = {}
    created_at: str
    updated_at: str


class IntegrationTestResult(BaseModel):
    """Result of testing an integration connection."""
    success: bool
    provider: str
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    account_email: Optional[str] = None
    contact_count: Optional[int] = None
    error: Optional[str] = None
    features: Dict[str, bool] = {}


# ============================================================================
# HUBSPOT CLIENT
# ============================================================================

class HubSpotClient:
    """HubSpot API client for testing and account info."""
    
    BASE_URL = "https://api.hubapi.com"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def test_connection(self) -> IntegrationTestResult:
        """Test the connection and get account info."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # Get account info
                account_resp = await client.get(
                    f"{self.BASE_URL}/account-info/v3/details",
                    headers=self.headers
                )
                
                if account_resp.status_code == 401:
                    return IntegrationTestResult(
                        success=False,
                        provider="hubspot",
                        error="Invalid API key - check your Private App token"
                    )
                
                if account_resp.status_code != 200:
                    return IntegrationTestResult(
                        success=False,
                        provider="hubspot",
                        error=f"API error: {account_resp.status_code}"
                    )
                
                account_data = account_resp.json()
                portal_id = str(account_data.get("portalId", ""))
                
                # Get contact count
                contacts_resp = await client.post(
                    f"{self.BASE_URL}/crm/v3/objects/contacts/search",
                    headers=self.headers,
                    json={"limit": 1}
                )
                
                contact_count = 0
                if contacts_resp.status_code == 200:
                    contact_count = contacts_resp.json().get("total", 0)
                
                # Check available features
                features = {
                    "contacts": True,
                    "companies": True,
                    "deals": True,
                    "lists": await self._check_feature(client, "/crm/v3/lists"),
                }
                
                return IntegrationTestResult(
                    success=True,
                    provider="hubspot",
                    account_id=portal_id,
                    account_name=account_data.get("companyName", f"Portal {portal_id}"),
                    contact_count=contact_count,
                    features=features
                )
                
            except httpx.TimeoutException:
                return IntegrationTestResult(
                    success=False,
                    provider="hubspot",
                    error="Connection timeout - try again"
                )
            except Exception as e:
                logger.error(f"HubSpot test error: {e}")
                return IntegrationTestResult(
                    success=False,
                    provider="hubspot",
                    error=str(e)
                )
    
    async def _check_feature(self, client: httpx.AsyncClient, endpoint: str) -> bool:
        """Check if a feature/endpoint is accessible."""
        try:
            resp = await client.get(
                f"{self.BASE_URL}{endpoint}",
                headers=self.headers,
                params={"limit": 1}
            )
            return resp.status_code == 200
        except:
            return False


# ============================================================================
# PIPEDRIVE CLIENT
# ============================================================================

class PipedriveClient:
    """Pipedrive API client for testing and account info."""
    
    BASE_URL = "https://api.pipedrive.com/v1"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def test_connection(self) -> IntegrationTestResult:
        """Test the connection and get account info."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # Get user info
                user_resp = await client.get(
                    f"{self.BASE_URL}/users/me",
                    params={"api_token": self.api_key}
                )
                
                if user_resp.status_code == 401:
                    return IntegrationTestResult(
                        success=False,
                        provider="pipedrive",
                        error="Invalid API key"
                    )
                
                if user_resp.status_code != 200:
                    return IntegrationTestResult(
                        success=False,
                        provider="pipedrive",
                        error=f"API error: {user_resp.status_code}"
                    )
                
                user_data = user_resp.json().get("data", {})
                
                # Get persons (contacts) count
                persons_resp = await client.get(
                    f"{self.BASE_URL}/persons",
                    params={"api_token": self.api_key, "limit": 1}
                )
                
                contact_count = 0
                if persons_resp.status_code == 200:
                    contact_count = persons_resp.json().get("additional_data", {}).get("pagination", {}).get("total_count", 0)
                
                return IntegrationTestResult(
                    success=True,
                    provider="pipedrive",
                    account_id=str(user_data.get("company_id", "")),
                    account_name=user_data.get("company_name", ""),
                    account_email=user_data.get("email", ""),
                    contact_count=contact_count,
                    features={
                        "persons": True,
                        "organizations": True,
                        "deals": True,
                        "activities": True
                    }
                )
                
            except httpx.TimeoutException:
                return IntegrationTestResult(
                    success=False,
                    provider="pipedrive",
                    error="Connection timeout"
                )
            except Exception as e:
                logger.error(f"Pipedrive test error: {e}")
                return IntegrationTestResult(
                    success=False,
                    provider="pipedrive",
                    error=str(e)
                )


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/health")
async def integrations_health():
    """Health check for integrations service."""
    return {
        "status": "operational",
        "service": "integrations",
        "version": "1.1.0",
        "supported_providers": [p.value for p in IntegrationProvider],
        "features": ["connect", "test", "disconnect", "settings"]
    }


@router.get("", response_model=List[IntegrationResponse])
async def list_integrations(
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """List all integrations for the current user."""
    try:
        result = supabase.table("user_integrations")\
            .select("*")\
            .eq("user_id", user_id)\
            .execute()
        
        integrations = []
        for row in (result.data or []):
            integrations.append(IntegrationResponse(
                id=row["id"],
                provider=row["provider"],
                status=row["status"],
                account_id=row.get("account_id"),
                account_name=row.get("account_name"),
                account_email=row.get("account_email"),
                last_sync_at=row.get("last_sync_at"),
                last_sync_status=row.get("last_sync_status"),
                last_sync_count=row.get("last_sync_count", 0),
                total_imported=row.get("total_imported", 0),
                default_filters=row.get("default_filters", {}),
                field_mapping=row.get("field_mapping", {}),
                created_at=row["created_at"],
                updated_at=row["updated_at"]
            ))
        
        return integrations
        
    except Exception as e:
        logger.error(f"Failed to list integrations: {e}")
        raise HTTPException(status_code=500, detail="Failed to list integrations")


@router.get("/{provider}", response_model=IntegrationResponse)
async def get_integration(
    provider: IntegrationProvider,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """Get a specific integration."""
    try:
        # FIX: Don't use .single() - it crashes when no rows exist
        # Instead, fetch without .single() and check manually
        result = supabase.table("user_integrations")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("provider", provider.value)\
            .execute()
        
        # Check if we got any results
        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=404, 
                detail=f"{provider.value} integration not found. Please connect it first."
            )
        
        row = result.data[0]  # Get first (and should be only) result
        return IntegrationResponse(
            id=row["id"],
            provider=row["provider"],
            status=row["status"],
            account_id=row.get("account_id"),
            account_name=row.get("account_name"),
            account_email=row.get("account_email"),
            last_sync_at=row.get("last_sync_at"),
            last_sync_status=row.get("last_sync_status"),
            last_sync_count=row.get("last_sync_count", 0),
            total_imported=row.get("total_imported", 0),
            default_filters=row.get("default_filters", {}),
            field_mapping=row.get("field_mapping", {}),
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get integration: {e}")
        raise HTTPException(status_code=500, detail="Failed to get integration")


@router.post("/hubspot/connect", response_model=IntegrationTestResult)
async def connect_hubspot(
    request: ConnectHubSpotRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """
    Connect HubSpot using Private App access token.
    
    To get your token:
    1. Go to HubSpot Settings → Integrations → Private Apps
    2. Create a new Private App
    3. Grant scopes: crm.objects.contacts.read, crm.objects.companies.read
    4. Copy the access token
    """
    # Test connection first
    client = HubSpotClient(request.api_key)
    test_result = await client.test_connection()
    
    if not test_result.success:
        return test_result
    
    # Save or update integration
    try:
        now = datetime.now(timezone.utc).isoformat()
        
        # Check if exists (without .single())
        existing = supabase.table("user_integrations")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("provider", "hubspot")\
            .execute()
        
        integration_data = {
            "user_id": user_id,
            "provider": "hubspot",
            "status": "connected",
            "api_key": request.api_key,
            "account_id": test_result.account_id,
            "account_name": test_result.account_name,
            "updated_at": now
        }
        
        if existing.data and len(existing.data) > 0:
            # Update existing
            supabase.table("user_integrations")\
                .update(integration_data)\
                .eq("user_id", user_id)\
                .eq("provider", "hubspot")\
                .execute()
            logger.info(f"HubSpot updated for user {user_id}")
        else:
            # Create new
            integration_data["id"] = str(uuid.uuid4())
            integration_data["created_at"] = now
            supabase.table("user_integrations").insert(integration_data).execute()
            logger.info(f"HubSpot connected for user {user_id}")
        
        return test_result
        
    except Exception as e:
        logger.error(f"Failed to save HubSpot integration: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save integration: {str(e)}")


@router.post("/hubspot/test", response_model=IntegrationTestResult)
async def test_hubspot_connection(
    request: ConnectHubSpotRequest
):
    """Test HubSpot connection without saving."""
    client = HubSpotClient(request.api_key)
    return await client.test_connection()


@router.post("/pipedrive/connect", response_model=IntegrationTestResult)
async def connect_pipedrive(
    request: ConnectPipedriveRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """
    Connect Pipedrive using API token.
    
    To get your token:
    1. Go to Pipedrive Settings → Personal preferences → API
    2. Copy your personal API token
    """
    # Test connection first
    client = PipedriveClient(request.api_key)
    test_result = await client.test_connection()
    
    if not test_result.success:
        return test_result
    
    # Save or update integration
    try:
        now = datetime.now(timezone.utc).isoformat()
        
        existing = supabase.table("user_integrations")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("provider", "pipedrive")\
            .execute()
        
        integration_data = {
            "user_id": user_id,
            "provider": "pipedrive",
            "status": "connected",
            "api_key": request.api_key,
            "account_id": test_result.account_id,
            "account_name": test_result.account_name,
            "account_email": test_result.account_email,
            "updated_at": now
        }
        
        if existing.data and len(existing.data) > 0:
            supabase.table("user_integrations")\
                .update(integration_data)\
                .eq("user_id", user_id)\
                .eq("provider", "pipedrive")\
                .execute()
        else:
            integration_data["id"] = str(uuid.uuid4())
            integration_data["created_at"] = now
            supabase.table("user_integrations").insert(integration_data).execute()
        
        logger.info(f"Pipedrive connected for user {user_id}")
        return test_result
        
    except Exception as e:
        logger.error(f"Failed to save Pipedrive integration: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save integration: {str(e)}")


@router.post("/pipedrive/test", response_model=IntegrationTestResult)
async def test_pipedrive_connection(
    request: ConnectPipedriveRequest
):
    """Test Pipedrive connection without saving."""
    client = PipedriveClient(request.api_key)
    return await client.test_connection()


@router.delete("/{provider}")
async def disconnect_integration(
    provider: IntegrationProvider,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """Disconnect an integration."""
    try:
        result = supabase.table("user_integrations")\
            .delete()\
            .eq("user_id", user_id)\
            .eq("provider", provider.value)\
            .execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Integration not found")
        
        logger.info(f"{provider.value} disconnected for user {user_id}")
        
        return {
            "success": True,
            "message": f"{provider.value} integration disconnected"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to disconnect {provider.value}: {e}")
        raise HTTPException(status_code=500, detail="Failed to disconnect integration")


@router.patch("/{provider}/settings")
async def update_integration_settings(
    provider: IntegrationProvider,
    request: UpdateIntegrationSettingsRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """Update integration settings (default filters, field mapping)."""
    try:
        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        
        if request.default_filters is not None:
            update_data["default_filters"] = request.default_filters
        
        if request.field_mapping is not None:
            update_data["field_mapping"] = request.field_mapping
        
        result = supabase.table("user_integrations")\
            .update(update_data)\
            .eq("user_id", user_id)\
            .eq("provider", provider.value)\
            .execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Integration not found")
        
        return {
            "success": True,
            "message": "Settings updated",
            "settings": {
                "default_filters": result.data[0].get("default_filters", {}),
                "field_mapping": result.data[0].get("field_mapping", {})
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to update settings")


@router.get("/{provider}/status")
async def check_integration_status(
    provider: IntegrationProvider,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """Check current status of an integration (test saved credentials)."""
    try:
        # FIX: Don't use .single() - handle empty results gracefully
        result = supabase.table("user_integrations")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("provider", provider.value)\
            .execute()
        
        if not result.data or len(result.data) == 0:
            return {
                "provider": provider.value,
                "connected": False,
                "status": "not_configured",
                "message": "Integration not set up"
            }
        
        row = result.data[0]
        api_key = row.get("api_key")
        
        if not api_key:
            return {
                "provider": provider.value,
                "connected": False,
                "status": "missing_credentials",
                "message": "API key not found"
            }
        
        # Test the connection
        if provider == IntegrationProvider.HUBSPOT:
            client = HubSpotClient(api_key)
        elif provider == IntegrationProvider.PIPEDRIVE:
            client = PipedriveClient(api_key)
        else:
            return {
                "provider": provider.value,
                "connected": False,
                "status": "unsupported",
                "message": f"{provider.value} status check not implemented"
            }
        
        test_result = await client.test_connection()
        
        # Update status in DB
        new_status = "connected" if test_result.success else "error"
        supabase.table("user_integrations")\
            .update({"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()})\
            .eq("user_id", user_id)\
            .eq("provider", provider.value)\
            .execute()
        
        return {
            "provider": provider.value,
            "connected": test_result.success,
            "status": new_status,
            "account_name": test_result.account_name,
            "account_id": test_result.account_id,
            "contact_count": test_result.contact_count,
            "error": test_result.error,
            "last_sync_at": row.get("last_sync_at"),
            "total_imported": row.get("total_imported", 0)
        }
        
    except Exception as e:
        logger.error(f"Failed to check status: {e}")
        raise HTTPException(status_code=500, detail="Failed to check integration status")
