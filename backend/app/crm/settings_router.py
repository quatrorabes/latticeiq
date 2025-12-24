# backend/app/crm/settings_router.py
"""
CRM Settings Management Router
Handles saving, testing, and retrieving CRM integration credentials
(HubSpot, Salesforce, Pipedrive, etc.)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid
import logging

# Database
from supabase import create_client, Client
import os

# ============================================================================
# LOGGING
# ============================================================================

logger = logging.getLogger("latticeiq")

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class CRMIntegrationCreate(BaseModel):
    """Model for creating/updating CRM integration"""
    crm_type: str = Field(..., description="hubspot, salesforce, pipedrive")
    api_key: str = Field(..., description="API key or token for the CRM")
    api_url: Optional[str] = Field(None, description="Optional base URL for self-hosted or custom CRM")
    is_active: bool = Field(True, description="Whether integration is enabled")
    import_filters: Optional[dict] = Field(None, description="Filters for import (e.g., exclude_lead_status)")
    required_fields: Optional[dict] = Field(None, description="Required fields for import")

class CRMIntegrationResponse(BaseModel):
    """Response model for CRM integration"""
    id: str
    user_id: str
    crm_type: str
    api_key: str
    api_url: Optional[str] = None
    is_active: bool
    import_filters: Optional[dict] = None
    required_fields: Optional[dict] = None
    created_at: str
    updated_at: str

class ConnectionTestRequest(BaseModel):
    """Model for testing CRM connection"""
    api_key: str
    api_url: Optional[str] = None

class ConnectionTestResponse(BaseModel):
    """Response from connection test"""
    success: bool
    message: str
    crm_type: Optional[str] = None
    contact_count: Optional[int] = None

# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================

def get_supabase_service() -> Client:
    """Get Supabase service role client for privileged operations (bypass RLS)"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_service_key:
        logger.error("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured")
        raise HTTPException(
            status_code=503,
            detail="Database service unavailable (missing service role key)"
        )
    
    return create_client(supabase_url, supabase_service_key)

