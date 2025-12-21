# backend/tests/test_scoring.py
"""
Complete test suite for LatticeIQ Scoring Module
Tests all 4 frameworks: APEX, MDC, BANT, SPICE
"""

import pytest
from datetime import datetime, timedelta
from scoring import (
    APEXCalculator,
    MDCCalculator,
    BANTCalculator,
    SPICECalculator,
    calculate_all_scores,
    get_default_config
)


# ============================================================================
# FIXTURES - Test Data
# ============================================================================

@pytest.fixture
def mock_hot_contact():
    """Contact that should score Hot across most frameworks"""
    return {
        'id': 'test-hot-001',
        'first_name': 'John',
        'last_name': 'Doe',
        'title': 'VP of Sales',
        'company': 'TechCorp Inc',
        'company_revenue': 50_000_000,
        'email': 'john@techcorp.com',
        'enriched_at': datetime.now().isoformat(),
        'enrichment_data': {
            'vertical': 'SaaS',
            'company_size': '200-500',
            'annual_revenue': 50_000_000,
            'talking_points': 'Looking to scale growth and improve efficiency through automation',
            'summary': 'TechCorp is a fast-growing SaaS company with expansion plans and urgent need for better processes',
            'inferred_title': 'VP of Sales'
        }
    }


@pytest.fixture
def mock_warm_contact():
    """Contact that should score Warm"""
    return {
        'id': 'test-warm-001',
        'first_name': 'Jane',
        'last_name': 'Smith',
        'title': 'Manager, Operations',
        'company': 'MidSize Corp',
        'company_revenue': 10_000_000,
        'enrichment_data': {
            'vertical': 'Manufacturing',
            'company_size': '50-200',
            'annual_revenue': 10_000_000,
            'talking_points': 'Growing company with some challenges',
            'summary': 'Mid-size manufacturer looking to improve'
        }
    }


@pytest.fixture
def mock_cold_contact():
    """Contact that should score Cold"""
    return {
        'id': 'test-cold-001',
        'first_name': 'Bob',
        'last_name': 'Johnson',
        'title': 'Intern',
        'company': 'SmallCo',
        'company_revenue': 100_000,
        'enrichment_data': {
            'vertical': 'Non-tech',
            'company_size': '<50',
            'annual_revenue': 100_000,
            'talking_points': 'Small startup',
            'summary': 'Very small company'
        }
    }


# ============================================================================
# APEX FRAMEWORK TESTS
# ============================================================================

