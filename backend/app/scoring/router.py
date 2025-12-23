#!/usr/bin/env python3

"""
LatticeIQ Scoring API Router
Endpoints for scoring configuration and calculation
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional
from .models import MDCPConfig, BANTConfig, SPICEConfig, ScoringResult, ScoringBreakdown
from .calculators import MDCPCalculator, BANTCalculator, SPICECalculator
from datetime import datetime

router = APIRouter(prefix="/api/v3/scoring", tags=["scoring"])

# In-memory config storage (replace with DB in production)
_configs = {
	'MDCP': MDCPConfig(),
	'BANT': BANTConfig(),
	'SPICE': SPICEConfig()
}


# ============================================================
# Configuration Endpoints
# ============================================================

@router.post("/config/{framework}")
async def save_scoring_config(
	framework: str,
	config: Dict[str, Any]
):
	"""Save scoring configuration for a framework"""
	
	if framework == "MDCP":
		_configs['MDCP'] = MDCPConfig(**config)
		return {"status": "saved", "framework": "MDCP"}
	elif framework == "BANT":
		_configs['BANT'] = BANTConfig(**config)
		return {"status": "saved", "framework": "BANT"}
	elif framework == "SPICE":
		_configs['SPICE'] = SPICEConfig(**config)
		return {"status": "saved", "framework": "SPICE"}
	else:
		raise HTTPException(status_code=400, detail=f"Unknown framework: {framework}")
		
		
@router.get("/config/{framework}")
async def get_scoring_config(framework: str):
	"""Get scoring configuration for a framework"""
	
	if framework == "MDCP":
		return _configs['MDCP'].dict()
	elif framework == "BANT":
		return _configs['BANT'].dict()
	elif framework == "SPICE":
		return _configs['SPICE'].dict()
	else:
		raise HTTPException(status_code=400, detail=f"Unknown framework: {framework}")
		
		
@router.get("/config")
async def get_all_configs():
	"""Get all scoring configurations"""
	return {
		'MDCP': _configs['MDCP'].dict(),
		'BANT': _configs['BANT'].dict(),
		'SPICE': _configs['SPICE'].dict()
	}
	

# ============================================================
# Scoring Calculation Endpoints
# ============================================================

@router.post("/calculate/{contact_id}")
async def calculate_contact_score(
	contact_id: str,
	framework: str,
	contact_data: Dict[str, Any]
) -> Dict[str, Any]:
	"""
	Calculate score for a contact using specified framework
	
	Frameworks: MDCP, BANT, SPICE
	"""
	
	if framework == "MDCP":
		calculator = MDCPCalculator(_configs['MDCP'].dict())
		return calculator.calculate(contact_data)

	elif framework == "BANT":
		calculator = BANTCalculator(_configs['BANT'].dict())
		return calculator.calculate(contact_data)

	elif framework == "SPICE":
		calculator = SPICECalculator(_configs['SPICE'].dict())
		return calculator.calculate(contact_data)

	else:
		raise HTTPException(
			status_code=400,
			detail=f"Unknown framework: {framework}. Use MDCP, BANT, or SPICE"
		)
		
		
@router.post("/calculate-all/{contact_id}")
async def calculate_all_scores(
	contact_id: str,
	contact_data: Dict[str, Any]
) -> ScoringResult:
	"""
	Calculate all three scores for a contact
	Returns MDCP, BANT, and SPICE scores together
	"""
	
	mdcp_calc = MDCPCalculator(_configs['MDCP'].dict())
	bant_calc = BANTCalculator(_configs['BANT'].dict())
	spice_calc = SPICECalculator(_configs['SPICE'].dict())
	
	mdcp_result = mdcp_calc.calculate(contact_data)
	bant_result = bant_calc.calculate(contact_data)
	spice_result = spice_calc.calculate(contact_data)
	
	breakdown = ScoringBreakdown(
		mdcp=mdcp_result.get('breakdown'),
		bant=bant_result.get('breakdown'),
		spice=spice_result.get('breakdown')
	)

	return ScoringResult(
		contact_id=contact_id,
		mdcp_score=mdcp_result.get('score'),
		mdcp_tier=mdcp_result.get('tier'),
		bant_score=bant_result.get('score'),
		bant_tier=bant_result.get('tier'),
		spice_score=spice_result.get('score'),
		spice_tier=spice_result.get('tier'),
		breakdown=breakdown
	)


@router.get("/health")
async def scoring_health():
	"""Check if scoring module is healthy"""
	return {
		"status": "healthy",
		"frameworks": ["MDCP", "BANT", "SPICE"],
		"configs_loaded": len(_configs),
		"timestamp": datetime.utcnow().isoformat()
	}
	