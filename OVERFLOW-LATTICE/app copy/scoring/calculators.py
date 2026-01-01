# backend/app/scoring/calculators.py
"""
LatticeIQ Scoring Calculators
Core logic for MDCP, BANT, SPICE framework scoring
"""

from typing import Dict, Any
from datetime import datetime


def calculate_mdcp_score(contact: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate MDCP (Money-Decision-Contact-Profile) score
    Returns dict with score (0-100), tier, and breakdown
    """
    weights = config.get("weights", {
        "money": 25,
        "decisionmaker": 25,
        "champion": 25,
        "process": 25
    })
    thresholds = config.get("thresholds", {
        "hotMin": 71,
        "warmMin": 40
    })
    cfg = config.get("config", {})

    # Initialize scores
    money_score = 0
    decision_score = 0
    champion_score = 0
    process_score = 0

    # 1. MONEY SCORE (25 points)
    company = contact.get("company", "")
    if company:
        money_score = 20

    # 2. DECISION-MAKER SCORE (25 points)
    title = contact.get("job_title", "").lower() if contact.get("job_title") else ""
    decision_titles = [t.lower() for t in cfg.get("decisionmakerTitles", ["CEO", "VP", "Director", "President", "Owner", "CTO", "CFO"])]
    
    for dt in decision_titles:
        if dt in title:
            decision_score = 25
            break
    
    if decision_score == 0 and title:
        decision_score = 10

    # 3. CHAMPION SCORE (25 points)
    engagement_days = cfg.get("championEngagementDays", 30)
    enriched_at = contact.get("enriched_at")
    
    if enriched_at:
        try:
            enriched_date = datetime.fromisoformat(enriched_at.replace('Z', '+00:00'))
            days_since = (datetime.now() - enriched_date.replace(tzinfo=None)).days
            if days_since <= engagement_days:
                champion_score = 25
            elif days_since <= engagement_days * 2:
                champion_score = 15
            else:
                champion_score = 5
        except:
            champion_score = 10
    else:
        champion_score = 10

    # 4. PROCESS SCORE (25 points)
    enrichment_status = contact.get("enrichment_status", "")
    if enrichment_status == "completed":
        process_score = 20
    elif enrichment_status == "processing":
        process_score = 10

    # Calculate total
    total_score = money_score + decision_score + champion_score + process_score

    # Determine tier
    if total_score >= thresholds.get("hotMin", 71):
        tier = "hot"
    elif total_score >= thresholds.get("warmMin", 40):
        tier = "warm"
    else:
        tier = "cold"

    return {
        "score": total_score,
        "tier": tier,
        "breakdown": {
            "money": money_score,
            "decisionmaker": decision_score,
            "champion": champion_score,
            "process": process_score
        },
        "framework": "MDCP",
        "calculated_at": datetime.utcnow().isoformat()
    }


def calculate_bant_score(contact: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate BANT (Budget-Authority-Need-Timeline) score
    Returns dict with score, tier, and breakdown
    """
    weights = config.get("weights", {
        "budget": 25,
        "authority": 25,
        "need": 25,
        "timeline": 25
    })
    thresholds = config.get("thresholds", {
        "hotMin": 71,
        "warmMin": 40
    })

    # Initialize scores
    budget_score = 0
    authority_score = 0
    need_score = 0
    timeline_score = 0

    # 1. BUDGET (25 points)
    bant_data = contact.get("enrichment_data", {}).get("bant", {}) if isinstance(contact.get("enrichment_data"), dict) else {}
    
    if bant_data.get("budget_confirmed"):
        budget_score = 25
    elif bant_data.get("budget_range"):
        budget_score = 15
    elif contact.get("company"):
        budget_score = 10

    # 2. AUTHORITY (25 points)
    title = contact.get("job_title", "").lower() if contact.get("job_title") else ""
    authority_titles = ["ceo", "vp", "president", "director", "head", "chief"]
    
    for at in authority_titles:
        if at in title:
            authority_score = 25
            break
    
    if authority_score == 0 and title:
        authority_score = 10

    # 3. NEED (25 points)
    if bant_data.get("need_documented"):
        need_score = 25
    elif bant_data.get("need_identified"):
        need_score = 15
    elif contact.get("enrichment_status") == "completed":
        need_score = 10

    # 4. TIMELINE (25 points)
    if bant_data.get("timeline_set"):
        timeline_score = 25
    elif bant_data.get("timeline_identified"):
        timeline_score = 15
    elif contact.get("enriched_at"):
        timeline_score = 10

    total_score = budget_score + authority_score + need_score + timeline_score

    # Determine tier
    if total_score >= thresholds.get("hotMin", 71):
        tier = "hot"
    elif total_score >= thresholds.get("warmMin", 40):
        tier = "warm"
    else:
        tier = "cold"

    return {
        "score": total_score,
        "tier": tier,
        "breakdown": {
            "budget": budget_score,
            "authority": authority_score,
            "need": need_score,
            "timeline": timeline_score
        },
        "framework": "BANT",
        "calculated_at": datetime.utcnow().isoformat()
    }


def calculate_spice_score(contact: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate SPICE (Situation-Problem-Implication-Critical Event-Decision) score
    Returns dict with score, tier, and breakdown
    """
    weights = config.get("weights", {
        "situation": 20,
        "problem": 20,
        "implication": 20,
        "criticalEvent": 20,
        "decision": 20
    })
    thresholds = config.get("thresholds", {
        "hotMin": 71,
        "warmMin": 40
    })

    # Initialize scores
    situation_score = 0
    problem_score = 0
    implication_score = 0
    critical_event_score = 0
    decision_score = 0

    spice_data = contact.get("enrichment_data", {}).get("spice", {}) if isinstance(contact.get("enrichment_data"), dict) else {}

    # 1. SITUATION (20 points)
    if spice_data.get("situation_documented"):
        situation_score = 20
    elif contact.get("company"):
        situation_score = 10

    # 2. PROBLEM (20 points)
    if spice_data.get("problem_identified"):
        problem_score = 20
    elif contact.get("enrichment_data", {}).get("talking_points") if isinstance(contact.get("enrichment_data"), dict) else False:
        problem_score = 10

    # 3. IMPLICATION (20 points)
    if spice_data.get("implication_quantified"):
        implication_score = 20
    elif spice_data.get("implication_described"):
        implication_score = 10

    # 4. CRITICAL EVENT (20 points)
    if spice_data.get("critical_event_identified"):
        critical_event_score = 20
    elif spice_data.get("critical_event_date"):
        critical_event_score = 15

    # 5. DECISION (20 points)
    if spice_data.get("decision_process_confirmed"):
        decision_score = 20
    elif spice_data.get("decision_stakeholders_mapped"):
        decision_score = 15
    elif contact.get("job_title"):
        decision_score = 10

    total_score = (situation_score + problem_score + implication_score +
                   critical_event_score + decision_score)

    # Determine tier
    if total_score >= thresholds.get("hotMin", 71):
        tier = "hot"
    elif total_score >= thresholds.get("warmMin", 40):
        tier = "warm"
    else:
        tier = "cold"

    return {
        "score": total_score,
        "tier": tier,
        "breakdown": {
            "situation": situation_score,
            "problem": problem_score,
            "implication": implication_score,
            "criticalEvent": critical_event_score,
            "decision": decision_score
        },
        "framework": "SPICE",
        "calculated_at": datetime.utcnow().isoformat()
    }