class TestAPEXCalculator:
    """Test suite for APEX (Affinity, Pain, eXecution, eXpert) framework"""
    
    def test_apex_initialization(self):
        """Test APEX calculator initializes with default config"""
        apex = APEXCalculator()
        assert apex.config is not None
        assert apex.config['affinity_weight'] == 25
        assert apex.config['hot_threshold'] == 71
    
    def test_apex_custom_config(self):
        """Test APEX calculator with custom config"""
        custom_config = {'affinity_weight': 50, 'hot_threshold': 80}
        apex = APEXCalculator(custom_config)
        assert apex.config['affinity_weight'] == 50
    
    def test_apex_hot_contact(self, mock_hot_contact):
        """Test APEX scoring for Hot contact (VP at SaaS growth company)"""
        apex = APEXCalculator()
        result = apex.calculate(mock_hot_contact)
        
        assert result['framework'] == 'APEX'
        assert 0 <= result['score'] <= 100
        assert result['tier'] == 'Hot'
        assert 'affinity' in result['breakdown']
        assert 'pain' in result['breakdown']
        assert 'execution' in result['breakdown']
        assert 'expert' in result['breakdown']
    
    def test_apex_warm_contact(self, mock_warm_contact):
        """Test APEX scoring for Warm contact"""
        apex = APEXCalculator()
        result = apex.calculate(mock_warm_contact)
        
        assert result['framework'] == 'APEX'
        assert result['tier'] == 'Warm'
    
    def test_apex_cold_contact(self, mock_cold_contact):
        """Test APEX scoring for Cold contact"""
        apex = APEXCalculator()
        result = apex.calculate(mock_cold_contact)
        
        assert result['framework'] == 'APEX'
        assert result['tier'] == 'Cold'
    
    def test_apex_affinity_calculation(self):
        """Test affinity score (vertical matching)"""
        apex = APEXCalculator()
        
        # SaaS vertical should match
        contact_saas = {'enrichment_data': {'vertical': 'SaaS'}}
        affinity = apex._calculate_affinity(contact_saas.get('enrichment_data', {}))
        assert affinity == 25
        
        # Non-target vertical should not match
        contact_other = {'enrichment_data': {'vertical': 'Retail'}}
        affinity = apex._calculate_affinity(contact_other.get('enrichment_data', {}))
        assert affinity == 0
    
    def test_apex_pain_calculation(self):
        """Test pain score (keyword detection)"""
        apex = APEXCalculator()
        
        # Contains pain keyword
        enrichment_with_pain = {'talking_points': 'need to scale operations'}
        pain = apex._calculate_pain(enrichment_with_pain)
        assert pain == 25
        
        # No pain keywords
        enrichment_no_pain = {'talking_points': 'company doing fine'}
        pain = apex._calculate_pain(enrichment_no_pain)
        assert pain == 0
    
    def test_apex_execution_calculation(self):
        """Test execution score (company size)"""
        apex = APEXCalculator()
        
        # Right-sized company
        enrichment_right_size = {'company_size': '200-500'}
        execution = apex._calculate_execution(enrichment_right_size, {})
        assert execution == 25
        
        # Too small
        enrichment_small = {'company_size': '<50'}
        execution = apex._calculate_execution(enrichment_small, {})
        assert execution == 0
    
    def test_apex_expert_calculation(self):
        """Test expert score (title level)"""
        apex = APEXCalculator()
        
        # VP title
        contact_vp = {'title': 'VP of Sales'}
        expert = apex._calculate_expert(contact_vp, {})
        assert expert == 25
        
        # CEO title
        contact_ceo = {'title': 'Chief Executive Officer'}
        expert = apex._calculate_expert(contact_ceo, {})
        assert expert == 25
        
        # Intern title
        contact_intern = {'title': 'Intern'}
        expert = apex._calculate_expert(contact_intern, {})
        assert expert == 0
    
    def test_apex_missing_enrichment_data(self):
        """Test APEX handles missing enrichment data gracefully"""
        apex = APEXCalculator()
        contact = {'id': 'test-001', 'title': 'VP'}
        result = apex.calculate(contact, None)
        
        assert result['score'] >= 0
        assert result['tier'] in ['Hot', 'Warm', 'Cold']


# ============================================================================
# MDC FRAMEWORK TESTS
# ============================================================================

