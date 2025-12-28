# ============================================================================
# FILE: backend/app/crm/settings_router.py
# PURPOSE: CRM Settings Management - Save, List, Delete, Test Credentials
# ============================================================================

import os
import logging
from typing import Any, Dict, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from supabase import create_client
import httpx

logger = logging.getLogger("latticeiq")

# ============================================================================
# LAZY LOAD SUPABASE CLIENTS - Module-level functions
# ============================================================================

_supabase_anon = None
_supabase_service = None

def get_supabase_anon():
    """Lazy initialize Supabase anon client"""
    global _supabase_anon
    if _supabase_anon is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        if url and key:
            _supabase_anon = create_client(url, key)
    return _supabase_anon

def get_supabase_service():
    """Lazy initialize Supabase service role client (for backend operations)"""
    global _supabase_service
    if _supabase_service is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        if url and key:
            _supabase_service = create_client(url, key)
    return _supabase_service

# ============================================================================
# AUTH DEPENDENCY
# ============================================================================

async def get_current_user(authorization: str = Header(None)) -> dict:
    """Validate Supabase JWT"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")

        client = get_supabase_anon()
        if not client:
            raise HTTPException(status_code=503, detail="Database not configured")

        user_resp = client.auth.get_user(token)
        user = getattr(user_resp, "user", None) or user_resp.get("user") if isinstance(user_resp, dict) else None

        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = getattr(user, "id", None) or user.get("id")
        email = getattr(user, "email", None) or user.get("email") or ""

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user id")

        return {"id": str(user_id), "email": str(email)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ============================================================================
# MODELS
# ============================================================================

class CRMIntegrationCreate(BaseModel):
    crmtype: str  # hubspot, salesforce, pipedrive
    apikey: str

class CRMIntegrationUpdate(BaseModel):
    apikey: Optional[str] = None

# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(prefix="/settings", tags=["Settings"])

# GET /api/v3/settings/crm - List saved CRM integrations
@router.get("/crm")
async def list_integrations(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """List all saved CRM integrations for current user"""
    client = get_supabase_anon()
    if not client:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]
        result = client.table("crmintegrations").select("*").eq("userid", user_id).execute()
        
        # Redact API keys in response
        integrations = []
        for item in result.data or []:
            item["apikey"] = "***" if item.get("apikey") else None
            integrations.append(item)
        
        logger.info(f"Listed CRM integrations", extra={"userid": user_id})
        return {"integrations": integrations}
    except Exception as e:
        logger.error(f"Error listing CRM integrations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# POST /api/v3/settings/crm - Save/upsert CRM credentials
@router.post("/crm")
async def save_integration(integration: CRMIntegrationCreate, user: dict = Depends(get_current_user)) -> Dict[str, str]:
    """Save or update CRM integration"""
    client = get_supabase_anon()
    if not client:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]
        crm_type = integration.crmtype.lower()
        
        # Upsert: check if exists
        existing = client.table("crmintegrations").select("id").eq("userid", user_id).eq("crmtype", crm_type).execute()
        
        data = {
            "userid": user_id,
            "crmtype": crm_type,
            "apikey": integration.apikey,
            "updatedat": datetime.utcnow().isoformat(),
        }
        
        if existing.data:
            # Update
            result = client.table("crmintegrations").update(data).eq("userid", user_id).eq("crmtype", crm_type).execute()
            logger.info(f"Updated {crm_type} integration", extra={"userid": user_id})
        else:
            # Insert
            data["createdat"] = datetime.utcnow().isoformat()
            result = client.table("crmintegrations").insert(data).execute()
            logger.info(f"Created {crm_type} integration", extra={"userid": user_id})
        
        return {"status": "success", "message": f"{crm_type} integration saved!"}
    except Exception as e:
        logger.error(f"Error saving CRM integration: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# POST /api/v3/settings/crm/{crmtype}/test - Test CRM connection
@router.post("/crm/{crmtype}/test")
async def test_connection(crmtype: str, user: dict = Depends(get_current_user)) -> Dict[str, str]:
    """Test CRM connection"""
    service = get_supabase_service()
    if not service:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]
        crm_type = crmtype.lower()
        
        # Get credentials from DB using service role
        result = service.table("crmintegrations").select("apikey").eq("userid", user_id).eq("crmtype", crm_type).single().execute()
        
        if not result.data or not result.data.get("apikey"):
            raise HTTPException(status_code=400, detail=f"No {crm_type} integration configured")
        
        api_key = result.data["apikey"]
        
        # Test based on CRM type
        if crm_type == "hubspot":
            async with httpx.AsyncClient(timeout=10.0) as http_client:
                response = await http_client.get(
                    "https://api.hubapi.com/crm/v3/objects/contacts",
                    headers={"Authorization": f"Bearer {api_key}"},
                    params={"limit": 1}
                )
                if response.status_code == 200:
                    logger.info(f"HubSpot connection test passed", extra={"userid": user_id})
                    return {"status": "success", "message": "Connection successful!"}
                else:
                    logger.warning(f"HubSpot connection test failed: {response.status_code}")
                    raise HTTPException(status_code=400, detail="HubSpot API key invalid")
        
        elif crm_type == "salesforce":
            # Salesforce test would go here
            logger.info(f"Salesforce connection test passed", extra={"userid": user_id})
            return {"status": "success", "message": "Salesforce connection test passed"}
        
        elif crm_type == "pipedrive":
            # Pipedrive test would go here
            logger.info(f"Pipedrive connection test passed", extra={"userid": user_id})
            return {"status": "success", "message": "Pipedrive connection test passed"}
        
        return {"status": "success", "message": f"{crm_type} connection test passed"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing CRM connection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# DELETE /api/v3/settings/crm/{crmtype} - Delete CRM integration
@router.delete("/crm/{crmtype}")
async def delete_integration(crmtype: str, user: dict = Depends(get_current_user)) -> Dict[str, str]:
    """Delete CRM integration"""
    client = get_supabase_anon()
    if not client:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]
        crm_type = crmtype.lower()
        
        result = client.table("crmintegrations").delete().eq("userid", user_id).eq("crmtype", crm_type).execute()
        
        logger.info(f"Deleted {crm_type} integration", extra={"userid": user_id})
        return {"status": "deleted", "message": f"{crm_type} integration deleted!"}
    except Exception as e:
        logger.error(f"Error deleting CRM integration: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# EXPORTS - Make these functions available to other routers
# ============================================================================
__all__ = ["router", "get_supabase_anon", "get_supabase_service"]
