 #!/usr/bin/env python3
"""
CRE LENDING RELATIONSHIP INTELLIGENCE OS
The Kernel: WHO to call, WHEN to call, WHAT to say
Beta Launch: November 2025
"""

import json
import yaml
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import openai
import os

class CRELendingKernel:
    """
    The Intelligence Layer for CRE/SBA Lending
    Your 10+ years of expertise codified into AI
    """
    
    def __init__(self):
        self.openai_key = os.getenv('OPENAI_API_KEY')
        openai.api_key = self.openai_key
        
        # CRE LENDING DOMAIN KNOWLEDGE
        self.loan_products = {
            'sba_504': {
                'sweet_spot': 'Owner-occupied real estate',
                'ltv': '90%',
                'rate': 'From 11.5%',
                'term': '10-25 years',
                'min_owner_occupy': '51%'
            },
            'sba_7a': {
                'sweet_spot': 'Working capital, equipment',
                'ltv': '85%',
                'rate': 'Prime + 2.75%',
                'term': 'Up to 25 years',
                'use': 'Flexible use'
            },
            'conventional': {
                'sweet_spot': 'Investment properties',
                'ltv': '75%',
                'rate': 'Market rates',
                'term': '5-20 years',
                'min_down': '25%'
            }
        }
        
        # WHO: CRE Lending Personas (your expertise)
        self.target_personas = {
            'owner_operator': {
                'titles': ['Owner', 'CEO', 'President', 'Founder'],
                'triggers': ['expansion', 'refinance', 'purchase property'],
                'pain_points': ['high rates', 'need more space', 'lease expiring'],
                'qualifying_questions': [
                    "Do you own or lease your current space?",
                    "What percentage of the building does your business occupy?",
                    "Have you looked at SBA programs before?"
                ]
            },
            'franchisee': {
                'titles': ['Franchisee', 'Multi-unit Owner', 'Area Developer'],
                'triggers': ['new location', 'multi-unit expansion', 'remodel'],
                'pain_points': ['franchisor requirements', 'expansion capital', 'equipment needs'],
                'qualifying_questions': [
                    "How many units do you currently operate?",
                    "Are you looking at new locations or remodeling existing?",
                    "What's your franchise agreement timeline?"
                ]
            },
            'real_estate_developer': {
                'titles': ['Developer', 'Managing Partner', 'Principal'],
                'triggers': ['ground-up construction', 'value-add', 'refinance'],
                'pain_points': ['construction costs', 'interest reserves', 'takeout financing'],
                'qualifying_questions': [
                    "Is this ground-up or renovation?",
                    "What's your planned hold period?",
                    "Do you have other projects in the pipeline?"
                ]
            }
        }
        
        # WHEN: CRE Market Timing Signals
        self.timing_signals = {
            'URGENT': {
                'keywords': ['lease expiring', 'rate lock expiring', 'closing soon', 'under contract'],
                'action': 'call_immediately',
                'message': 'Time-sensitive opportunity'
            },
            'ACTIVE': {
                'keywords': ['looking at properties', 'evaluating options', 'getting quotes'],
                'action': 'call_today',
                'message': 'Active buyer in market'
            },
            'WARMING': {
                'keywords': ['thinking about', 'considering', 'planning expansion'],
                'action': 'nurture_sequence',
                'message': 'Build relationship'
            }
        }
        
    def generate_kernel(self, contact: Dict) -> Dict:
        """
        Generate the complete intelligence kernel for a contact
        This is the SECRET SAUCE - the exact intelligence to close deals
        """
        
        # Detect persona
        persona = self._detect_persona(contact)
        
        # Detect timing
        timing = self._detect_timing(contact)
        
        # Generate approach
        approach = self._generate_approach(contact, persona, timing)
        
        return {
            'contact': contact.get('name'),
            'company': contact.get('company'),
            
            # WHO
            'who': {
                'persona_type': persona['type'],
                'decision_role': persona['role'],
                'influence_level': persona['influence'],
                'personality_insights': self._get_personality_insights(contact)
            },
            
            # WHEN  
            'when': {
                'timing_signal': timing['signal'],
                'urgency_level': timing['urgency'],
                'optimal_contact_time': timing['best_time'],
                'follow_up_cadence': timing['cadence']
            },
            
            # WHAT
            'what': {
                'opening_hook': approach['hook'],
                'value_props': approach['value_props'],
                'loan_products': approach['products'],
                'discovery_questions': approach['questions'],
                'objection_handlers': approach['objections'],
                'call_to_action': approach['cta']
            },
            
            # HOW
            'how': {
                'email_template': self._generate_email(contact, approach),
                'linkedin_message': self._generate_linkedin(contact, approach),
                'phone_script': self._generate_phone_script(contact, approach),
                'voicemail_script': self._generate_voicemail(contact, approach)
            },
            
            'generated_at': datetime.now().isoformat(),
            'confidence_score': self._calculate_confidence(contact, persona, timing)
        }
    
    def _detect_persona(self, contact: Dict) -> Dict:
        """Detect which CRE persona this contact is"""
        title = contact.get('title', '').lower()
        company = contact.get('company', '').lower()
        
        if any(kw in title for kw in ['owner', 'ceo', 'president', 'founder']):
            if 'franchise' in company or 'franchisee' in title:
                return {
                    'type': 'franchisee',
                    'role': 'decision_maker',
                    'influence': 'high'
                }
            else:
                return {
                    'type': 'owner_operator',
                    'role': 'decision_maker', 
                    'influence': 'high'
                }
        elif any(kw in title for kw in ['developer', 'principal', 'partner']):
            return {
                'type': 'real_estate_developer',
                'role': 'decision_maker',
                'influence': 'high'
            }
        else:
            return {
                'type': 'unknown',
                'role': 'influencer',
                'influence': 'medium'
            }
    
    def _detect_timing(self, contact: Dict) -> Dict:
        """Detect buying timing signals"""
        recent_activity = ' '.join(contact.get('recent_activity', [])).lower()
        
        # Check for urgent signals
        for keyword in self.timing_signals['URGENT']['keywords']:
            if keyword in recent_activity:
                return {
                    'signal': 'URGENT',
                    'urgency': 'high',
                    'best_time': 'immediately',
                    'cadence': 'daily_until_contact'
                }
        
        # Check for active signals
        for keyword in self.timing_signals['ACTIVE']['keywords']:
            if keyword in recent_activity:
                return {
                    'signal': 'ACTIVE',
                    'urgency': 'medium',
                    'best_time': 'within_24_hours',
                    'cadence': 'every_2_days'
                }
        
        # Default to warming
        return {
            'signal': 'WARMING',
            'urgency': 'low',
            'best_time': 'this_week',
            'cadence': 'weekly'
        }
    
    def _generate_approach(self, contact: Dict, persona: Dict, timing: Dict) -> Dict:
        """Generate the specific approach for this contact"""
        
        # This is YOUR EXPERTISE coded into the system
        if persona['type'] == 'owner_operator':
            return {
                'hook': f"Saw you're expanding - SBA 504 could save you $50K+",
                'value_props': [
                    "90% financing with just 10% down",
                    "Lock in rates as low as 11.5%",
                    "Build equity instead of paying rent"
                ],
                'products': ['sba_504', 'sba_7a'],
                'questions': [
                    "Are you currently leasing or do you own your space?",
                    "What percentage of the building would your business occupy?",
                    "Have you gotten any other financing quotes yet?"
                ],
                'objections': {
                    'rates_too_high': "Actually, SBA rates are fixed and historically low right now",
                    'too_complicated': "We handle all the SBA paperwork - takes 30-45 days",
                    'not_ready': "Let's at least run the numbers so you know your options"
                },
                'cta': "Can we do a quick 15-minute call to see if you qualify?"
            }
        
        elif persona['type'] == 'franchisee':
            return {
                'hook': f"Helped 3 other {contact.get('company', 'franchise')} owners expand last month",
                'value_props': [
                    "Multi-unit financing packages available",
                    "Franchisor-approved lender",
                    "Equipment and buildout included"
                ],
                'products': ['sba_7a', 'sba_504'],
                'questions': [
                    "How many units are you looking to add?",
                    "Is this a new market or expanding in current territory?",
                    "What's your franchise agreement require for timeline?"
                ],
                'objections': {
                    'franchisor_has_lender': "We often beat franchisor rates by 1-2%",
                    'too_much_debt': "SBA structure preserves your cash flow",
                    'waiting_on_approval': "We can get pre-approval in 48 hours"
                },
                'cta': "Let's run a quick pre-qualification - takes 10 minutes"
            }
        
        else:
            # Generic but still intelligent
            return {
                'hook': "Noticed you're in growth mode - let's talk financing options",
                'value_props': [
                    "Multiple financing options available",
                    "Competitive rates and terms",
                    "Fast, efficient process"
                ],
                'products': ['conventional', 'sba_7a'],
                'questions': [
                    "What type of financing are you looking for?",
                    "What's your timeline?",
                    "Have you worked with SBA loans before?"
                ],
                'objections': {
                    'just_looking': "No pressure - let's just see what you qualify for",
                    'have_a_bank': "Always good to have a backup option",
                    'not_now': "When would be a better time to circle back?"
                },
                'cta': "Worth a quick conversation to explore options?"
            }
    
    def _generate_email(self, contact: Dict, approach: Dict) -> str:
        """Generate the perfect email"""
        return f"""Subject: {approach['hook']}

Hi {contact.get('first_name', 'there')},

{approach['hook']}

Quick benefits of working with us:
• {approach['value_props'][0]}
• {approach['value_props'][1]}
• {approach['value_props'][2]}

{approach['cta']}

Best,
[Your name]
"""
    
    def _generate_phone_script(self, contact: Dict, approach: Dict) -> str:
        """Generate phone script"""
        return f"""
OPENING:
"Hi {contact.get('first_name')}, this is [Your name] from [Company]. 
{approach['hook']}. Do you have 30 seconds?"

IF YES:
"Great! {approach['questions'][0]}"

VALUE PROP:
"{approach['value_props'][0]}"

CLOSE:
"{approach['cta']}"

OBJECTION HANDLERS:
{json.dumps(approach['objections'], indent=2)}
"""
    
    def _get_personality_insights(self, contact: Dict) -> Dict:
        """Get personality insights for communication style"""
        # This would use the personality profiling from kernel_generator_v2
        return {
            'communication_style': 'direct_and_data_driven',
            'decision_style': 'analytical',
            'preferred_medium': 'email_first_then_call'
        }
    
    def _calculate_confidence(self, contact: Dict, persona: Dict, timing: Dict) -> int:
        """Calculate confidence score for this opportunity"""
        score = 50  # Base score
        
        # Persona match
        if persona['type'] in ['owner_operator', 'franchisee']:
            score += 20
        
        # Timing signals
        if timing['signal'] == 'URGENT':
            score += 30
        elif timing['signal'] == 'ACTIVE':
            score += 20
        
        # Has phone number
        if contact.get('phone'):
            score += 10
        
        return min(score, 100)

# Test the kernel
if __name__ == "__main__":
    kernel = CRELendingKernel()
    
    # Test contact
    test_contact = {
        'name': 'John Smith',
        'first_name': 'John',
        'company': 'ABC Restaurant Group',
        'title': 'Owner',
        'phone': '555-0100',
        'recent_activity': ['Posted about opening new location', 'Looking at properties']
    }
    
    result = kernel.generate_kernel(test_contact)
    print(json.dumps(result, indent=2))