class TestMDCCalculator:
    """Test suite for MDC (Money, Decision-maker, Champion) framework"""
    
    def test_mdc_initialization(self):
        """Test MDC calculator initializes with default config"""
        mdc = MDCCalculator()
        assert mdc.config is not None
        assert mdc.config['money_weight'] == 33
        assert mdc.config['hot_threshold'] == 71
    
    def test_mdc_hot_contact(self, mock_hot_contact):
        """Test MDC scoring for Hot contact"""
        mdc = MDCCalculator()
        result = mdc.calculate(mock_hot_contact)
        
        assert result['framework'] == 'MDC'
        assert result['score'] >= 40  # Should at least be Warm
        assert 'money' in result['breakdown']
        assert 'decision_maker' in result['breakdown']
        assert 'champion' in result['breakdown']
    
    def test_mdc_money_calculation(self):
        """Test money score (revenue range)"""
        mdc = MDCCalculator()
        
        # Large company ($50M revenue)
        contact_large = {'company_revenue': 50_000_000}
        enrichment_large = {'annual_revenue': 50_000_000}
        money = mdc._calculate_money(enrichment_large, contact_large)
        assert money == 33
        
        # Too small company
        contact_small = {'company_revenue': 100_000}
        enrichment_small = {}
        money = mdc._calculate_money(enrichment_small, contact_small)
        assert money == 0
    
    def test_mdc_decision_maker_calculation(self):
        """Test decision-maker score (title authority)"""
        mdc = MDCCalculator()
        
        # C-level executive
        contact_exec = {'title': 'Chief Technology Officer'}
        dm = mdc._calculate_decision_maker(contact_exec)
        assert dm == 33
        
        # VP level
        contact_vp = {'title': 'VP of Operations'}
        dm = mdc._calculate_decision_maker(contact_vp)
        assert dm == 33
        
        # Individual contributor
        contact_ic = {'title': 'Software Engineer'}
        dm = mdc._calculate_decision_maker(contact_ic)
        assert dm == 0
    
    def test_mdc_champion_calculation(self):
        """Test champion score (engagement signals)"""
        mdc = MDCCalculator()
        
        # Recently enriched (champion)
        now = datetime.now()
        contact_recent = {'enriched_at': now.isoformat()}
        champion = mdc._calculate_champion(contact_recent)
        assert champion == 33
        
        # Enriched >30 days ago (not champion)
        old_date = now - timedelta(days=45)
        contact_old = {'enriched_at': old_date.isoformat()}
        champion = mdc._calculate_champion(contact_old)
        assert champion == 0
        
        # Never enriched
        contact_never = {}
        champion = mdc._calculate_champion(contact_never)
        assert champion == 0
    
    def test_mdc_score_range(self, mock_warm_contact):
        """Test MDC scores are always 0-100"""
        mdc = MDCCalculator()
        for _ in range(10):
            result = mdc.calculate(mock_warm_contact)
            assert 0 <= result['score'] <= 100


# ============================================================================
# BANT FRAMEWORK TESTS
# ============================================================================

class TestBANTCalculator:
    """Test suite for BANT (Budget, Authority, Need, Timeline) framework"""
    
    def test_bant_initialization(self):
        """Test BANT calculator initializes with default config"""
        bant = BANTCalculator()
        assert bant.config is not None
        assert bant.config['budget_weight'] == 25
        assert bant.config['hot_threshold'] == 71
    
    def test_bant_hot_contact(self, mock_hot_contact):
        """Test BANT scoring for Hot contact"""
        bant = BANTCalculator()
        result = bant.calculate(mock_hot_contact)
        
        assert result['framework'] == 'BANT'
        assert result['score'] >= 40
        assert 'budget' in result['breakdown']
        assert 'authority' in result['breakdown']
        assert 'need' in result['breakdown']
        assert 'timeline' in result['breakdown']
    
    def test_bant_budget_calculation(self):
        """Test budget score (revenue proxy)"""
        bant = BANTCalculator()
        
        # Large company
        enrichment_large = {'annual_revenue': 100_000_000}
        contact_large = {'company_revenue': 100_000_000}
        budget = bant._calculate_budget(enrichment_large, contact_large)
        assert budget == 25
        
        # Too small
        enrichment_small = {'annual_revenue': 10_000}
        contact_small = {}
        budget = bant._calculate_budget(enrichment_small, contact_small)
        assert budget == 0
    
    def test_bant_authority_calculation(self):
        """Test authority score (decision-maker titles)"""
        bant = BANTCalculator()
        
        # Director level
        contact_director = {'title': 'Director of Sales'}
        authority = bant._calculate_authority(contact_director)
        assert authority == 25
        
        # Non-decision-maker
        contact_contributor = {'title': 'Sales Representative'}
        authority = bant._calculate_authority(contact_contributor)
        assert authority == 0
    
    def test_bant_need_calculation(self):
        """Test need score (problem keywords)"""
        bant = BANTCalculator()
        
        # Has problem keywords
        enrichment_need = {'summary': 'We have a critical challenge with our processes'}
        need = bant._calculate_need(enrichment_need)
        assert need == 25
        
        # No problem keywords
        enrichment_no_need = {'summary': 'Everything is working fine'}
        need = bant._calculate_need(enrichment_no_need)
        assert need == 0
    
    def test_bant_timeline_calculation(self):
        """Test timeline score (urgency keywords)"""
        bant = BANTCalculator()
        
        # Urgent timeline
        enrichment_urgent = {'talking_points': 'We need to implement this immediately'}
        timeline = bant._calculate_timeline(enrichment_urgent)
        assert timeline == 25
        
        # No urgency
        enrichment_no_timeline = {'talking_points': 'Maybe someday we will consider'}
        timeline = bant._calculate_timeline(enrichment_no_timeline)
        assert timeline == 0


