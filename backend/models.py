"""
LatticeIQ Pydantic Models
Defines all request/response contracts for the API
"""

from pydantic import BaseModel, Field, EmailStr, validator
from uuid import UUID
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


# ============================================================================
# ENUMS
# ============================================================================

class EnrichmentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ErrorCode(str, Enum):
    VALIDATION_ERROR = "validation_error"
    ENRICHMENT_FAILED = "enrichment_failed"
    RATE_LIMITED = "rate_limited"
    NOT_FOUND = "not_found"
    UNAUTHORIZED = "unauthorized"
    INTERNAL_ERROR = "internal_error"


# ============================================================================
# CONTACT MODELS
# ============================================================================

class ContactBase(BaseModel):
    """Base contact fields (shared between Create and Response)"""
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    vertical: Optional[str] = None
    persona_type: Optional[str] = None

    class Config:
        from_attributes = True


class ContactCreateRequest(ContactBase):
    """Request body for POST /api/contacts"""
    pass


class ContactUpdateRequest(BaseModel):
    """Request body for PUT /api/contacts/{id}"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    vertical: Optional[str] = None
    persona_type: Optional[str] = None
    bant_budget_confirmed: Optional[bool] = None
    bant_authority_level: Optional[str] = None
    bant_need: Optional[str] = None
    bant_timeline: Optional[str] = None
    apex_score: Optional[int] = None

    class Config:
        from_attributes = True


class ContactResponse(ContactBase):
    """Response body for GET /api/contacts endpoints"""
    id: UUID
    user_id: UUID
    enrichment_status: EnrichmentStatus
    enrichment_data: Optional[Dict[str, Any]] = None
    enriched_at: Optional[datetime] = None
    apex_score: Optional[int] = None
    mdc_score: Optional[int] = None
    rss_score: Optional[int] = None
    bant_budget_confirmed: Optional[bool] = None
    bant_authority_level: Optional[str] = None
    bant_need: Optional[str] = None
    bant_timeline: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ContactListResponse(BaseModel):
    """Response body for GET /api/contacts (paginated)"""
    success: bool
    contacts: List[ContactResponse]
    total: int
    limit: int
    offset: int


# ============================================================================
# ENRICHMENT MODELS
# ============================================================================

class EnrichRequest(BaseModel):
    """Request body for POST /api/v3/enrichment/enrich"""
    contact_id: UUID
    synthesize: bool = True


class EnrichmentStatusResponse(BaseModel):
    """Response body for GET /api/v3/enrichment/{id}/status"""
    contact_id: UUID
    enrichment_status: EnrichmentStatus
    progress: Optional[float] = None
    current_stage: Optional[str] = None
    error_message: Optional[str] = None
    enriched_at: Optional[datetime] = None
    estimated_completion_at: Optional[datetime] = None


class EnrichmentProgressEvent(BaseModel):
    """Server-Sent Event payload for SSE streaming"""
    event: str
    progress: Optional[float] = None
    stage: Optional[str] = None
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class EnrichmentProfileResponse(BaseModel):
    """Response body for GET /api/v3/enrichment/{id}/profile"""
    contact_id: UUID
    enrichment_status: EnrichmentStatus
    profile_data: Optional[Dict[str, Any]] = None
    raw_data: Optional[Dict[str, Any]] = None
    apex_score: Optional[int] = None
    created_at: datetime


# ============================================================================
# ERROR MODELS
# ============================================================================

class ErrorDetail(BaseModel):
    """RFC 7807-style error response"""
    type: str
    title: str
    status: int
    detail: str
    error_code: ErrorCode
    instance: Optional[str] = None
    additional_info: Optional[Dict[str, Any]] = None


# ============================================================================
# BATCH ENRICHMENT MODELS
# ============================================================================

class BatchEnrichRequest(BaseModel):
    """Request body for POST /api/v3/enrichment/batch"""
    contact_ids: List[UUID]
    limit: int = 10
    synthesize: bool = True


class BatchEnrichResponse(BaseModel):
    """Response body for batch enrichment"""
    queued_count: int
    skipped_count: int
    error_count: int
    message: str


# ============================================================================
# USER PROFILE MODELS
# ============================================================================

class UserProfile(BaseModel):
    """User profile for ICP matching"""
    id: UUID
    user_id: UUID
    full_name: str
    company: str
    role: str
    primary_product: Optional[str] = None
    target_industries: Optional[List[str]] = None
    ideal_deal_size_min: Optional[int] = None
    ideal_deal_size_max: Optional[int] = None

    class Config:
        from_attributes = True
