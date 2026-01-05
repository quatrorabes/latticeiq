# backend/app/enrichment_v3/models.py

from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Literal, Dict, Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Core reusable types
# ---------------------------------------------------------------------------

class EnrichmentBullet(BaseModel):
    """Single bullet / line item in a box."""
    text: str = Field(..., description="Short, one-sentence bullet")
    evidence: Optional[str] = Field(
        None,
        description="Optional short reference to source or reasoning",
    )
    strength: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Optional confidence score 0-1",
    )


class ContactProfileBox(BaseModel):
    headline: Optional[str] = None
    role_summary: Optional[str] = None
    seniority: Optional[str] = None
    background_bullets: List[EnrichmentBullet] = []


class CompanyProfileBox(BaseModel):
    one_liner: Optional[str] = None
    industry: Optional[str] = None
    size_segment: Optional[str] = None
    region: Optional[str] = None
    key_products_or_services: List[EnrichmentBullet] = []


class CurrentFocusBox(BaseModel):
    strategic_initiatives: List[EnrichmentBullet] = []
    recent_projects: List[EnrichmentBullet] = []
    primary_kpis: List[EnrichmentBullet] = []


class BuyingSignalsBox(BaseModel):
    recent_news: List[EnrichmentBullet] = []
    hiring_signals: List[EnrichmentBullet] = []
    tech_changes: List[EnrichmentBullet] = []
    timing_triggers: List[EnrichmentBullet] = []


class RisksAndObjectionsBox(BaseModel):
    risk_bullets: List[EnrichmentBullet] = []
    likely_objections: List[EnrichmentBullet] = []
    landmines: List[EnrichmentBullet] = []


class MessagingBox(BaseModel):
    cold_openers: List[EnrichmentBullet] = []
    value_props: List[EnrichmentBullet] = []
    call_to_action_ideas: List[EnrichmentBullet] = []


class EnrichmentMeta(BaseModel):
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    source: Literal["quick", "deep"] = "quick"
    model: Optional[str] = None
    provider: Optional[str] = None
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    version: int = 1


# ---------------------------------------------------------------------------
# Unified result shapes
# ---------------------------------------------------------------------------

class UnifiedEnrichmentResult(BaseModel):
    """
    Canonical shape used by BOTH quick and deep enrichment.
    Quick may populate fewer fields; deep aims to populate them all.
    """

    contact_id: str

    contact_profile: ContactProfileBox = ContactProfileBox()
    company_profile: CompanyProfileBox = CompanyProfileBox()
    current_focus: CurrentFocusBox = CurrentFocusBox()
    buying_signals: BuyingSignalsBox = BuyingSignalsBox()
    risks_and_objections: RisksAndObjectionsBox = RisksAndObjectionsBox()
    messaging: MessagingBox = MessagingBox()

    meta: EnrichmentMeta = Field(
        default_factory=lambda: EnrichmentMeta(source="quick")
    )


# ---------------------------------------------------------------------------
# Quick-enrich legacy-compatible shape
# ---------------------------------------------------------------------------

class QuickEnrichLegacyData(BaseModel):
    """
    Keeps backward-compatible structure for anything in the system
    that still expects the original quick-enrich response.
    """
    summary: Optional[str] = None
    opening_line: Optional[str] = Field(
        None, alias="openingline"
    )
    talking_points: Optional[str] = Field(
        None, alias="talkingpoints"
    )
    persona_type: Optional[str] = Field(
        None, alias="personatype"
    )
    vertical: Optional[str] = None
    inferred_title: Optional[str] = Field(
        None, alias="inferredtitle"
    )
    inferred_company_website: Optional[str] = Field(
        None, alias="inferredcompanywebsite"
    )
    inferred_location: Optional[str] = Field(
        None, alias="inferredlocation"
    )
    provider: Optional[str] = None
    model: Optional[str] = None
    generated_at: Optional[datetime] = Field(
        None, alias="generatedat"
    )
    raw_text: Optional[str] = Field(None, alias="rawtext")


class QuickEnrichResponse(BaseModel):
    contact_id: str = Field(..., alias="contactid")
    status: Literal["pending", "processing", "completed", "failed"]
    data: UnifiedEnrichmentResult
    legacy: Optional[QuickEnrichLegacyData] = None


# ---------------------------------------------------------------------------
# Deep enrichment result & debug models
# ---------------------------------------------------------------------------

class DeepEnrichmentStatus(BaseModel):
    contact_id: str
    job_id: Optional[str] = None
    status: Literal["queued", "running", "completed", "failed"]
    error: Optional[str] = None


class DebugQuickEnrichResponse(BaseModel):
    contact_id: str
    request_payload: Dict[str, Any]
    raw_prompt: Optional[str] = None
    raw_response: Any
    parsed: QuickEnrichResponse


class DebugDeepEnrichResponse(BaseModel):
    contact_id: str
    job_id: Optional[str] = None
    request_payload: Dict[str, Any]
    raw_prompt_chain: Optional[Any] = None
    raw_responses: Any
    parsed: UnifiedEnrichmentResult
    status: DeepEnrichmentStatus
