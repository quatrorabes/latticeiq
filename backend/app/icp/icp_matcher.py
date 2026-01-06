# backend/app/icp/icp_matcher.py
"""
ICPMatcher: Match contacts against Ideal Client Profile criteria
Calculates fit scores and identifies best-match contacts
"""

from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import re
from datetime import datetime

from app.fields.field_accessor import field_accessor, get_contact_field


class MatchOperator(str, Enum):
    """Supported matching operators"""
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    IN_LIST = "in_list"
    NOT_IN_LIST = "not_in_list"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    BETWEEN = "between"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"
    REGEX = "regex"


@dataclass
class ICPCriterion:
    """A single ICP matching criterion"""
    field_name: str
    operator: MatchOperator
    value: Any
    weight: float = 1.0  # 0.0 to 1.0
    required: bool = False  # If True, must match for any score
    

@dataclass
class ICPMatchResult:
    """Result of matching a contact against ICP"""
    contact_id: str
    total_score: float  # 0-100
    weighted_score: float  # Weighted average
    criteria_results: List[Dict[str, Any]]
    matched_criteria: int
    total_criteria: int
    match_percentage: float
    tier: str  # A, B, C, D
    is_qualified: bool  # Meets all required criteria
    matched_at: str


class ICPProfile:
    """
    Ideal Client Profile definition.
    
    Example:
        profile = ICPProfile(
            name="Enterprise SaaS",
            criteria=[
                ICPCriterion("company_industry", MatchOperator.IN_LIST, 
                            ["Technology", "SaaS", "Software"], weight=0.3),
                ICPCriterion("company_employee_count", MatchOperator.GREATER_THAN, 
                            "100", weight=0.2),
                ICPCriterion("funding_total", MatchOperator.IS_NOT_EMPTY, 
                            None, weight=0.25),
                ICPCriterion("job_title", MatchOperator.CONTAINS, 
                            ["VP", "Director", "Head", "Chief"], weight=0.25, required=True),
            ]
        )
    """
    
    def __init__(
        self,
        name: str,
        criteria: List[ICPCriterion],
        description: Optional[str] = None,
        min_score_threshold: float = 50.0,
        tier_thresholds: Optional[Dict[str, float]] = None
    ):
        self.name = name
        self.criteria = criteria
        self.description = description
        self.min_score_threshold = min_score_threshold
        self.tier_thresholds = tier_thresholds or {
            "A": 80.0,
            "B": 60.0,
            "C": 40.0,
            "D": 0.0
        }
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "criteria_count": len(self.criteria),
            "min_score_threshold": self.min_score_threshold,
            "tier_thresholds": self.tier_thresholds
        }


