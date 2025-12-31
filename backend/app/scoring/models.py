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
    weights: MDCPWeights = MDCPWeights()
    criteria: MDCPCriteria = MDCPCriteria()
    thresholds: MDCPThresholds = MDCPThresholds()
    created_at: datetime = None
    updated_at: datetime = None
    
    def __init__(self, **data):
        super().__init__(**data)
        if not self.created_at:
            self.created_at = datetime.utcnow()
        if not self.updated_at:
            self.updated_at = datetime.utcnow()


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
    
    timeline_urgency: Optional[str] = None  # "Immediate", "This quarter", "This year"


class BANTConfig(BaseModel):
    """Complete BANT configuration"""
    weights: BANTWeights = BANTWeights()
    criteria: BANTCriteria = BANTCriteria()
    thresholds: BANTThresholds = BANTThresholds()
    created_at: datetime = None
    updated_at: datetime = None
    
    def __init__(self, **data):
        super().__init__(**data)
        if not self.created_at:
            self.created_at = datetime.utcnow()
        if not self.updated_at:
            self.updated_at = datetime.utcnow()


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
    weights: SPICEWeights = SPICEWeights()
    criteria: SPICECriteria = SPICECriteria()
    thresholds: SPICEThresholds = SPICEThresholds()
    created_at: datetime = None
    updated_at: datetime = None
    
    def __init__(self, **data):
        super().__init__(**data)
        if not self.created_at:
            self.created_at = datetime.utcnow()
        if not self.updated_at:
            self.updated_at = datetime.utcnow()


# ============================================================
# Scoring Response Models
# ============================================================

class ScoringBreakdown(BaseModel):
    """Detailed score breakdown by component"""
    mdcp: Optional[Dict[str, int]] = None
    bant: Optional[Dict[str, int]] = None
    spice: Optional[Dict[str, int]] = None


class ScoringResult(BaseModel):
    """Scoring calculation result"""
    contact_id: str
    
    mdcp_score: Optional[int] = None
    mdcp_tier: Optional[str] = None
    
    bant_score: Optional[int] = None
    bant_tier: Optional[str] = None
    
    spice_score: Optional[int] = None
    spice_tier: Optional[str] = None
    
    breakdown: ScoringBreakdown
    calculated_at: datetime = None
    
    def __init__(self, **data):
        super().__init__(**data)
        if not self.calculated_at:
            self.calculated_at = datetime.utcnow()

# ADD THIS AT THE END OF YOUR EXISTING models.py FILE


# ============================================================
# RESPONSE MODELS FOR PERSISTENCE
# ============================================================

class ScoreResponse(BaseModel):
    """Response from scoring endpoint with persisted data"""
    contact_id: str
    mdcp_score: Optional[float] = None
    mdcp_tier: Optional[str] = None
    bant_score: Optional[float] = None
    bant_tier: Optional[str] = None
    spice_score: Optional[float] = None
    spice_tier: Optional[str] = None
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
