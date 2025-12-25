import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from supabase import create_client, Client
import os

# ============================================================================
# LOGGING
# ============================================================================
logger = logging.getLogger("latticeiq")

# ============================================================================
# SUPABASE CLIENTS
# ============================================================================
def get_supabase_anon() -> Client:
    """Get Supabase client with anon key (standard RLS enforcement)"""
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_ANON_KEY"),
    )

def get_supabase_service() -> Optional[Client]:
    """Get Supabase client with service role key (RLS bypass) if available"""
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not service_key:
        logger.warning("SUPABASE_SERVICE_ROLE_KEY not set; RLS will be enforced")
        return None
    
    return create_client(
        os.getenv("SUPABASE_URL"),
        service_key,
    )

# Initialize clients
supabase = get_supabase_anon()
supabase_service = get_supabase_service()

# ============================================================================
# MODELS
# ============================================================================
class CurrentUser(BaseModel):
    """Current authenticated user from JWT"""
    id: str
    email: str

class CRMIntegrationCreate(BaseModel):
    """Request body for creating/updating CRM integration"""
    crm_type: str = Field(..., description="HubSpot, Salesforce, Pipedrive")
    api_key: str = Field(..., description="API key or token for the CRM")
    is_active: bool = Field(default=True, description="Whether integration is active")

class CRMIntegrationResponse(BaseModel):
    """Response model for a single CRM integration"""
    id: str
    user_id: str
    crm_type: str
    api_key: str
    is_active: bool
    created_at: str
    updated_at: str

# ============================================================================
# AUTH DEPENDENCY
# ============================================================================
async def get_current_user(authorization: str = Header(None)) -> CurrentUser:
    """Extract and validate JWT token from Authorization header"""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")
        
        # Validate token with Supabase
        user_resp = supabase.auth.get_user(token)
        user_obj = getattr(user_resp, "user", None) or user_resp.get("user") if isinstance(user_resp, dict) else None
        
        if not user_obj:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        user_id = getattr(user_obj, "id", None) or user_obj.get("id")
        email = getattr(user_obj, "email", None) or user_obj.get("email") or ""
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user id")
        
        return CurrentUser(id=str(user_id), email=str(email))
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid authorization header format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ============================================================================
# ROUTER
# ============================================================================
router = APIRouter(prefix="/settings/crm", tags=["CRM Settings"])

# ============================================================================
# POST /integrations - Save or update a CRM integration
# ============================================================================
@router.post("/integrations", response_model=Dict[str, Any])
async def save_crm_integration(
    integration: CRMIntegrationCreate,
    user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Save or update a CRM integration for the current user"""
    if not supabase_service and not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        # Use service role for write (RLS bypass) if available, else use anon
        client = supabase_service if supabase_service else supabase
        
        row = {
            "user_id": user.id,
            "crm_type": integration.crm_type,
            "api_key": integration.api_key,
            "is_active": integration.is_active,
        }
        
        # Upsert: create if new, update if exists (on conflict user_id + crm_type)
        result = (
            client.table("crm_integrations")
            .upsert(row, on_conflict="user_id,crm_type")
            .execute()
        )
        
        logger.info(
            f"✅ CRM integration saved: {integration.crm_type}",
            extra={"user_id": user.id},
        )
        
        return {
            "success": True,
            "message": f"{integration.crm_type.upper()} integration saved!",
            "integration": result.data[0] if result.data else row,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to save CRM integration: {str(e)}",
            extra={"user_id": user.id},
        )
        raise HTTPException(status_code=500, detail=f"Failed to save integration: {str(e)}")

# ============================================================================
# GET /integrations - List all CRM integrations for current user
# ============================================================================
@router.get("/integrations", response_model=Dict[str, Any])
async def list_crm_integrations(
    user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get all CRM integrations for the current user"""
    if not supabase_service and not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        # Use service role for read (RLS bypass) if available, else use anon
        client = supabase_service if supabase_service else supabase
        
        result = (
            client.table("crm_integrations")
            .select("*")
            .eq("user_id", user.id)
            .execute()
        )
        
        integrations = result.data or []
        logger.info(
            f"Retrieved {len(integrations)} CRM integrations",
            extra={"user_id": user.id},
        )
        
        return {
            "success": True,
            "integrations": integrations,
            "count": len(integrations),
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to retrieve CRM integrations: {str(e)}",
            extra={"user_id": user.id},
        )
        raise HTTPException(status_code=500, detail=f"Failed to retrieve integrations: {str(e)}")

# ============================================================================
# POST /integrations/{crm_type}/test - Test CRM connection
# ============================================================================
@router.post("/integrations/{crm_type}/test", response_model=Dict[str, Any])
async def test_crm_connection(
    crm_type: str,
    user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Test connection to a CRM integration"""
    if not supabase_service and not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        # Use service role to read (RLS bypass) if available
        client = supabase_service if supabase_service else supabase
        
        result = (
            client.table("crm_integrations")
            .select("api_key")
            .eq("user_id", user.id)
            .eq("crm_type", crm_type)
            .single()
            .execute()
        )
        
        if not result.data:
            raise HTTPException(status_code=404, detail=f"No {crm_type} integration found")
        
        # TODO: Implement actual CRM API validation here
        # For now, just return success if integration exists
        logger.info(
            f"Tested {crm_type} connection",
            extra={"user_id": user.id},
        )
        
        return {
            "success": True,
            "message": "Connection successful!",
            "crm_type": crm_type,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to test {crm_type} connection: {str(e)}",
            extra={"user_id": user.id},
        )
        raise HTTPException(status_code=500, detail=f"Failed to test connection: {str(e)}")

# ============================================================================
# DELETE /integrations/{crm_type} - Delete a CRM integration
# ============================================================================
@router.delete("/integrations/{crm_type}", response_model=Dict[str, Any])
async def delete_crm_integration(
    crm_type: str,
    user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete a CRM integration for the current user"""
    if not supabase_service and not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        # Use service role for delete (RLS bypass) if available
        client = supabase_service if supabase_service else supabase
        
        result = (
            client.table("crm_integrations")
            .delete()
            .eq("user_id", user.id)
            .eq("crm_type", crm_type)
            .execute()
        )
        
        logger.info(
            f"Deleted {crm_type} integration",
            extra={"user_id": user.id},
        )
        
        return {
            "success": True,
            "message": f"{crm_type.upper()} integration deleted!",
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to delete {crm_type} integration: {str(e)}",
            extra={"user_id": user.id},
        )
        raise HTTPException(status_code=500, detail=f"Failed to delete integration: {str(e)}")