class ICPMatcher:
    """
    Matches contacts against Ideal Client Profiles.
    
    Usage:
        matcher = ICPMatcher()
        
        # Define an ICP
        profile = ICPProfile(
            name="Enterprise Tech",
            criteria=[
                ICPCriterion("company_industry", MatchOperator.CONTAINS, "Technology"),
                ICPCriterion("engagement_score", MatchOperator.GREATER_THAN, 50),
            ]
        )
        
        # Match a single contact
        result = matcher.match_contact(contact, profile)
        
        # Match multiple contacts
        results = matcher.match_contacts(contacts, profile)
        
        # Find best matches
        top_matches = matcher.find_top_matches(contacts, profile, limit=10)
    """
    
    # ============================================================
    # OPERATOR EVALUATION
    # ============================================================
    
    def _evaluate_criterion(
        self, 
        criterion: ICPCriterion, 
        contact: Dict[str, Any]
    ) -> Tuple[bool, str]:
        """
        Evaluate a single criterion against a contact.
        
        Returns:
            Tuple of (matched: bool, reason: str)
        """
        # Get field value
        field_result = field_accessor.get_field(contact, criterion.field_name)
        value = field_result.value
        target = criterion.value
        
        # Handle missing field
        if not field_result.found and criterion.operator not in [
            MatchOperator.IS_EMPTY, MatchOperator.IS_NOT_EMPTY
        ]:
            return False, f"Field '{criterion.field_name}' not found"
        
        try:
            match criterion.operator:
                case MatchOperator.EQUALS:
                    matched = str(value).lower() == str(target).lower()
                    return matched, f"{'Matches' if matched else 'Does not match'} '{target}'"
                
                case MatchOperator.NOT_EQUALS:
                    matched = str(value).lower() != str(target).lower()
                    return matched, f"{'Does not equal' if matched else 'Equals'} '{target}'"
                
                case MatchOperator.CONTAINS:
                    if isinstance(target, list):
                        matched = any(str(t).lower() in str(value).lower() for t in target)
                        return matched, f"{'Contains' if matched else 'Missing'} one of {target}"
                    matched = str(target).lower() in str(value).lower()
                    return matched, f"{'Contains' if matched else 'Missing'} '{target}'"
                
                case MatchOperator.NOT_CONTAINS:
                    if isinstance(target, list):
                        matched = not any(str(t).lower() in str(value).lower() for t in target)
                        return matched, f"{'Excludes' if matched else 'Contains'} {target}"
                    matched = str(target).lower() not in str(value).lower()
                    return matched, f"{'Excludes' if matched else 'Contains'} '{target}'"
                
                case MatchOperator.STARTS_WITH:
                    matched = str(value).lower().startswith(str(target).lower())
                    return matched, f"{'Starts with' if matched else 'Does not start with'} '{target}'"
                
                case MatchOperator.ENDS_WITH:
                    matched = str(value).lower().endswith(str(target).lower())
                    return matched, f"{'Ends with' if matched else 'Does not end with'} '{target}'"
                
                case MatchOperator.IN_LIST:
                    if not isinstance(target, list):
                        target = [target]
                    matched = str(value).lower() in [str(t).lower() for t in target]
                    return matched, f"{'In' if matched else 'Not in'} allowed list"
                
                case MatchOperator.NOT_IN_LIST:
                    if not isinstance(target, list):
                        target = [target]
                    matched = str(value).lower() not in [str(t).lower() for t in target]
                    return matched, f"{'Not in' if matched else 'In'} excluded list"
                
                case MatchOperator.GREATER_THAN:
                    num_value = self._to_number(value)
                    num_target = self._to_number(target)
                    if num_value is None or num_target is None:
                        return False, "Cannot compare non-numeric values"
                    matched = num_value > num_target
                    return matched, f"{num_value} {'>' if matched else '<='} {num_target}"
                
                case MatchOperator.LESS_THAN:
                    num_value = self._to_number(value)
                    num_target = self._to_number(target)
                    if num_value is None or num_target is None:
                        return False, "Cannot compare non-numeric values"
                    matched = num_value < num_target
                    return matched, f"{num_value} {'<' if matched else '>='} {num_target}"
                
                case MatchOperator.BETWEEN:
                    if not isinstance(target, (list, tuple)) or len(target) != 2:
                        return False, "BETWEEN requires [min, max] range"
                    num_value = self._to_number(value)
                    min_val = self._to_number(target[0])
                    max_val = self._to_number(target[1])
                    if None in [num_value, min_val, max_val]:
                        return False, "Cannot compare non-numeric values"
                    matched = min_val <= num_value <= max_val
                    return matched, f"{num_value} {'in' if matched else 'not in'} [{min_val}, {max_val}]"
                
                case MatchOperator.IS_EMPTY:
                    matched = value is None or value == "" or value == []
                    return matched, f"Field {'is' if matched else 'is not'} empty"
                
                case MatchOperator.IS_NOT_EMPTY:
                    matched = value is not None and value != "" and value != []
                    return matched, f"Field {'has' if matched else 'missing'} value"
                
                case MatchOperator.REGEX:
                    try:
                        matched = bool(re.search(str(target), str(value), re.IGNORECASE))
                        return matched, f"{'Matches' if matched else 'Does not match'} pattern"
                    except re.error:
                        return False, "Invalid regex pattern"
                
                case _:
                    return False, f"Unknown operator: {criterion.operator}"
                    
        except Exception as e:
            return False, f"Evaluation error: {str(e)}"
    
    def _to_number(self, value: Any) -> Optional[float]:
        """Convert value to number, extracting from strings like '$10M' or '1,000'"""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        
        try:
            # Remove common formatting
            str_val = str(value).replace(',', '').replace('$', '').strip()
            
            # Handle suffixes like K, M, B
            multipliers = {'k': 1e3, 'm': 1e6, 'b': 1e9, 't': 1e12}
            for suffix, mult in multipliers.items():
                if str_val.lower().endswith(suffix):
                    return float(str_val[:-1]) * mult
            
            # Extract first number from string
            match = re.search(r'[\d.]+', str_val)
            if match:
                return float(match.group())
            
            return None
        except (ValueError, TypeError):
            return None
    
    def _calculate_tier(self, score: float, thresholds: Dict[str, float]) -> str:
        """Calculate tier based on score and thresholds"""
        for tier in ['A', 'B', 'C', 'D']:
            if score >= thresholds.get(tier, 0):
                return tier
        return 'D'
    
    # ============================================================
    # CORE MATCHING METHODS
    # ============================================================
    
    def match_contact(
        self, 
        contact: Dict[str, Any], 
        profile: ICPProfile
    ) -> ICPMatchResult:
        """
        Match a single contact against an ICP profile.
        
        Args:
            contact: Contact data dictionary
            profile: ICP profile to match against
            
        Returns:
            ICPMatchResult with score and details
        """
        criteria_results = []
        total_weight = 0.0
        weighted_sum = 0.0
        matched_count = 0
        all_required_met = True
        
        for criterion in profile.criteria:
            matched, reason = self._evaluate_criterion(criterion, contact)
            
            criteria_results.append({
                "field": criterion.field_name,
                "operator": criterion.operator.value,
                "target": criterion.value,
                "matched": matched,
                "reason": reason,
                "weight": criterion.weight,
                "required": criterion.required
            })
            
            if matched:
                matched_count += 1
                weighted_sum += criterion.weight * 100
            
            total_weight += criterion.weight
            
            if criterion.required and not matched:
                all_required_met = False
        
        # Calculate scores
        total_criteria = len(profile.criteria)
        match_percentage = (matched_count / total_criteria * 100) if total_criteria > 0 else 0
        weighted_score = (weighted_sum / total_weight) if total_weight > 0 else 0
        
        # Total score is weighted average
        total_score = weighted_score
        
        # Calculate tier
        tier = self._calculate_tier(total_score, profile.tier_thresholds)
        
        # Qualified if all required criteria met AND score above threshold
        is_qualified = all_required_met and total_score >= profile.min_score_threshold
        
        return ICPMatchResult(
            contact_id=contact.get('id', ''),
            total_score=round(total_score, 1),
            weighted_score=round(weighted_score, 1),
            criteria_results=criteria_results,
            matched_criteria=matched_count,
            total_criteria=total_criteria,
            match_percentage=round(match_percentage, 1),
            tier=tier,
            is_qualified=is_qualified,
            matched_at=datetime.utcnow().isoformat()
        )
    
    def match_contacts(
        self, 
        contacts: List[Dict[str, Any]], 
        profile: ICPProfile
    ) -> List[ICPMatchResult]:
        """
        Match multiple contacts against an ICP profile.
        
        Args:
            contacts: List of contact dictionaries
            profile: ICP profile to match against
            
        Returns:
            List of ICPMatchResult for each contact
        """
        return [self.match_contact(contact, profile) for contact in contacts]
    
    def find_top_matches(
        self, 
        contacts: List[Dict[str, Any]], 
        profile: ICPProfile,
        limit: int = 10,
        min_score: float = 0.0,
        only_qualified: bool = False
    ) -> List[Tuple[Dict[str, Any], ICPMatchResult]]:
        """
        Find top matching contacts for an ICP profile.
        
        Args:
            contacts: List of contact dictionaries
            profile: ICP profile to match against
            limit: Maximum number of results
            min_score: Minimum score threshold
            only_qualified: Only return qualified contacts
            
        Returns:
            List of (contact, result) tuples, sorted by score descending
        """
        results = []
        
        for contact in contacts:
            result = self.match_contact(contact, profile)
            
            if result.total_score < min_score:
                continue
            
            if only_qualified and not result.is_qualified:
                continue
            
            results.append((contact, result))
        
        # Sort by score descending
        results.sort(key=lambda x: x[1].total_score, reverse=True)
        
        return results[:limit]
    
    def get_tier_distribution(
        self, 
        contacts: List[Dict[str, Any]], 
        profile: ICPProfile
    ) -> Dict[str, int]:
        """
        Get distribution of contacts across tiers.
        
        Returns:
            Dictionary with tier counts {'A': 10, 'B': 25, 'C': 50, 'D': 15}
        """
        distribution = {'A': 0, 'B': 0, 'C': 0, 'D': 0}
        
        for contact in contacts:
            result = self.match_contact(contact, profile)
            distribution[result.tier] += 1
        
        return distribution
    
    def get_match_summary(
        self, 
        contacts: List[Dict[str, Any]], 
        profile: ICPProfile
    ) -> Dict[str, Any]:
        """
        Get summary statistics for ICP matching.
        
        Returns:
            Summary with averages, distribution, top criteria, etc.
        """
        results = self.match_contacts(contacts, profile)
        
        if not results:
            return {
                "total_contacts": 0,
                "qualified_count": 0,
                "average_score": 0,
                "tier_distribution": {'A': 0, 'B': 0, 'C': 0, 'D': 0}
            }
        
        scores = [r.total_score for r in results]
        qualified = [r for r in results if r.is_qualified]
        
        # Calculate criteria hit rates
        criteria_hits = {}
        for result in results:
            for cr in result.criteria_results:
                field = cr['field']
                if field not in criteria_hits:
                    criteria_hits[field] = {'matches': 0, 'total': 0}
                criteria_hits[field]['total'] += 1
                if cr['matched']:
                    criteria_hits[field]['matches'] += 1
        
        criteria_rates = {
            field: round(data['matches'] / data['total'] * 100, 1)
            for field, data in criteria_hits.items()
        }
        
        return {
            "profile_name": profile.name,
            "total_contacts": len(results),
            "qualified_count": len(qualified),
            "qualified_percentage": round(len(qualified) / len(results) * 100, 1),
            "average_score": round(sum(scores) / len(scores), 1),
            "max_score": max(scores),
            "min_score": min(scores),
            "tier_distribution": self.get_tier_distribution(contacts, profile),
            "criteria_match_rates": criteria_rates
        }


