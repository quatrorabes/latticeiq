"""
LatticeIQ Scoring Module
=========================
Implements 4 lead scoring frameworks:
1. APEX - Affinity, Pain, eXecution, eXpert (0-100)
2. MDC - Money, Decision-maker, Champion (0-100)
3. BANT - Budget, Authority, Need, Timeline (0-100)
4. SPICE - Situation, Problem, Implication, Consequence, Economic (0-100)

Each framework calculates a 0-100 score and assigns a tier: Hot (71+), Warm (40-70), Cold (<40)
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# APEX FRAMEWORK - Affinity, Pain, eXecution, eXpert
# ============================================================================
# Best for: Sales qualification, quick assessment
# Accuracy: 85% with quick enrich
# Time to evaluate: Immediate
# ============================================================================

class APEXCalculator:
    """
    APEX Scoring Framework
    
    A = Affinity (fit to profile) 0-25 points
    P = Pain (problem resonance) 0-25 points
    E = eXecution (budget/capability) 0-25 points
    X = eXpert (decision-maker quality) 0-25 points
    
    Total: 0-100 points
    Hot: 71+, Warm: 40-70, Cold: <40
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize APEX calculator with optional configuration"""
        self.config = config or self._default_config()
    
    @staticmethod
    def _default_config() -> Dict[str, Any]:
        """Default APEX configuration"""
        return {
            'affinity_weight': 25,
            'pain_weight': 25,
            'execution_weight': 25,
            'expert_weight': 25,
            'hot_threshold': 71,
            'warm_threshold': 40,
            'target_verticals': ['SaaS', 'Tech', 'Software', 'B2B'],
            'pain_keywords': ['growth', 'scale', 'efficiency', 'automation', 'revenue', 'speed'],
            'company_sizes': ['50-200', '200-500', '500-1000', '1000+'],
            'expert_titles': ['VP', 'Director', 'C-level', 'Chief', 'Head of', 'President', 'Founder']
        }
    
    def calculate(self, contact: Dict[str, Any], enrichment_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Calculate APEX score for a contact
        
        Args:
            contact: Contact data dict
            enrichment_data: Enrichment data from Perplexity API
            
        Returns:
            {
                'score': 0-100,
                'tier': 'Hot'|'Warm'|'Cold',
                'breakdown': {
                    'affinity': 0-25,
                    'pain': 0-25,
                    'execution': 0-25,
                    'expert': 0-25
                },
                'framework': 'APEX'
            }
        """
        if enrichment_data is None:
            enrichment_data = contact.get('enrichment_data', {})
        
        score = 0
        breakdown = {}
        
        # A = Affinity: Industry/vertical fit
        affinity_points = self._calculate_affinity(enrichment_data)
        score += affinity_points
        breakdown['affinity'] = affinity_points
        
        # P = Pain: Problem resonance in company
        pain_points = self._calculate_pain(enrichment_data)
        score += pain_points
        breakdown['pain'] = pain_points
        
        # E = eXecution: Budget and execution capability
        execution_points = self._calculate_execution(enrichment_data, contact)
        score += execution_points
        breakdown['execution'] = execution_points
        
        # X = eXpert: Decision-maker quality and authority
        expert_points = self._calculate_expert(contact, enrichment_data)
        score += expert_points
        breakdown['expert'] = expert_points
        
        # Determine tier
        tier = self._determine_tier(score)
        
        return {
            'score': float(score),
            'tier': tier,
            'breakdown': breakdown,
            'framework': 'APEX'
        }
    
    def _calculate_affinity(self, enrichment_data: Dict[str, Any]) -> int:
        """Calculate affinity score (0-25)"""
        points = 0
        
        # Check vertical match
        vertical = enrichment_data.get('vertical', '').lower()
        for target in self.config['target_verticals']:
            if target.lower() in vertical:
                points = self.config['affinity_weight']
                break
        
        return points
    
    def _calculate_pain(self, enrichment_data: Dict[str, Any]) -> int:
        """Calculate pain score (0-25)"""
        points = 0
        
        # Check for pain keywords in talking points or summary
        text = (str(enrichment_data.get('talking_points', '')) + ' ' + 
                str(enrichment_data.get('summary', ''))).lower()
        
        for keyword in self.config['pain_keywords']:
            if keyword.lower() in text:
                points = self.config['pain_weight']
                break
        
        return points
    
    def _calculate_execution(self, enrichment_data: Dict[str, Any], contact: Dict[str, Any]) -> int:
        """Calculate execution score (0-25)"""
        points = 0
        
        # Check company size (proxy for execution capability)
        company_size = str(enrichment_data.get('company_size', '')).lower()
        for size in self.config['company_sizes']:
            if size.lower() in company_size:
                points = self.config['execution_weight']
                break
        
        return points
    
    def _calculate_expert(self, contact: Dict[str, Any], enrichment_data: Dict[str, Any]) -> int:
        """Calculate expert score (0-25)"""
        points = 0
        
        # Check title level
        title = str(contact.get('title', '')).lower()
        for expert_title in self.config['expert_titles']:
            if expert_title.lower() in title:
                points = self.config['expert_weight']
                break
        
        return points
    
    def _determine_tier(self, score: float) -> str:
        """Determine tier based on score"""
        if score >= self.config['hot_threshold']:
            return 'Hot'
        elif score >= self.config['warm_threshold']:
            return 'Warm'
        else:
            return 'Cold'


