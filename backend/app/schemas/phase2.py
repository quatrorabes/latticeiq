"""
Phase 2B Pydantic Schemas - Request/Response Models
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from uuid import UUID
from datetime import datetime
from enum import Enum


class CampaignStatus(str, Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"
    cancelled = "cancelled"


class ICPTier(str, Enum):
    hot = "hot"
    warm = "warm"
    cold = "cold"


class ICPCriteria(BaseModel):
    industries: List[str] = Field(default_factory=list)
    personas: List[str] = Field(default_factory=list)
    min_company_size: Optional[int] = None
    max_company_size: Optional[int] = None


class ICPScoringWeights(BaseModel):
    industry_weight: int = Field(default=30, ge=0, le=100)
    persona_weight: int = Field(default=40, ge=0, le=100)
    company_size_weight: int = Field(default=30, ge=0, le=100)


class ICPCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    criteria: ICPCriteria
    scoring_weights: Optional[ICPScoringWeights] = None
    is_active: bool = True


class ICPUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    criteria: Optional[ICPCriteria] = None
    scoring_weights: Optional[ICPScoringWeights] = None
    is_active: Optional[bool] = None


class ICPResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    description: Optional[str]
    criteria: Dict[str, Any]
    scoring_weights: Dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class ICPListResponse(BaseModel):
    icps: List[ICPResponse]
    total: int


class ContactMatchResult(BaseModel):
    contact_id: UUID
    icp_id: UUID
    score: int = Field(..., ge=0, le=100)
    tier: ICPTier
    matched_criteria: Dict[str, bool] = Field(default_factory=dict)


class BulkMatchRequest(BaseModel):
    icp_id: UUID
    contact_ids: Optional[List[UUID]] = None
    min_score: int = Field(default=0, ge=0, le=100)
    limit: int = Field(default=100, ge=1, le=1000)


class BulkMatchResponse(BaseModel):
    icp_id: UUID
    total_processed: int
    matches_found: int
    results: List[ContactMatchResult]
    processing_time_ms: int


class MatchingContactsRequest(BaseModel):
    min_score: int = Field(default=60, ge=0, le=100)
    limit: int = Field(default=100, ge=1, le=1000)


class MatchingContactsResponse(BaseModel):
    icp_id: UUID
    icp_name: str
    min_score: int
    contacts: List[Dict[str, Any]]
    total_matches: int


class CampaignCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    icp_id: UUID
    email_template_id: UUID
    min_icp_score: int = Field(default=60, ge=0, le=100)
    scheduled_at: Optional[datetime] = None


class CampaignResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    icp_id: UUID
    email_template_id: UUID
    status: CampaignStatus
    target_count: int
    sent_count: int
    opened_count: int
    clicked_count: int
    replied_count: int
    open_rate: float = 0.0
    click_rate: float = 0.0
    reply_rate: float = 0.0
    created_at: datetime
    scheduled_at: Optional[datetime]
    sent_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        orm_mode = True


class CampaignListResponse(BaseModel):
    campaigns: List[CampaignResponse]
    total: int


class CampaignPreviewContact(BaseModel):
    contact_id: UUID
    contact_name: str
    email: Optional[str]
    email_subject: str
    email_body_preview: str
    icp_match_score: int


class CampaignPreviewResponse(BaseModel):
    campaign_id: UUID
    campaign_name: str
    template_name: str
    total_targets: int
    previews: List[CampaignPreviewContact]


class CampaignActivateResponse(BaseModel):
    campaign_id: UUID
    status: CampaignStatus
    activated_at: datetime
    target_count: int
    message: str


class TemplatePreviewRequest(BaseModel):
    template_id: Optional[UUID] = None
    template_text: Optional[str] = None
    contact_id: UUID
    extra_values: Optional[Dict[str, str]] = None


class TemplatePreviewResponse(BaseModel):
    subject: Optional[str] = None
    body: str
    variables_used: List[str] = Field(default_factory=list)
    variables_missing: List[str] = Field(default_factory=list)
    contact_name: str


class AvailableVariablesResponse(BaseModel):
    contact_id: UUID
    contact_name: str
    available_variables: List[str]
    variable_values: Dict[str, str]


class FieldValueRequest(BaseModel):
    contact_id: UUID
    field_names: List[str] = Field(..., min_items=1, max_items=50)


class FieldValueResponse(BaseModel):
    contact_id: UUID
    fields: Dict[str, Optional[str]]


class SuccessResponse(BaseModel):
    success: bool = True
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    phase2b_services: Dict[str, str]
    timestamp: datetime
