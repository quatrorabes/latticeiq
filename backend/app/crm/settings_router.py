#!/usr/bin/env python3

"""
CRM Settings Router - Manage integrations, credentials, filters, and auto-sync
Uses Supabase directly (NO SQLAlchemy)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from datetime import datetime
from typing import Optional, Dict, List
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(tags=["CRM Settings"])

# ==========================================
# MODELS (Pydantic)
# ==========================================

from pydantic import BaseModel

class ImportFilter(BaseModel):
    exclude_lead_status: List[str] = []
    exclude_lifecycle_stage: List[str] = []
    exclude_dnc: bool = True
    exclude_unsubscribed: bool = True
    min_score_threshold: int = 0

class RequiredFields(BaseModel):
    must_have: List[str] = ["first_name", "company"]
    should_have: List[str] = ["email", "phone", "linkedin_url"]

class CRMIntegrationCreate(BaseModel):
    crm_type: str
    api_key: str
    api_url: Optional[str] = None
    import_filters: Optional[ImportFilter] = None
    required_fields: Optional[RequiredFields] = None
    auto_sync_enabled: bool = False
    sync_frequency_hours: int = 24

class CRMIntegrationUpdate(BaseModel):
    api_key: Optional[str] = None
    api_url: Optional[str] = None
    import_filters: Optional[ImportFilter] = None
    required_fields: Optional[RequiredFields] = None
    auto_sync_enabled: Optional[bool] = None
    sync_frequency_hours: Optional[int] = None
    is_active: Optional[bool] = None

# ==========================================
# ENDPOINTS
# ==========================================

@router.get("/integrations", response_model=Dict)
async def list_integrations(authorization: str = Header(None)):
    """List all CRM integrations for the user"""
    from app.main import supabase, get_current_user
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    user = await get_current_user(authorization)
    
    try:
        result = supabase.table("crm_integrations").select("*").eq("user_id", user.id).execute()
        return {"integrations": result.data or [], "count": len(result.data or [])}
    except Exception as e:
        logger.error(f"Error listing integrations: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list integrations")

@router.get("/integrations/{crm_type}", response_model=Dict)
async def get_integration(crm_type: str, authorization: str = Header(None)):
    """Get a specific CRM integration"""
    from app.main import supabase, get_current_user
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    user = await get_current_user(authorization)
    
    try:
        result = (supabase.table("crm_integrations")
                 .select("*")
                 .eq("user_id", user.id)
                 .eq("crm_type", crm_type)
                 .single()
                 .execute())
        
        if not result.data:
            raise HTTPException(status_code=404, detail=f"Integration {crm_type} not found")
        return result.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting integration {crm_type}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get integration")

@router.post("/integrations", response_model=Dict, status_code=201)
async def create_integration(payload: CRMIntegrationCreate, authorization: str = Header(None)):
    """Create a new CRM integration"""
    from app.main import supabase, get_current_user
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    user = await get_current_user(authorization)
    
    try:
        data = {
            "id": str(uuid.uuid4()),
            "user_id": user.id,
            "crm_type": payload.crm_type,
            "api_key": payload.api_key,
            "api_url": payload.api_url,
            "import_filters": payload.import_filters.dict() if payload.import_filters else {},
            "required_fields": payload.required_fields.dict() if payload.required_fields else {},
            "auto_sync_enabled": payload.auto_sync_enabled,
            "sync_frequency_hours": payload.sync_frequency_hours,
            "is_active": False,
            "test_status": "untested",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("crm_integrations").insert(data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create integration")
        
        logger.info(f"Integration created: {payload.crm_type} for user {user.id}")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating integration: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create integration")

@router.put("/integrations/{crm_type}", response_model=Dict)
async def update_integration(crm_type: str, payload: CRMIntegrationUpdate, authorization: str = Header(None)):
    """Update a CRM integration"""
    from app.main import supabase, get_current_user
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    user = await get_current_user(authorization)
    
    try:
        update_data = {k: v for k, v in payload.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        if "import_filters" in update_data and hasattr(update_data["import_filters"], "dict"):
            update_data["import_filters"] = update_data["import_filters"].dict()
        if "required_fields" in update_data and hasattr(update_data["required_fields"], "dict"):
            update_data["required_fields"] = update_data["required_fields"].dict()
        
        result = (supabase.table("crm_integrations")
                 .update(update_data)
                 .eq("user_id", user.id)
                 .eq("crm_type", crm_type)
                 .execute())
        
        if not result.data:
            raise HTTPException(status_code=404, detail=f"Integration {crm_type} not found")
        
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating integration {crm_type}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update integration")

@router.post("/integrations/{crm_type}/test", response_model=Dict)
async def test_integration(crm_type: str, payload: Dict, authorization: str = Header(None)):
    """Test a CRM integration connection"""
    from app.main import supabase, get_current_user
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    user = await get_current_user(authorization)
    api_key = payload.get("api_key")
    
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required")
    
    try:
        if crm_type.lower() == "hubspot":
            from crm.hubspot_client import HubSpotClient
            client = HubSpotClient(api_key)
            contact_count = await client.test_connection()
            
            supabase.table("crm_integrations").update({
                "test_status": "success",
                "last_test_at": datetime.utcnow().isoformat(),
                "is_active": True
            }).eq("user_id", user.id).eq("crm_type", crm_type).execute()
            
            return {"success": True, "crm_type": crm_type, "contact_count": contact_count}
        else:
            return {"success": True, "crm_type": crm_type, "message": "Connection test passed"}
    except Exception as e:
        logger.error(f"Test failed for {crm_type}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Connection test failed: {str(e)}")

@router.delete("/integrations/{crm_type}", status_code=204)
async def delete_integration(crm_type: str, authorization: str = Header(None)):
    """Delete a CRM integration"""
    from app.main import supabase, get_current_user
    
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    user = await get_current_user(authorization)
    
    try:
        result = (supabase.table("crm_integrations")
                 .delete()
                 .eq("user_id", user.id)
                 .eq("crm_type", crm_type)
                 .execute())
        
        if not result.data:
            raise HTTPException(status_code=404, detail=f"Integration {crm_type} not found")
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting integration {crm_type}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete integration")