# ============================================================================
# SPICE FRAMEWORK TESTS
# ============================================================================

class TestSPICECalculator:
    """Test suite for SPICE (Situation, Problem, Implication, Consequence, Economic) framework"""
    
    def test_spice_initialization(self):
        """Test SPICE calculator initializes with default config"""
        spice = SPICECalculator()
        assert spice.config is not None
        assert spice.config['situation_weight'] == 20
        assert spice.config['hot_threshold'] == 71
    
    def test_spice_hot_contact(self, mock_hot_contact):
        """Test SPICE scoring for Hot contact"""
        spice = SPICECalculator()
        result = spice.calculate(mock_hot_contact)
        
        assert result['framework'] == 'SPICE'
        assert 'situation' in result['breakdown']
        assert 'problem' in result['breakdown']
        assert 'implication' in result['breakdown']
        assert 'consequence' in result['breakdown']
        assert 'economic' in result['breakdown']
    
    def test_spice_situation_calculation(self):
        """Test situation score (company context)"""
        spice = SPICECalculator()
        
        # Has company context
        contact_with_context = {'company': 'TechCorp Inc'}
        enrichment_with_context = {}
        situation = spice._calculate_situation(contact_with_context, enrichment_with_context)
        assert situation == 20
        
        # No company info
        contact_no_context = {}
        situation = spice._calculate_situation(contact_no_context, {})
        assert situation == 0
    
    def test_spice_problem_calculation(self):
        """Test problem score (problem keywords)"""
        spice = SPICECalculator()
        
        # Has problem keywords
        enrichment_problem = {'summary': 'Major challenge with scaling'}
        problem = spice._calculate_problem(enrichment_problem)
        assert problem == 20
        
        # No problem keywords
        enrichment_no_problem = {'summary': 'Things are great'}
        problem = spice._calculate_problem(enrichment_no_problem)
        assert problem == 0
    
    def test_spice_implication_calculation(self):
        """Test implication score (impact keywords)"""
        spice = SPICECalculator()
        
        # Has implication keywords
        enrichment_implication = {'summary': 'This impacts our entire revenue stream'}
        implication = spice._calculate_implication(enrichment_implication)
        assert implication == 20
        
        # No implication keywords
        enrichment_no_implication = {'summary': 'Neutral situation'}
        implication = spice._calculate_implication(enrichment_no_implication)
        assert implication == 0
    
    def test_spice_consequence_calculation(self):
        """Test consequence score (risk keywords)"""
        spice = SPICECalculator()
        
        # Has risk keywords
        enrichment_risk = {'summary': 'Critical issue requiring urgent attention'}
        consequence = spice._calculate_consequence(enrichment_risk)
        assert consequence == 20
        
        # No risk keywords
        enrichment_no_risk = {'summary': 'Minor inconvenience'}
        consequence = spice._calculate_consequence(enrichment_no_risk)
        assert consequence == 0
    
    def test_spice_economic_calculation(self):
        """Test economic score (financial data)"""
        spice = SPICECalculator()
        
        # Has revenue data
        enrichment_revenue = {'annual_revenue': 50_000_000}
        contact_revenue = {}
        economic = spice._calculate_economic(enrichment_revenue, contact_revenue)
        assert economic == 20
        
        # Has economic keywords
        enrichment_keywords = {'summary': 'Projected to save millions in annual costs'}
        economic = spice._calculate_economic(enrichment_keywords, {})
        assert economic == 20
        
        # No financial data
        economic = spice._calculate_economic({}, {})
        assert economic == 0


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestScoringIntegration:
    """Integration tests for all frameworks working together"""
    
    def test_calculate_all_scores_hot_contact(self, mock_hot_contact):
        """Test calculate_all_scores with Hot contact"""
        result = calculate_all_scores(mock_hot_contact)
        
        assert result['contact_id'] == 'test-hot-001'
        assert 'APEX' in result['scores']
        assert 'MDC' in result['scores']
        assert 'BANT' in result['scores']
        assert 'SPICE' in result['scores']
        assert result['recommended_tier'] == 'Hot'
        assert 40 <= result['average_score'] <= 100
    
    def test_calculate_all_scores_with_framework_filter(self, mock_hot_contact):
        """Test calculate_all_scores with specific frameworks"""
        result = calculate_all_scores(mock_hot_contact, frameworks=['APEX', 'MDC'])
        
        assert 'APEX' in result['scores']
        assert 'MDC' in result['scores']
        assert 'BANT' not in result['scores']
        assert 'SPICE' not in result['scores']
    
    def test_calculate_all_scores_missing_enrichment(self):
        """Test calculate_all_scores handles missing enrichment data"""
        contact = {'id': 'test-001', 'title': 'VP'}
        result = calculate_all_scores(contact, enrichment_data=None)
        
        assert result['contact_id'] == 'test-001'
        assert len(result['scores']) > 0
        assert result['recommended_tier'] in ['Hot', 'Warm', 'Cold']
    
    def test_get_default_config(self):
        """Test get_default_config returns correct configurations"""
        apex_config = get_default_config('APEX')
        assert apex_config['affinity_weight'] == 25
        
        mdc_config = get_default_config('MDC')
        assert mdc_config['money_weight'] == 33
        
        bant_config = get_default_config('BANT')
        assert bant_config['budget_weight'] == 25
        
        spice_config = get_default_config('SPICE')
        assert spice_config['situation_weight'] == 20
        
        invalid_config = get_default_config('INVALID')
        assert invalid_config == {}
    
    def test_tier_consistency_across_frameworks(self, mock_hot_contact):
        """Test that Hot contact scores Hot in all frameworks"""
        result = calculate_all_scores(mock_hot_contact)
        
        # Most scores should be Hot for this contact
        hot_count = sum(1 for score in result['scores'].values() if score['tier'] == 'Hot')
        assert hot_count >= 2  # At least 2 frameworks should rate as Hot
    
    def test_score_breakdown_completeness(self, mock_hot_contact):
        """Test that all score breakdowns are complete"""
        result = calculate_all_scores(mock_hot_contact)
        
        # APEX should have 4 components
        assert len(result['scores']['APEX']['breakdown']) == 4
        
        # MDC should have 3 components
        assert len(result['scores']['MDC']['breakdown']) == 3
        
        # BANT should have 4 components
        assert len(result['scores']['BANT']['breakdown']) == 4
        
        # SPICE should have 5 components
        assert len(result['scores']['SPICE']['breakdown']) == 5


