# backend/app/scoring/models.py
"""
LatticeIQ Scoring Framework Models
MDCP, BANT, SPICE configuration models for lead qualification
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


# ============================================================
# MDCP Config Models
# ============================================================

class MDCPWeights(BaseModel):
    """MDCP framework weights"""
    money_weight: int = 25
    decision_maker_weight: int = 25
    champion_weight: int = 25
    process_weight: int = 25


class MDCPThresholds(BaseModel):
    """MDCP scoring thresholds"""
    hot_min: int = 71
    warm_min: int = 40
    cold_max: int = 39


class MDCPCriteria(BaseModel):
    """MDCP scoring criteria"""
    money_min_revenue: Optional[float] = None
    money_max_revenue: Optional[float] = None
    decision_maker_titles: List[str] = ["CEO", "CTO", "VP Sales", "VP Marketing"]
    champion_engagement_days: int = 30
    process_cycle_days: int = 90


class MDCPConfig(BaseModel):
    """Complete MDCP configuration"""
    framework: str = "mdcp"
    weights: Dict[str, int] = {"money": 25, "decisionmaker": 25, "champion": 25, "process": 25}
    thresholds: Dict[str, int] = {"hotMin": 71, "warmMin": 40}
    config: Dict[str, Any] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============================================================
# BANT Config Models
# ============================================================

class BANTWeights(BaseModel):
    """BANT framework weights"""
    budget_weight: int = 25
    authority_weight: int = 25
    need_weight: int = 25
    timeline_weight: int = 25


class BANTThresholds(BaseModel):
    """BANT scoring thresholds"""
    hot_min: int = 71
    warm_min: int = 40
    cold_max: int = 39


class BANTCriteria(BaseModel):
    """BANT scoring criteria"""
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    authority_titles: List[str] = ["CEO", "CTO", "VP Sales", "Director", "Manager"]
    need_keywords: List[str] = ["need", "want", "problem", "challenge", "require"]
    timeline_urgency: Optional[str] = None


class BANTConfig(BaseModel):
    """Complete BANT configuration"""
    framework: str = "bant"
    weights: Dict[str, int] = {"budget": 25, "authority": 25, "need": 25, "timeline": 25}
    thresholds: Dict[str, int] = {"hotMin": 71, "warmMin": 40}
    config: Dict[str, Any] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============================================================
# SPICE Config Models
# ============================================================

class SPICEWeights(BaseModel):
    """SPICE framework weights"""
    situation_weight: int = 20
    problem_weight: int = 20
    implication_weight: int = 20
    consequence_weight: int = 20
    economic_weight: int = 20


class SPICEThresholds(BaseModel):
    """SPICE scoring thresholds"""
    hot_min: int = 71
    warm_min: int = 40
    cold_max: int = 39


class SPICECriteria(BaseModel):
    """SPICE scoring criteria"""
    problem_keywords: List[str] = ["challenge", "issue", "problem", "difficulty", "pain"]
    implication_keywords: List[str] = ["impact", "affect", "consequence", "result", "lead to"]
    consequence_keywords: List[str] = ["risk", "critical", "urgent", "important", "severe"]


class SPICEConfig(BaseModel):
    """Complete SPICE configuration"""
    framework: str = "spice"
    weights: Dict[str, int] = {"situation": 20, "problem": 20, "implication": 20, "criticalEvent": 20, "decision": 20}
    thresholds: Dict[str, int] = {"hotMin": 71, "warmMin": 40}
    config: Dict[str, Any] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============================================================
# Scoring Response Models
# ============================================================

class ScoreResponse(BaseModel):
    """Response from scoring endpoint with persisted data"""
    contact_id: str
    mdcp_score: float
    mdcp_tier: str
    bant_score: float
    bant_tier: str
    spice_score: float
    spice_tier: str
    overall_score: Optional[float] = None
    last_scored_at: Optional[datetime] = None

    class Config:
        extra = "allow"


class BatchScoringResponse(BaseModel):
    """Response from batch scoring endpoint"""
    success: bool
    scored_count: int
    total_contacts: int
    message: str
    errors: Optional[list] = None