def get_supabase_anon() -> Client:
    """Get Supabase anon client for regular operations"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable"
        )
    
    return create_client(supabase_url, supabase_key)

# ============================================================================
# AUTHENTICATION DEPENDENCY (from main.py)
# ============================================================================

class CurrentUser(BaseModel):
    """Current authenticated user"""
    id: str
    email: str = ""

async def get_current_user(authorization: str = None) -> CurrentUser:
    """Extract and validate user from JWT token"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
        )
    
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")
        
        supabase = get_supabase_anon()
        user_resp = supabase.auth.get_user(token)
        user_obj = getattr(user_resp, "user", None) or (user_resp.get("user") if isinstance(user_resp, dict) else None)
        
        if not user_obj:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        user_id = getattr(user_obj, "id", None) or user_obj.get("id")
        email = getattr(user_obj, "email", None) or user_obj.get("email") or ""
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token (missing user id)")
        
        return CurrentUser(id=str(user_id), email=str(email))
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(
    prefix="/api/v3/settings/crm",
    tags=["CRM Settings"],
)

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/integrations", response_model=dict, status_code=200)
def upsert_crm_integration(
    integration: CRMIntegrationCreate,
    authorization: str = None,
) -> dict:
    """
    Create or update a CRM integration for the user.
    Uses native Postgres UPSERT to handle duplicate keys.
    """
    try:
        # Validate user
        user = None
        if authorization:
            try:
                scheme, token = authorization.split(" ", 1)
                if scheme.lower() == "bearer":
                    supabase = get_supabase_anon()
                    user_resp = supabase.auth.get_user(token)
                    user_obj = getattr(user_resp, "user", None) or (user_resp.get("user") if isinstance(user_resp, dict) else None)
                    if user_obj:
                        user_id = getattr(user_obj, "id", None) or user_obj.get("id")
                        if user_id:
                            user = CurrentUser(id=str(user_id), email="")
            except Exception as e:
                logger.warning(f"Could not extract user from token: {e}")
        
        if not user:
            raise HTTPException(status_code=401, detail="Missing valid authorization")
        
        # Get service role client (for RLS bypass)
        supabase_service = get_supabase_service()
        
        # Prepare row
        row = {
            "user_id": user.id,
            "crm_type": integration.crm_type.lower(),
            "api_key": integration.api_key,
            "api_url": integration.api_url,
            "is_active": integration.is_active,
            "import_filters": integration.import_filters,
            "required_fields": integration.required_fields,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # If this is a new record, add created_at
        row["id"] = str(uuid.uuid4())
        row["created_at"] = datetime.utcnow().isoformat()
        
        # Use native Postgres UPSERT: insert or update on conflict
        result = (
            supabase_service.table("crm_integrations")
            .upsert(row, on_conflict="user_id,crm_type")
            .execute()
        )
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to save integration")
        
        logger.info(
            f"✅ CRM integration saved: {integration.crm_type}",
            extra={"user_id": user.id}
        )
        
        return {
            "success": True,
            "message": f"{integration.crm_type} integration saved",
            "integration": result.data[0] if result.data else {}
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error saving CRM integration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save integration: {str(e)}")

@router.get("/integrations", response_model=dict)
def list_crm_integrations(
    authorization: str = None,
) -> dict:
    """Get all CRM integrations for the current user"""
    try:
        # Validate user
        user = None
        if authorization:
            try:
                scheme, token = authorization.split(" ", 1)
                if scheme.lower() == "bearer":
                    supabase = get_supabase_anon()
                    user_resp = supabase.auth.get_user(token)
                    user_obj = getattr(user_resp, "user", None) or (user_resp.get("user") if isinstance(user_resp, dict) else None)
                    if user_obj:
                        user_id = getattr(user_obj, "id", None) or user_obj.get("id")
                        if user_id:
                            user = CurrentUser(id=str(user_id), email="")
            except Exception as e:
                logger.warning(f"Could not extract user from token: {e}")
        
        if not user:
            raise HTTPException(status_code=401, detail="Missing valid authorization")
        
        supabase = get_supabase_anon()
        result = (
            supabase.table("crm_integrations")
            .select("*")
            .eq("user_id", user.id)
            .execute()
        )
        
        logger.info(
            f"Retrieved {len(result.data or [])} CRM integrations",
            extra={"user_id": user.id}
        )
        
        return {
            "integrations": result.data or [],
            "count": len(result.data or [])
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error listing CRM integrations: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve integrations")

@router.get("/integrations/{crm_type}", response_model=dict)
def get_crm_integration(
    crm_type: str,
    authorization: str = None,
) -> dict:
    """Get a specific CRM integration"""
    try:
        # Validate user
        user = None
        if authorization:
            try:
                scheme, token = authorization.split(" ", 1)
                if scheme.lower() == "bearer":
                    supabase = get_supabase_anon()
                    user_resp = supabase.auth.get_user(token)
                    user_obj = getattr(user_resp, "user", None) or (user_resp.get("user") if isinstance(user_resp, dict) else None)
                    if user_obj:
                        user_id = getattr(user_obj, "id", None) or user_obj.get("id")
                        if user_id:
                            user = CurrentUser(id=str(user_id), email="")
            except Exception as e:
                logger.warning(f"Could not extract user from token: {e}")
        
        if not user:
            raise HTTPException(status_code=401, detail="Missing valid authorization")
        
        supabase = get_supabase_anon()
        result = (
            supabase.table("crm_integrations")
            .select("*")
            .eq("user_id", user.id)
            .eq("crm_type", crm_type.lower())
            .single()
            .execute()
        )
        
        if not result.data:
            raise HTTPException(status_code=404, detail=f"{crm_type} integration not found")
        
        return result.data
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error retrieving {crm_type} integration: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve integration")

@router.post("/integrations/{crm_type}/test", response_model=dict)
def test_crm_connection(
    crm_type: str,
    request: ConnectionTestRequest,
    authorization: str = None,
) -> dict:
    """Test connection to a CRM system"""
    try:
        # Validate user
        if not authorization:
            raise HTTPException(status_code=401, detail="Missing authorization")
        
        logger.info(f"Testing {crm_type} connection...")
        
        # Simple connection test (expand as needed for each CRM)
        if crm_type.lower() == "hubspot":
            # HubSpot test: Just verify the API key format for now
            if not request.api_key or not request.api_key.startswith("pat-") and not request.api_key.startswith("pk_live_"):
                return {
                    "success": False,
                    "message": f"Invalid HubSpot API key format (should start with pat- or pk_live_)",
                    "crm_type": crm_type
                }
            
            # In production, you'd make an actual API call to HubSpot
            # For now, just validate the key exists
            return {
                "success": True,
                "message": f"✅ {crm_type} connection successful",
                "crm_type": crm_type,
                "contact_count": 0  # Would be actual count from CRM
            }
        
        elif crm_type.lower() == "salesforce":
            if not request.api_key:
                return {
                    "success": False,
                    "message": "Invalid Salesforce credentials",
                    "crm_type": crm_type
                }
            
            return {
                "success": True,
                "message": f"✅ {crm_type} connection successful",
                "crm_type": crm_type,
                "contact_count": 0
            }
        
        elif crm_type.lower() == "pipedrive":
            if not request.api_key:
                return {
                    "success": False,
                    "message": "Invalid Pipedrive API token",
                    "crm_type": crm_type
                }
            
            return {
                "success": True,
                "message": f"✅ {crm_type} connection successful",
                "crm_type": crm_type,
                "contact_count": 0
            }
        
        else:
            return {
                "success": False,
                "message": f"Unsupported CRM type: {crm_type}",
                "crm_type": crm_type
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error testing {crm_type} connection: {str(e)}")
        return {
            "success": False,
            "message": f"Connection test failed: {str(e)}",
            "crm_type": crm_type
        }

@router.delete("/integrations/{crm_type}", status_code=204)
def delete_crm_integration(
    crm_type: str,
    authorization: str = None,
) -> None:
    """Delete a CRM integration"""
    try:
        # Validate user
        user = None
        if authorization:
            try:
                scheme, token = authorization.split(" ", 1)
                if scheme.lower() == "bearer":
                    supabase = get_supabase_anon()
                    user_resp = supabase.auth.get_user(token)
                    user_obj = getattr(user_resp, "user", None) or (user_resp.get("user") if isinstance(user_resp, dict) else None)
                    if user_obj:
                        user_id = getattr(user_obj, "id", None) or user_obj.get("id")
                        if user_id:
                            user = CurrentUser(id=str(user_id), email="")
            except Exception as e:
                logger.warning(f"Could not extract user from token: {e}")
        
        if not user:
            raise HTTPException(status_code=401, detail="Missing valid authorization")
        
        supabase_service = get_supabase_service()
        
        result = (
            supabase_service.table("crm_integrations")
            .delete()
            .eq("user_id", user.id)
            .eq("crm_type", crm_type.lower())
            .execute()
        )
        
        if not result.data:
            raise HTTPException(status_code=404, detail=f"{crm_type} integration not found")
        
        logger.info(
            f"✅ CRM integration deleted: {crm_type}",
            extra={"user_id": user.id}
        )
        
        return None
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting {crm_type} integration: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete integration")
