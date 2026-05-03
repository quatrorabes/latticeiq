from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


EnrichmentMode = Literal["quick", "deep"]
JobStatus = Literal["queued", "processing", "completed", "partial", "failed", "cancelled"]
ItemStatus = Literal["queued", "processing", "completed", "failed", "skipped"]
ApprovalStatus = Literal["pending", "approved", "rejected", "not_required"]


class ActorContext(BaseModel):
    user_id: str
    email: Optional[str] = None


class BatchEnrichmentRequest(BaseModel):
    contact_ids: List[str] = Field(default_factory=list)
    mode: EnrichmentMode = "quick"
    provider: str = "perplexity"
    selection_type: Literal["manual", "filter", "all"] = "manual"
    filters: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "json_schema_extra": {
            "example": {
                "contact_ids": [
                    "4973fa1c-c763-4816-bd71-7f352feee24e",
                    "4ea81211-2c7a-43b1-82c8-a9bcdb12ce15",
                ],
                "mode": "deep",
                "provider": "perplexity",
                "selection_type": "manual",
                "filters": {},
                "metadata": {"triggered_from": "ContactsPage", "label": "Enrich Selected"},
            }
        }
    }


class JobCounts(BaseModel):
    contact_count: int = 0
    success_count: int = 0
    failure_count: int = 0


class EnrichmentJobResponse(BaseModel):
    id: str
    user_id: str
    mode: EnrichmentMode
    provider: str
    status: JobStatus
    selection_type: str
    requested_contact_ids: List[str] = Field(default_factory=list)
    filters: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    counts: JobCounts = Field(default_factory=JobCounts)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class EnrichmentJobItemResponse(BaseModel):
    id: str
    job_id: str
    contact_id: str
    user_id: str
    mode: EnrichmentMode
    provider: str
    status: ItemStatus
    approval_status: ApprovalStatus
    attempt_count: int = 0
    provider_response: Optional[Dict[str, Any]] = None
    normalized_data: Optional[Dict[str, Any]] = None
    field_patch: Dict[str, Any] = Field(default_factory=dict)
    approved_fields: List[str] = Field(default_factory=list)
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class EnrichmentJobListResponse(BaseModel):
    items: List[EnrichmentJobResponse]
    total: int


class EnrichmentJobItemListResponse(BaseModel):
    items: List[EnrichmentJobItemResponse]
    total: int


class ApprovalUpdateRequest(BaseModel):
    item_ids: List[str]
    approval_status: ApprovalStatus
    approved_fields: List[str] = Field(default_factory=list)


class HubSpotBatchSyncRequest(BaseModel):
    job_id: str
    item_ids: List[str] = Field(default_factory=list)
    dry_run: bool = False
    allowed_fields: List[str] = Field(default_factory=list)

    model_config = {
        "json_schema_extra": {
            "example": {
                "job_id": "a6f828f9-5c3f-41ba-b0d4-5d6b35f53f22",
                "item_ids": [],
                "dry_run": False,
                "allowed_fields": [
                    "linkedinurl",
                    "website",
                    "company_summary",
                    "buying_signals",
                ],
            }
        }
    }


class HubSpotSyncRow(BaseModel):
    contact_id: str
    hubspot_contact_id: str
    properties: Dict[str, Any]


class HubSpotBatchSyncResponse(BaseModel):
    job_id: str
    dry_run: bool
    crm_system: str = "hubspot"
    attempted: int
    synced: int
    failed: int
    rows: List[HubSpotSyncRow] = Field(default_factory=list)