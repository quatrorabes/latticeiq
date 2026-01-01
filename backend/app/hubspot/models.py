# backend/app/hubspot/models.py
# NEW FILE

from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

# =============================================================================
# Request/Response Models
# =============================================================================

class HubSpotAuthRequest(BaseModel):
    """OAuth authorization request"""
    workspace_id: str


class HubSpotAuthCallbackRequest(BaseModel):
    """OAuth callback with code and state"""
    code: str
    state: str


class HubSpotImportFilters(BaseModel):
    """Filters for HubSpot contact import"""
    lead_status_exclude: List[str] = ["Unqualified", "Do Not Contact", "Unsubscribed"]
    lifecycle_status_exclude: List[str] = ["Unqualified"]


class HubSpotImportRequest(BaseModel):
    """Request to import contacts from HubSpot"""
    filters: HubSpotImportFilters
    properties_to_import: List[str]
    auto_enrich: bool = False


class HubSpotImportResponse(BaseModel):
    """Response from HubSpot import"""
    total_contacts: int
    imported: int
    enrichment_queued: int
    duplicates_skipped: int
    failed: int
    created_contact_ids: List[str]
    errors: Dict[str, str] = {}


class HubSpotIntegrationStatus(BaseModel):
    """HubSpot integration status"""
    id: str
    provider: str = "hubspot"
    is_connected: bool
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[str] = None
    connected_email: Optional[str] = None
    connected_at: Optional[str] = None


class HubSpotContactProperties(BaseModel):
    """Mapping of HubSpot contact properties to LatticeIQ fields"""
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    mobilephone: Optional[str] = None
    linkedinurl: Optional[str] = None
    jobtitle: Optional[str] = None
    industry: Optional[str] = None
    numberofemployees: Optional[str] = None
    annualrevenue: Optional[str] = None
    lifecyclestage: Optional[str] = None
    hs_lead_status: Optional[str] = None
    hs_analytics_last_visit: Optional[str] = None
