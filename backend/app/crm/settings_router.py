# ============================================================================
# FILE: backend/app/crm/settings_router.py
# ============================================================================
"""
CRM Settings Router (Supabase-backed, UUID-native)

Provides:
- Create/update integration credentials
- List integrations
- Get one integration
- Test connection (HubSpot/Salesforce/Pipedrive)

This router is intentionally Supabase-first (no SQLAlchemy).
Supabase auto-generates UUID ids on insert.
"""

import os
from datetime import datetime
from typing import Optional, Dict, List, Any

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field

from supabase import create_client, Client

# Local CRM clients
try:
    from .hubspot_client import HubSpotClient
except ImportError:
    HubSpotClient = None

router = APIRouter(prefix="/api/v3/settings/crm", tags=["CRM Settings"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_ANON_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# ============================================================================
# Auth (Supabase token validation)
# ============================================================================

class CurrentUser(BaseModel):
    id: str
    email: str = ""

async def get_current_user(authorization: str = Header(None)) -> CurrentUser:
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")

    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")

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
# Models
# ============================================================================

class ImportFilter(BaseModel):
    exclude_lead_status: List[str] = []
    exclude_lifecycle_stage: List[str] = []
    exclude_dnc: bool = True
    exclude_unsubscribed: bool = True
    min_score_threshold: int = 0

class RequiredFields(BaseModel):
    must_have: List[str] = ["first_name", "company"]
    should_have: List[str] = ["email", "phone", "linkedin_url"]

class CRMIntegrationUpsert(BaseModel):
    crm_type: str = Field(..., description="hubspot|salesforce|pipedrive")
    api_key: str = Field(..., min_length=3)
    api_url: Optional[str] = None
    import_filters: Optional[ImportFilter] = None
    required_fields: Optional[RequiredFields] = None
    auto_sync_enabled: bool = False
    sync_frequency_hours: int = 24

class CRMIntegrationOut(BaseModel):
    id: str
    user_id: str
    crm_type: str
    api_url: Optional[str] = None
    is_active: bool
    test_status: str
    last_test_at: Optional[str] = None
    last_sync_at: Optional[str] = None
    import_filters: Dict[str, Any]
    required_fields: Dict[str, Any]
    auto_sync_enabled: bool
    sync_frequency_hours: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class TestConnectionRequest(BaseModel):
    api_key: str
    api_url: Optional[str] = None

class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    contact_count: Optional[int] = None
    sample_fields: Optional[Dict[str, Any]] = None

# ============================================================================
# Helpers
# ============================================================================

def _now_iso() -> str:
    return datetime.utcnow().isoformat()

def _safe_dict(model_obj) -> Dict[str, Any]:
    if model_obj is None:
        return {}
    return model_obj.model_dump() if hasattr(model_obj, "model_dump") else model_obj.dict()

def _ensure_supabase():
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")

def _get_existing_integration(user_id: str, crm_type: str) -> Optional[Dict[str, Any]]:
    res = (
        supabase.table("crm_integrations")
        .select("*")
        .eq("user_id", user_id)
        .eq("crm_type", crm_type)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None

def _to_out(row: Dict[str, Any]) -> CRMIntegrationOut:
    return CRMIntegrationOut(**row)

# ============================================================================
# Endpoints
# ============================================================================

@router.get("/integrations", response_model=List[CRMIntegrationOut])
async def list_integrations(user: CurrentUser = Depends(get_current_user)):
    _ensure_supabase()
    res = supabase.table("crm_integrations").select("*").eq("user_id", user.id).order("created_at", desc=True).execute()
    return [CRMIntegrationOut(**r) for r in (res.data or [])]

@router.get("/integrations/{crm_type}", response_model=CRMIntegrationOut)
async def get_integration(crm_type: str, user: CurrentUser = Depends(get_current_user)):
    _ensure_supabase()
    existing = _get_existing_integration(user.id, crm_type)
    if not existing:
        raise HTTPException(status_code=404, detail=f"CRM integration not found: {crm_type}")
    return _to_out(existing)

@router.post("/integrations", response_model=CRMIntegrationOut)
async def upsert_integration(payload: CRMIntegrationUpsert, user: CurrentUser = Depends(get_current_user)):
    """
    Create or update the integration row in crm_integrations.
    Supabase auto-generates UUID id on insert.
    """
    _ensure_supabase()

    crm_type = payload.crm_type.lower().strip()
    if crm_type not in ("hubspot", "salesforce", "pipedrive"):
        raise HTTPException(status_code=400, detail=f"Unsupported CRM type: {crm_type}")

    existing = _get_existing_integration(user.id, crm_type)

    row = {
        "user_id": user.id,
        "crm_type": crm_type,
        "api_key": payload.api_key,
        "api_url": payload.api_url,
        "import_filters": _safe_dict(payload.import_filters),
        "required_fields": _safe_dict(payload.required_fields),
        "auto_sync_enabled": payload.auto_sync_enabled,
        "sync_frequency_hours": payload.sync_frequency_hours,
        "test_status": "untested",
        "is_active": True,
        "updated_at": _now_iso(),
    }

    if existing:
        # Update existing - don't touch id
        res = (
            supabase.table("crm_integrations")
            .update(row)
            .eq("id", existing["id"])
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to update integration")
        return _to_out(res.data[0])

    # Create new - DON'T set id, let Supabase auto-generate it
    res = supabase.table("crm_integrations").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create integration")
    return _to_out(res.data[0])

@router.post("/integrations/{crm_type}/test", response_model=TestConnectionResponse)
async def test_integration(crm_type: str, payload: TestConnectionRequest, user: CurrentUser = Depends(get_current_user)):
    _ensure_supabase()

    crm_type = crm_type.lower().strip()
    if crm_type not in ("hubspot", "salesforce", "pipedrive"):
        raise HTTPException(status_code=400, detail=f"Unsupported CRM type: {crm_type}")

    # Run test (HubSpot implemented; others can be added later)
    if crm_type == "hubspot" and HubSpotClient:
        try:
            client = HubSpotClient(api_key=payload.api_key)
            ok = client.test_connection()
            result = {
                "success": bool(ok),
                "message": "HubSpot connection successful" if ok else "HubSpot connection failed",
                "contact_count": None,
                "sample_fields": None,
            }
        except Exception as e:
            result = {
                "success": False,
                "message": f"HubSpot test error: {str(e)}",
                "contact_count": None,
                "sample_fields": None,
            }
    else:
        result = {
            "success": False,
            "message": f"{crm_type} test not implemented yet",
            "contact_count": None,
            "sample_fields": None,
        }

    # Persist test status on the stored integration row (if exists)
    existing = _get_existing_integration(user.id, crm_type)
    if existing:
        supabase.table("crm_integrations").update({
            "test_status": "success" if result["success"] else "failed",
            "last_test_at": _now_iso(),
            "updated_at": _now_iso(),
        }).eq("id", existing["id"]).execute()

    return TestConnectionResponse(**result)