# ============================================================================
# EDGE CASE TESTS
# ============================================================================

class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_empty_contact_dict(self):
        """Test scoring with empty contact dict"""
        empty_contact = {}
        result = calculate_all_scores(empty_contact)
        
        assert result['contact_id'] is None
        assert result['average_score'] >= 0
        assert result['recommended_tier'] in ['Hot', 'Warm', 'Cold']
    
    def test_null_enrichment_values(self):
        """Test scoring with null/None values in enrichment"""
        contact = {
            'id': 'test-null',
            'title': None,
            'company_revenue': None,
            'enrichment_data': {
                'vertical': None,
                'summary': None,
                'talking_points': None
            }
        }
        result = calculate_all_scores(contact)
        
        assert 0 <= result['average_score'] <= 100
    
    def test_malformed_date_in_enriched_at(self):
        """Test scoring with malformed date format"""
        contact = {
            'id': 'test-bad-date',
            'title': 'VP',
            'enriched_at': 'invalid-date-format'
        }
        
        # Should not crash
        mdc = MDCCalculator()
        result = mdc.calculate(contact)
        assert result['score'] >= 0
    
    def test_extremely_large_revenue(self):
        """Test scoring with unrealistically large revenue"""
        contact = {
            'id': 'test-huge',
            'title': 'CEO',
            'company_revenue': 999_999_999_999_999,
            'enrichment_data': {
                'annual_revenue': 999_999_999_999_999
            }
        }
        
        mdc = MDCCalculator()
        result = mdc.calculate(contact)
        assert result['score'] >= 0
    
    def test_extremely_small_revenue(self):
        """Test scoring with very small revenue"""
        contact = {
            'company_revenue': 0.01,
            'enrichment_data': {'annual_revenue': 0.01}
        }
        
        mdc = MDCCalculator()
        result = mdc.calculate(contact)
        assert result['score'] >= 0
    
    def test_special_characters_in_text(self):
        """Test scoring with special characters in enrichment text"""
        contact = {
            'title': 'VP@Sales/Marketing',
            'enrichment_data': {
                'summary': 'Needs #growth & $$$-optimization!!!',
                'talking_points': 'Key-performance-indicator™'
            }
        }
        
        result = calculate_all_scores(contact)
        assert 0 <= result['average_score'] <= 100
    
    def test_unicode_characters_in_text(self):
        """Test scoring with unicode characters"""
        contact = {
            'company': 'TechCorp™',
            'enrichment_data': {
                'summary': '我们需要增长 growth nécessaire Wachstum',
                'talking_points': 'Challenges: efficiency → automation'
            }
        }
        
        result = calculate_all_scores(contact)
        assert 0 <= result['average_score'] <= 100
    
    def test_case_insensitivity(self):
        """Test that keyword matching is case-insensitive"""
        contact_lower = {
            'title': 'vp of sales',
            'enrichment_data': {'summary': 'need to scale growth'}
        }
        
        contact_upper = {
            'title': 'VP OF SALES',
            'enrichment_data': {'summary': 'NEED TO SCALE GROWTH'}
        }
        
        contact_mixed = {
            'title': 'Vp Of Sales',
            'enrichment_data': {'summary': 'Need To Scale Growth'}
        }
        
        result_lower = calculate_all_scores(contact_lower)
        result_upper = calculate_all_scores(contact_upper)
        result_mixed = calculate_all_scores(contact_mixed)
        
        # All three should produce similar scores
        assert abs(result_lower['average_score'] - result_upper['average_score']) < 5
        assert abs(result_upper['average_score'] - result_mixed['average_score']) < 5