# ============================================================================
# MDC FRAMEWORK - Money, Decision-maker, Champion
# ============================================================================
# Best for: Sales qualification with deal focus
# Accuracy: 85% with quick enrich
# Time to evaluate: Immediate
# ============================================================================

class MDCCalculator:
    """
    MDC Scoring Framework (Money, Decision-maker, Champion)
    
    M = Money (budget exists) 0-33 points
    D = Decision-maker (role authority) 0-33 points
    C = Champion (will advocate) 0-33 points
    
    Total: 0-100 points
    Hot: 71+, Warm: 40-70, Cold: <40
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize MDC calculator with optional configuration"""
        self.config = config or self._default_config()
    
    @staticmethod
    def _default_config() -> Dict[str, Any]:
        """Default MDC configuration"""
        return {
            'money_weight': 33,
            'decision_maker_weight': 33,
            'champion_weight': 33,
            'hot_threshold': 71,
            'warm_threshold': 40,
            'money_min_revenue': 1_000_000,      # $1M minimum
            'money_max_revenue': 10_000_000_000,  # $10B maximum
            'decision_maker_titles': ['CEO', 'CTO', 'CFO', 'COO', 'VP', 'President', 'Founder', 'Head of'],
            'champion_engagement_days': 30  # Enriched within 30 days = champion
        }
    
    def calculate(self, contact: Dict[str, Any], enrichment_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Calculate MDC score for a contact
        
        Args:
            contact: Contact data dict
            enrichment_data: Enrichment data from Perplexity API
            
        Returns:
            {
                'score': 0-100,
                'tier': 'Hot'|'Warm'|'Cold',
                'breakdown': {
                    'money': 0-33,
                    'decision_maker': 0-33,
                    'champion': 0-33
                },
                'framework': 'MDC'
            }
        """
        if enrichment_data is None:
            enrichment_data = contact.get('enrichment_data', {})
        
        score = 0
        breakdown = {}
        
        # M = Money: Budget capability
        money_points = self._calculate_money(enrichment_data, contact)
        score += money_points
        breakdown['money'] = money_points
        
        # D = Decision-maker: Authority to buy
        decision_maker_points = self._calculate_decision_maker(contact)
        score += decision_maker_points
        breakdown['decision_maker'] = decision_maker_points
        
        # C = Champion: Will advocate internally
        champion_points = self._calculate_champion(contact)
        score += champion_points
        breakdown['champion'] = champion_points
        
        # Determine tier
        tier = self._determine_tier(score)
        
        return {
            'score': float(score),
            'tier': tier,
            'breakdown': breakdown,
            'framework': 'MDC'
        }
    
    def _calculate_money(self, enrichment_data: Dict[str, Any], contact: Dict[str, Any]) -> int:
        """Calculate money score (0-33)"""
        points = 0
        
        try:
            # Try enrichment data first, then contact data
            revenue = enrichment_data.get('annual_revenue') or contact.get('company_revenue')
            
            if revenue:
                revenue_val = float(revenue)
                min_rev = self.config['money_min_revenue']
                max_rev = self.config['money_max_revenue']
                
                if min_rev <= revenue_val <= max_rev:
                    points = self.config['money_weight']
        except (ValueError, TypeError):
            pass
        
        return points
    
    def _calculate_decision_maker(self, contact: Dict[str, Any]) -> int:
        """Calculate decision-maker score (0-33)"""
        points = 0
        
        title = str(contact.get('title', '')).lower()
        
        for dm_title in self.config['decision_maker_titles']:
            if dm_title.lower() in title:
                points = self.config['decision_maker_weight']
                break
        
        return points
    
    def _calculate_champion(self, contact: Dict[str, Any]) -> int:
        """Calculate champion score (0-33)"""
        points = 0
        
        # Has been enriched recently = engaged/interested
        enriched_at = contact.get('enriched_at')
        if enriched_at:
            try:
                enriched_date = datetime.fromisoformat(
                    str(enriched_at).replace('Z', '+00:00')
                )
                now = datetime.now(enriched_date.tzinfo)
                days_since = (now - enriched_date).days
                
                if days_since <= self.config['champion_engagement_days']:
                    points = self.config['champion_weight']
            except (ValueError, TypeError):
                pass
        
        return points
    
    def _determine_tier(self, score: float) -> str:
        """Determine tier based on score"""
        if score >= self.config['hot_threshold']:
            return 'Hot'
        elif score >= self.config['warm_threshold']:
            return 'Warm'
        else:
            return 'Cold'


# ============================================================================
# BANT FRAMEWORK - Budget, Authority, Need, Timeline
# ============================================================================
# Best for: Enterprise sales, deal qualification
# Accuracy: 76% with quick enrich
# Time to evaluate: Requires additional research
# ============================================================================

class BANTCalculator:
    """
    BANT Scoring Framework (Budget, Authority, Need, Timeline)
    
    B = Budget (purchasing power) 0-25 points
    A = Authority (decision-maker) 0-25 points
    N = Need (problem resonance) 0-25 points
    T = Timeline (when will buy) 0-25 points
    
    Total: 0-100 points
    Hot: 71+, Warm: 40-70, Cold: <40
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize BANT calculator with optional configuration"""
        self.config = config or self._default_config()
    
    @staticmethod
    def _default_config() -> Dict[str, Any]:
        """Default BANT configuration"""
        return {
            'budget_weight': 25,
            'authority_weight': 25,
            'need_weight': 25,
            'timeline_weight': 25,
            'hot_threshold': 71,
            'warm_threshold': 40,
            'budget_min': 50_000,
            'budget_max': 100_000_000,
            'authority_titles': ['VP', 'Director', 'C-level', 'Chief', 'President', 'Head of'],
            'need_keywords': ['growth', 'scale', 'efficiency', 'automation', 'revenue', 'challenge', 'problem', 'issue'],
            'timeline_urgency': ['immediate', 'urgent', 'soon', 'asap', 'this quarter', 'q1', 'q2']
        }
    
    def calculate(self, contact: Dict[str, Any], enrichment_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Calculate BANT score for a contact
        
        Args:
            contact: Contact data dict
            enrichment_data: Enrichment data from Perplexity API
            
        Returns:
            {
                'score': 0-100,
                'tier': 'Hot'|'Warm'|'Cold',
                'breakdown': {
                    'budget': 0-25,
                    'authority': 0-25,
                    'need': 0-25,
                    'timeline': 0-25
                },
                'framework': 'BANT'
            }
        """
        if enrichment_data is None:
            enrichment_data = contact.get('enrichment_data', {})
        
        score = 0
        breakdown = {}
        
        # B = Budget: Can afford the solution
        budget_points = self._calculate_budget(enrichment_data, contact)
        score += budget_points
        breakdown['budget'] = budget_points
        
        # A = Authority: Can make the decision
        authority_points = self._calculate_authority(contact)
        score += authority_points
        breakdown['authority'] = authority_points
        
        # N = Need: Has the problem we solve
        need_points = self._calculate_need(enrichment_data)
        score += need_points
        breakdown['need'] = need_points
        
        # T = Timeline: When will they buy
        timeline_points = self._calculate_timeline(enrichment_data)
        score += timeline_points
        breakdown['timeline'] = timeline_points
        
        # Determine tier
        tier = self._determine_tier(score)
        
        return {
            'score': float(score),
            'tier': tier,
            'breakdown': breakdown,
            'framework': 'BANT'
        }
    
    def _calculate_budget(self, enrichment_data: Dict[str, Any], contact: Dict[str, Any]) -> int:
        """Calculate budget score (0-25)"""
        points = 0
        
        try:
            # Check company revenue as proxy for budget
            revenue = enrichment_data.get('annual_revenue') or contact.get('company_revenue')
            if revenue:
                revenue_val = float(revenue)
                if revenue_val >= self.config['budget_min']:
                    points = self.config['budget_weight']
        except (ValueError, TypeError):
            pass
        
        return points
    
    def _calculate_authority(self, contact: Dict[str, Any]) -> int:
        """Calculate authority score (0-25)"""
        points = 0
        
        title = str(contact.get('title', '')).lower()
        
        for auth_title in self.config['authority_titles']:
            if auth_title.lower() in title:
                points = self.config['authority_weight']
                break
        
        return points
    
    def _calculate_need(self, enrichment_data: Dict[str, Any]) -> int:
        """Calculate need score (0-25)"""
        points = 0
        
        # Check for need keywords in enrichment data
        text = (str(enrichment_data.get('summary', '')) + ' ' + 
                str(enrichment_data.get('talking_points', ''))).lower()
        
        for keyword in self.config['need_keywords']:
            if keyword.lower() in text:
                points = self.config['need_weight']
                break
        
        return points
    
    def _calculate_timeline(self, enrichment_data: Dict[str, Any]) -> int:
        """Calculate timeline score (0-25)"""
        points = 0
        
        # Check for timeline signals in enrichment data
        text = (str(enrichment_data.get('summary', '')) + ' ' + 
                str(enrichment_data.get('talking_points', ''))).lower()
        
        for urgency in self.config['timeline_urgency']:
            if urgency.lower() in text:
                points = self.config['timeline_weight']
                break
        
        return points
    
    def _determine_tier(self, score: float) -> str:
        """Determine tier based on score"""
        if score >= self.config['hot_threshold']:
            return 'Hot'
        elif score >= self.config['warm_threshold']:
            return 'Warm'
        else:
            return 'Cold'


# ============================================================================
# SPICE FRAMEWORK - Situation, Problem, Implication, Consequence, Economic
# ============================================================================
# Best for: Complex solutions, consultative selling
# Accuracy: 50% with quick enrich, 85% with Phase 2 full enrichment
# Time to evaluate: Requires deep research
# ============================================================================

class SPICECalculator:
    """
    SPICE Scoring Framework (Situation, Problem, Implication, Consequence, Economic)
    
    S = Situation (current state) 0-20 points
    P = Problem (specific challenge) 0-20 points
    I = Implication (business impact) 0-20 points
    C = Consequence (risk/urgency) 0-20 points
    E = Economic (financial impact) 0-20 points
    
    Total: 0-100 points
    Hot: 71+, Warm: 40-70, Cold: <40
    
    Note: SPICE works best with Phase 2 deep enrichment. 
    With quick enrich, expect 50% accuracy.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize SPICE calculator with optional configuration"""
        self.config = config or self._default_config()
    
    @staticmethod
    def _default_config() -> Dict[str, Any]:
        """Default SPICE configuration"""
        return {
            'situation_weight': 20,
            'problem_weight': 20,
            'implication_weight': 20,
            'consequence_weight': 20,
            'economic_weight': 20,
            'hot_threshold': 71,
            'warm_threshold': 40,
            'problem_keywords': ['challenge', 'issue', 'problem', 'difficulty', 'pain point', 'struggle', 'barrier'],
            'implication_keywords': ['impact', 'affect', 'consequence', 'result', 'effect', 'influence', 'dependency'],
            'consequence_keywords': ['risk', 'critical', 'urgent', 'important', 'essential', 'mandatory', 'compliance'],
            'economic_keywords': ['revenue', 'cost', 'savings', 'profit', 'margin', 'investment', 'roi', 'financial']
        }
    
    def calculate(self, contact: Dict[str, Any], enrichment_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Calculate SPICE score for a contact
        
        Args:
            contact: Contact data dict
            enrichment_data: Enrichment data from Perplexity API (ideally Phase 2 deep enrichment)
            
        Returns:
            {
                'score': 0-100,
                'tier': 'Hot'|'Warm'|'Cold',
                'breakdown': {
                    'situation': 0-20,
                    'problem': 0-20,
                    'implication': 0-20,
                    'consequence': 0-20,
                    'economic': 0-20
                },
                'framework': 'SPICE'
            }
        """
        if enrichment_data is None:
            enrichment_data = contact.get('enrichment_data', {})
        
        score = 0
        breakdown = {}
        
        # S = Situation: Current company situation/context
        situation_points = self._calculate_situation(contact, enrichment_data)
        score += situation_points
        breakdown['situation'] = situation_points
        
        # P = Problem: Specific problem/challenge
        problem_points = self._calculate_problem(enrichment_data)
        score += problem_points
        breakdown['problem'] = problem_points
        
        # I = Implication: Business impact of problem
        implication_points = self._calculate_implication(enrichment_data)
        score += implication_points
        breakdown['implication'] = implication_points
        
        # C = Consequence: Risk and urgency
        consequence_points = self._calculate_consequence(enrichment_data)
        score += consequence_points
        breakdown['consequence'] = consequence_points
        
        # E = Economic: Financial impact quantified
        economic_points = self._calculate_economic(enrichment_data, contact)
        score += economic_points
        breakdown['economic'] = economic_points
        
        # Determine tier
        tier = self._determine_tier(score)
        
        return {
            'score': float(score),
            'tier': tier,
            'breakdown': breakdown,
            'framework': 'SPICE'
        }
    
    def _calculate_situation(self, contact: Dict[str, Any], enrichment_data: Dict[str, Any]) -> int:
        """Calculate situation score (0-20)"""
        points = 0
        
        # Has company context information
        if contact.get('company') or enrichment_data.get('company_description'):
            points = self.config['situation_weight']
        
        return points
    
    def _calculate_problem(self, enrichment_data: Dict[str, Any]) -> int:
        """Calculate problem score (0-20)"""
        points = 0
        
        text = (str(enrichment_data.get('summary', '')) + ' ' + 
                str(enrichment_data.get('talking_points', ''))).lower()
        
        for keyword in self.config['problem_keywords']:
            if keyword.lower() in text:
                points = self.config['problem_weight']
                break
        
        return points
    
    def _calculate_implication(self, enrichment_data: Dict[str, Any]) -> int:
        """Calculate implication score (0-20)"""
        points = 0
        
        text = (str(enrichment_data.get('summary', '')) + ' ' + 
                str(enrichment_data.get('talking_points', ''))).lower()
        
        for keyword in self.config['implication_keywords']:
            if keyword.lower() in text:
                points = self.config['implication_weight']
                break
        
        return points
    
    def _calculate_consequence(self, enrichment_data: Dict[str, Any]) -> int:
        """Calculate consequence score (0-20)"""
        points = 0
        
        text = (str(enrichment_data.get('summary', '')) + ' ' + 
                str(enrichment_data.get('talking_points', ''))).lower()
        
        for keyword in self.config['consequence_keywords']:
            if keyword.lower() in text:
                points = self.config['consequence_weight']
                break
        
        return points
    
    def _calculate_economic(self, enrichment_data: Dict[str, Any], contact: Dict[str, Any]) -> int:
        """Calculate economic score (0-20)"""
        points = 0
        
        # Has revenue/financial info
        has_economic_data = False
        
        if enrichment_data.get('annual_revenue') or contact.get('company_revenue'):
            has_economic_data = True
        
        # Has economic keywords
        text = (str(enrichment_data.get('summary', '')) + ' ' + 
                str(enrichment_data.get('talking_points', ''))).lower()
        
        for keyword in self.config['economic_keywords']:
            if keyword.lower() in text:
                has_economic_data = True
                break
        
        if has_economic_data:
            points = self.config['economic_weight']
        
        return points
    
    def _determine_tier(self, score: float) -> str:
        """Determine tier based on score"""
        if score >= self.config['hot_threshold']:
            return 'Hot'
        elif score >= self.config['warm_threshold']:
            return 'Warm'
        else:
            return 'Cold'


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def calculate_all_scores(
    contact: Dict[str, Any],
    enrichment_data: Optional[Dict[str, Any]] = None,
    frameworks: Optional[list] = None
) -> Dict[str, Any]:
    """
    Calculate scores for all requested frameworks
    
    Args:
        contact: Contact data
        enrichment_data: Enrichment data
        frameworks: List of frameworks to calculate. If None, calculates all.
                   Options: ['APEX', 'MDC', 'BANT', 'SPICE']
    
    Returns:
        {
            'contact_id': contact_id,
            'scores': {
                'APEX': {'score': 75, 'tier': 'Hot', ...},
                'MDC': {'score': 66, 'tier': 'Warm', ...},
                ...
            },
            'best_score': 75,
            'best_framework': 'APEX',
            'average_score': 68.5,
            'recommended_tier': 'Hot'
        }
    """
    if frameworks is None:
        frameworks = ['APEX', 'MDC', 'BANT', 'SPICE']
    
    if enrichment_data is None:
        enrichment_data = contact.get('enrichment_data', {})
    
    scores = {}
    framework_scores = []
    
    if 'APEX' in frameworks:
        apex_calc = APEXCalculator()
        scores['APEX'] = apex_calc.calculate(contact, enrichment_data)
        framework_scores.append(scores['APEX']['score'])
    
    if 'MDC' in frameworks:
        mdc_calc = MDCCalculator()
        scores['MDC'] = mdc_calc.calculate(contact, enrichment_data)
        framework_scores.append(scores['MDC']['score'])
    
    if 'BANT' in frameworks:
        bant_calc = BANTCalculator()
        scores['BANT'] = bant_calc.calculate(contact, enrichment_data)
        framework_scores.append(scores['BANT']['score'])
    
    if 'SPICE' in frameworks:
        spice_calc = SPICECalculator()
        scores['SPICE'] = spice_calc.calculate(contact, enrichment_data)
        framework_scores.append(scores['SPICE']['score'])
    
    # Calculate aggregate metrics
    best_score = max(framework_scores) if framework_scores else 0
    best_framework = [k for k, v in scores.items() if v['score'] == best_score][0] if best_score else 'N/A'
    average_score = sum(framework_scores) / len(framework_scores) if framework_scores else 0
    
    # Determine recommended tier based on best score
    if best_score >= 71:
        recommended_tier = 'Hot'
    elif best_score >= 40:
        recommended_tier = 'Warm'
    else:
        recommended_tier = 'Cold'
    
    return {
        'contact_id': contact.get('id'),
        'scores': scores,
        'best_score': round(best_score, 1),
        'best_framework': best_framework,
        'average_score': round(average_score, 1),
        'recommended_tier': recommended_tier,
        'frameworks_evaluated': list(scores.keys())
    }


def get_default_config(framework: str) -> Dict[str, Any]:
    """Get default configuration for a framework"""
    configs = {
        'APEX': APEXCalculator._default_config(),
        'MDC': MDCCalculator._default_config(),
        'BANT': BANTCalculator._default_config(),
        'SPICE': SPICECalculator._default_config()
    }
    return configs.get(framework, {})


# File: apps/backend/api/routes/contactsv2.py (existing file, modify)

@router.get("/api/v2/contacts/{contact_id}/rescore")
async def rescore_contact(
    contact_id: uuid.UUID,
    profile_id: uuid.UUID = None,  # If not provided, use workspace default
    workspace_id: uuid.UUID = Depends(get_current_workspace),
    db = Depends(get_db)
):
    """Rescore a single contact using profile configuration."""
    
    from services.scoring_service import ScoringService
    
    # Get contact
    contact = db.execute("SELECT * FROM contacts WHERE id = %s", (contact_id,)).fetchone()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
        
    # Get profile (use provided or find default for workspace)
    if not profile_id:
        profile = db.execute("""
            SELECT id FROM profiles WHERE workspace_id = %s AND status = 'Active' LIMIT 1
        """, (workspace_id,)).fetchone()
        
        if not profile:
            raise HTTPException(status_code=404, detail="No active profile found for workspace")
        profile_id = profile['id']
        
    # Load profile config & calculate score
    scoring_service = ScoringService(db)
    profile_config = scoring_service.load_profile_config(workspace_id, profile_id)
    score_result = scoring_service.calculate_mdcp_score_with_profile(dict(contact), profile_config)
    
    # Update contact with new scores
    db.execute("""
        UPDATE contacts 
        SET mdcp_score = %s, lead_tier = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """, (score_result['mdcp_score'], score_result['lead_tier'], contact_id))

    db.commit()
    
    return {
        "success": True,
        "contact_id": str(contact_id),
        "new_mdcp_score": score_result['mdcp_score'],
        "new_lead_tier": score_result['lead_tier'],
        "score_breakdown": {
            "firmographic": score_result['firmographic_score'],
            "demographic": score_result['demographic_score'],
            "behavioral": score_result['behavioral_score'],
            "profile_completeness": score_result['profile_score']
        }
    }

@router.post("/api/v2/contacts/batch-rescore")
async def batch_rescore_contacts(
    profile_id: uuid.UUID = None,
    workspace_id: uuid.UUID = Depends(get_current_workspace),
    db = Depends(get_db)
):
    """Rescore ALL contacts for a workspace using active profile."""
    
    from services.scoring_service import ScoringService
    
    if not profile_id:
        profile = db.execute("""
            SELECT id FROM profiles WHERE workspace_id = %s AND status = 'Active' LIMIT 1
        """, (workspace_id,)).fetchone()
        
        if not profile:
            raise HTTPException(status_code=404, detail="No active profile found")
        profile_id = profile['id']
        
    # Get all contacts
    contacts = db.execute("""
        SELECT * FROM contacts WHERE workspace_id = %s
    """, (workspace_id,)).fetchall()

    # Rescore all
    scoring_service = ScoringService(db)
    profile_config = scoring_service.load_profile_config(workspace_id, profile_id)
    
    updated_count = 0
    for contact in contacts:
        score_result = scoring_service.calculate_mdcp_score_with_profile(dict(contact), profile_config)
        
        db.execute("""
            UPDATE contacts 
            SET mdcp_score = %s, lead_tier = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (score_result['mdcp_score'], score_result['lead_tier'], contact['id']))
        
        updated_count += 1
        
    db.commit()
    
    return {
        "success": True,
        "contacts_updated": updated_count,
        "profile_id": str(profile_id)
    }


# ============================================================================
# EXPORT CALCULATORS
# ============================================================================

__all__ = [
    'APEXCalculator',
    'MDCCalculator',
    'BANTCalculator',
    'SPICECalculator',
    'calculate_all_scores',
    'get_default_config'
]
