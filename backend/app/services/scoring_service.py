#!/usr/bin/env python3

# File: apps/backend/services/scoring_service.py

import json
from typing import Dict, Any
import uuid

class ScoringService:
	def __init__(self, db_connection):
		self.db = db_connection
		
	def load_profile_config(self, workspace_id: uuid.UUID, profile_id: uuid.UUID) -> Dict[str, Any]:
		"""Load complete profile configuration for use in scoring."""
		
		profile = self.db.execute("""
			SELECT * FROM profiles WHERE id = %s AND workspace_id = %s
		""", (profile_id, workspace_id)).fetchone()
		
		if not profile:
			raise ValueError(f"Profile {profile_id} not found in workspace {workspace_id}")
			
		# Load all sections
		config = {
			'profile_id': str(profile['id']),
			'workspace_id': str(profile['workspace_id']),
			'vertical': profile['vertical'],
			'status': profile['status']
		}
		
		# Load ICP Firmographic
		icp_firm = self.db.execute("""
			SELECT * FROM icp_firmographic WHERE profile_id = %s
		""", (profile_id,)).fetchone()
		
		if icp_firm:
			config['icp_firmographic'] = {
				'target_industries': json.loads(icp_firm['target_industries']) if icp_firm['target_industries'] else [],
				'excluded_industries': json.loads(icp_firm['excluded_industries']) if icp_firm['excluded_industries'] else [],
				'company_size_min': icp_firm['company_size_min'],
				'company_size_max': icp_firm['company_size_max'],
				'annual_revenue_min': icp_firm['annual_revenue_min'],
				'annual_revenue_max': icp_firm['annual_revenue_max'],
				'geographic_markets': json.loads(icp_firm['geographic_markets']) if icp_firm['geographic_markets'] else [],
				'business_model': icp_firm['business_model'],
				'growth_stage': icp_firm['growth_stage']
			}
			
		# Load ICP Demographic
		icp_demo = self.db.execute("""
			SELECT * FROM icp_demographic WHERE profile_id = %s
		""", (profile_id,)).fetchone()
		
		if icp_demo:
			config['icp_demographic'] = {
				'target_job_titles': json.loads(icp_demo['target_job_titles']) if icp_demo['target_job_titles'] else [],
				'target_departments': json.loads(icp_demo['target_departments']) if icp_demo['target_departments'] else [],
				'seniority_level': icp_demo['seniority_level'],
				'decision_authority': icp_demo['decision_authority'],
				'budget_control': icp_demo['budget_control']
			}
			
		# Load ICP Behavioral
		icp_behav = self.db.execute("""
			SELECT * FROM icp_behavioral WHERE profile_id = %s
		""", (profile_id,)).fetchone()
		
		if icp_behav:
			config['icp_behavioral'] = {
				'purchase_intent_signals': json.loads(icp_behav['purchase_intent_signals']) if icp_behav['purchase_intent_signals'] else [],
				'website_engagement_preference': json.loads(icp_behav['website_engagement_preference']) if icp_behav['website_engagement_preference'] else [],
				'engagement_velocity': icp_behav['engagement_velocity'],
				'last_activity_window_days': icp_behav['last_activity_window_days']
			}
			
		# Load Scoring Configuration
		scoring_config = self.db.execute("""
			SELECT * FROM scoring_configuration WHERE profile_id = %s
		""", (profile_id,)).fetchone()
		
		if scoring_config:
			config['scoring_config'] = {
				'hot_threshold_min': scoring_config['hot_threshold_min'],
				'hot_threshold_max': scoring_config['hot_threshold_max'],
				'warm_threshold_min': scoring_config['warm_threshold_min'],
				'warm_threshold_max': scoring_config['warm_threshold_max'],
				'cold_threshold_min': scoring_config['cold_threshold_min'],
				'cold_threshold_max': scoring_config['cold_threshold_max']
			}
			
		# Load Scoring Rules
		rules = self.db.execute("""
			SELECT sr.* FROM scoring_rules sr
			JOIN scoring_configuration sc ON sr.scoring_config_id = sc.id
			WHERE sc.profile_id = %s AND sr.is_active = TRUE
		""", (profile_id,)).fetchall()
		
		config['scoring_rules'] = [
			{
				'rule_type': rule['rule_type'],
				'criterion_name': rule['criterion_name'],
				'criterion_value': rule['criterion_value'],
				'points_value': rule['points_value'],
				'is_negative': rule['is_negative']
			}
			for rule in rules
		]
		
		return config
	
	def calculate_mdcp_score_with_profile(self, contact: Dict, profile_config: Dict) -> Dict:
		"""Calculate MDCP score using profile configuration."""
		
		# Extract components
		icp_firm = profile_config.get('icp_firmographic', {})
		icp_demo = profile_config.get('icp_demographic', {})
		scoring_rules = profile_config.get('scoring_rules', [])
		
		# FIRMOGRAPHIC SCORING (Match component)
		firmographic_score = 0
		max_firmographic = 25
		
		# Check if contact industry matches ICP
		contact_industry = contact.get('industry', '').lower()
		target_industries = icp_firm.get('target_industries', [])
		
		if contact_industry in [ind.lower() for ind in target_industries]:
			firmographic_score += 10
			
		# Check company size match
		contact_company_size = contact.get('company_employee_count', 0)
		size_min, size_max = icp_firm.get('company_size_min', 0), icp_firm.get('company_size_max', 10000)
		
		if size_min <= contact_company_size <= size_max:
			firmographic_score += 8
			
		# Apply custom rules (Firmographic type)
		for rule in scoring_rules:
			if rule['rule_type'] == 'Firmographic':
				if self._rule_matches_contact(rule, contact):
					points = rule['points_value']
					if rule['is_negative']:
						firmographic_score -= points
					else:
						firmographic_score += points
						
		firmographic_score = min(firmographic_score, max_firmographic)
		
		# ROLE/DEMOGRAPHIC SCORING (Contact component)
		demographic_score = 0
		max_demographic = 25
		
		contact_title = contact.get('title', '').lower()
		target_titles = [t.lower() for t in icp_demo.get('target_job_titles', [])]
		
		# Fuzzy match on title
		for target_title in target_titles:
			if target_title in contact_title or contact_title in target_title:
				demographic_score += 12
				break
			
		# Check decision authority (if contact has budget control, award points)
		if contact.get('decision_authority') == icp_demo.get('decision_authority'):
			demographic_score += 8
			
		demographic_score = min(demographic_score, max_demographic)
		
		# BEHAVIORAL SCORING (Engagement component)
		behavioral_score = 0
		max_behavioral = 25
		
		# Check purchase intent signals
		last_activity_days = self._days_since_activity(contact.get('last_activity_date'))
		engagement_window = icp_demo.get('last_activity_window_days', 45)
		
		if last_activity_days <= engagement_window:
			behavioral_score += 15  # Recent activity
			
		behavioral_score = min(behavioral_score, max_behavioral)
		
		# PROFILE COMPLETENESS SCORING (Data component)
		profile_score = 0
		max_profile = 25
		
		required_fields = ['email', 'phone', 'linkedin_url', 'title', 'company']
		fields_complete = sum([1 for field in required_fields if contact.get(field)])
		profile_score = int((fields_complete / len(required_fields)) * 25)
		
		# TOTAL MDCP SCORE
		total_score = firmographic_score + demographic_score + behavioral_score + profile_score
		
		# DETERMINE LEAD TIER
		scoring_config = profile_config.get('scoring_config', {})
		tier = self._get_lead_tier(total_score, scoring_config)
		
		return {
			'mdcp_score': int(total_score),
			'firmographic_score': firmographic_score,
			'demographic_score': demographic_score,
			'behavioral_score': behavioral_score,
			'profile_score': profile_score,
			'lead_tier': tier
		}
	
	def _rule_matches_contact(self, rule: Dict, contact: Dict) -> bool:
		"""Check if a scoring rule matches the contact's data."""
		criterion_name = rule['criterion_name']
		criterion_value = rule['criterion_value']
		contact_value = contact.get(criterion_name.lower().replace(' ', '_'), '')
		
		# Simple substring matching (can be extended to regex)
		return str(criterion_value).lower() in str(contact_value).lower()
	
	def _days_since_activity(self, last_activity_date) -> int:
		"""Calculate days since last activity."""
		if not last_activity_date:
			return 999  # Very old
		from datetime import datetime
		now = datetime.utcnow()
		delta = now - last_activity_date
		return delta.days
	
	def _get_lead_tier(self, score: int, scoring_config: Dict) -> str:
		"""Determine lead tier based on score and configuration thresholds."""
		hot_min = scoring_config.get('hot_threshold_min', 71)
		warm_min = scoring_config.get('warm_threshold_min', 40)
		
		if score >= hot_min:
			return 'Hot'
		elif score >= warm_min:
			return 'Warm'
		else:
			return 'Cold'
		