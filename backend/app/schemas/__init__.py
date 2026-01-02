"""
Schemas Module - Pydantic models for request/response validation.

All Phase 2B API schemas are exported from this module.
"""

from .phase2 import (
    # ICP
    ICPCreateRequest,
    ICPUpdateRequest,
    ICPResponse,
    ICPListResponse,
    ICPCriteria,
    ICPScoringWeights,
    
    # Matching
    BulkMatchRequest,
    BulkMatchResponse,
    ContactMatchResult,
    MatchingContactsRequest,
    MatchingContactsResponse,
    
    # Campaign
    CampaignCreateRequest,
    CampaignResponse,
    CampaignListResponse,
    CampaignPreviewResponse,
    CampaignPreviewContact,
    CampaignActivateResponse,
    CampaignStatus,
    
    # Template
    TemplatePreviewRequest,
    TemplatePreviewResponse,
    AvailableVariablesResponse,
    
    # Field
    FieldValueRequest,
    FieldValueResponse,
    
    # Generic
    SuccessResponse,
    ErrorResponse,
    HealthResponse,
    
    # Enums
    ICPTier,
)

__all__ = [
    # ICP
    "ICPCreateRequest",
    "ICPUpdateRequest",
    "ICPResponse",
    "ICPListResponse",
    "ICPCriteria",
    "ICPScoringWeights",
    
    # Matching
    "BulkMatchRequest",
    "BulkMatchResponse",
    "ContactMatchResult",
    "MatchingContactsRequest",
    "MatchingContactsResponse",
    
    # Campaign
    "CampaignCreateRequest",
    "CampaignResponse",
    "CampaignListResponse",
    "CampaignPreviewResponse",
    "CampaignPreviewContact",
    "CampaignActivateResponse",
    "CampaignStatus",
    
    # Template
    "TemplatePreviewRequest",
    "TemplatePreviewResponse",
    "AvailableVariablesResponse",
    
    # Field
    "FieldValueRequest",
    "FieldValueResponse",
    
    # Generic
    "SuccessResponse",
    "ErrorResponse",
    "HealthResponse",
    
    # Enums
    "ICPTier",
]