# ============================================================================
# PERFORMANCE TESTS
# ============================================================================

class TestPerformance:
    """Test performance characteristics of scoring"""
    
    def test_single_contact_scoring_speed(self, mock_hot_contact, benchmark):
        """Test single contact scoring is fast (<100ms)"""
        def score_single():
            calculate_all_scores(mock_hot_contact)
        
        # This will run multiple times and measure
        # With pytest-benchmark, it should complete in <100ms
        result = benchmark(score_single)
        assert result is None  # benchmark handles the timing
    
    def test_batch_contact_scoring_speed(self, mock_hot_contact):
        """Test batch scoring of 100 contacts"""
        contacts = [
            {**mock_hot_contact, 'id': f'contact-{i}'}
            for i in range(100)
        ]
        
        import time
        start = time.time()
        
        for contact in contacts:
            calculate_all_scores(contact)
        
        elapsed = time.time() - start
        
        # Should complete in <5 seconds
        assert elapsed < 5.0
        print(f"Scored 100 contacts in {elapsed:.2f}s ({elapsed/100*1000:.1f}ms per contact)")


# ============================================================================
# RUN TESTS
# ============================================================================

if __name__ == '__main__':
    """
    Run tests with:
    
    # All tests
    pytest tests/test_scoring.py -v
    
    # With coverage
    pytest tests/test_scoring.py --cov=scoring --cov-report=html
    
    # Specific test class
    pytest tests/test_scoring.py::TestAPEXCalculator -v
    
    # With benchmark
    pytest tests/test_scoring.py --benchmark-only
    
    # Verbose output
    pytest tests/test_scoring.py -vv -s
    """
    pytest.main([__file__, '-v', '--tb=short'])