# ============================================================
# SINGLETON INSTANCE
# ============================================================

icp_matcher = ICPMatcher()


# ============================================================
# FACTORY FUNCTIONS
# ============================================================

def create_icp_from_dict(config: Dict[str, Any]) -> ICPProfile:
    """
    Create an ICPProfile from a dictionary configuration.
    
    Expected format:
    {
        "name": "Enterprise Tech",
        "description": "High-value enterprise accounts",
        "criteria": [
            {"field": "company_industry", "operator": "in_list", "value": ["Tech", "SaaS"], "weight": 0.3},
            {"field": "engagement_score", "operator": "greater_than", "value": 50, "weight": 0.2, "required": true}
        ],
        "min_score_threshold": 60,
        "tier_thresholds": {"A": 80, "B": 60, "C": 40, "D": 0}
    }
    """
    criteria = []
    for c in config.get('criteria', []):
        criteria.append(ICPCriterion(
            field_name=c['field'],
            operator=MatchOperator(c['operator']),
            value=c.get('value'),
            weight=c.get('weight', 1.0),
            required=c.get('required', False)
        ))
    
    return ICPProfile(
        name=config['name'],
        criteria=criteria,
        description=config.get('description'),
        min_score_threshold=config.get('min_score_threshold', 50.0),
        tier_thresholds=config.get('tier_thresholds')
    )
