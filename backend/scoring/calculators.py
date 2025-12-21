#!/usr/bin/env python3

"""
LatticeIQ Scoring Calculators
MDCP, BANT, SPICE framework implementations
"""

from typing import Dict, Any, Optional
from datetime import datetime


class MDCPCalculator:
	"""
	MDCP (Money, Decision-maker, Champion, Process) Calculator
	Scores leads on sales opportunity fit
	"""
	
	def __init__(self, config: Dict[str, Any]):
		self.config = config
		
	def calculate(self, contact: Dict[str, Any]) -> Dict[str, Any]:
		"""Calculate MDCP score for a contact"""
		score = 0
		breakdown = {}
		
		# Money (M) - Revenue range match
		money_points = self._score_money(contact)
		if money_points > 0:
			score += money_points
			breakdown['money'] = money_points
			
		# Decision-maker (D) - Job title match
		dm_points = self._score_decision_maker(contact)
		if dm_points > 0:
			score += dm_points
			breakdown['decision_maker'] = dm_points
			
		# Champion (C) - Recent engagement
		champion_points = self._score_champion(contact)
		if champion_points > 0:
			score += champion_points
			breakdown['champion'] = champion_points
			
		# Process (P) - Always award
		process_weight = self.config.get('weights', {}).get('process_weight', 25)
		score += process_weight
		breakdown['process'] = process_weight
		
		# Determine tier
		tier = self._get_tier(score)
		
		return {
			'score': score,
			'tier': tier,
			'breakdown': breakdown,
			'framework': 'MDCP'
		}
	
	def _score_money(self, contact: Dict[str, Any]) -> int:
		"""Score based on company revenue"""
		config = self.config.get('criteria', {})
		weight = self.config.get('weights', {}).get('money_weight', 25)
		
		revenue = contact.get('annual_revenue')
		if not revenue:
			return 0
		
		try:
			revenue = float(revenue)
			min_rev = float(config.get('money_min_revenue', 0))
			max_rev = float(config.get('money_max_revenue', float('inf')))
			
			if min_rev <= revenue <= max_rev:
				return weight
		except (ValueError, TypeError):
			pass
			
		return 0
	
	def _score_decision_maker(self, contact: Dict[str, Any]) -> int:
		"""Score based on job title"""
		config = self.config.get('criteria', {})
		weight = self.config.get('weights', {}).get('decision_maker_weight', 25)
		
		title = contact.get('title', '').lower()
		if not title:
			return 0
		
		titles = config.get('decision_maker_titles', [])
		for t in titles:
			if t.lower() in title:
				return weight
			
		return 0
	
	def _score_champion(self, contact: Dict[str, Any]) -> int:
		"""Score based on recent engagement"""
		config = self.config.get('criteria', {})
		weight = self.config.get('weights', {}).get('champion_weight', 25)
		
		enriched_at = contact.get('enriched_at')
		if not enriched_at:
			return 0
		
		try:
			enriched = datetime.fromisoformat(enriched_at.replace('Z', '+00:00'))
			now = datetime.utcnow()
			days = (now - enriched).days
			
			max_days = config.get('champion_engagement_days', 30)
			if days <= max_days:
				return weight
		except (ValueError, TypeError, AttributeError):
			pass
			
		return 0
	
	def _get_tier(self, score: int) -> str:
		"""Determine tier from score"""
		thresholds = self.config.get('thresholds', {})
		hot_min = thresholds.get('hot_min', 71)
		warm_min = thresholds.get('warm_min', 40)
		
		if score >= hot_min:
			return 'Hot'
		elif score >= warm_min:
			return 'Warm'
		else:
			return 'Cold'
		
		
class BANTCalculator:
	"""
	BANT (Budget, Authority, Need, Timeline) Calculator
	Scores leads on enterprise sales readiness
	"""
	
	def __init__(self, config: Dict[str, Any]):
		self.config = config
		
	def calculate(self, contact: Dict[str, Any]) -> Dict[str, Any]:
		"""Calculate BANT score for a contact"""
		score = 0
		breakdown = {}
		
		# Authority (A) - Job title match (most important)
		auth_points = self._score_authority(contact)
		if auth_points > 0:
			score += auth_points
			breakdown['authority'] = auth_points
			
		# Need (N) - Keywords in enrichment data
		need_points = self._score_need(contact)
		if need_points > 0:
			score += need_points
			breakdown['need'] = need_points
			
		# Budget (B) - Not scored by default (user configured)
		budget_weight = self.config.get('weights', {}).get('budget_weight', 25)
		score += budget_weight
		breakdown['budget'] = budget_weight
		
		# Timeline (T) - Not scored by default (user configured)
		timeline_weight = self.config.get('weights', {}).get('timeline_weight', 25)
		score += timeline_weight
		breakdown['timeline'] = timeline_weight
		
		# Determine tier
		tier = self._get_tier(score)
		
		return {
			'score': score,
			'tier': tier,
			'breakdown': breakdown,
			'framework': 'BANT'
		}
	
	def _score_authority(self, contact: Dict[str, Any]) -> int:
		"""Score based on decision-making authority"""
		config = self.config.get('criteria', {})
		weight = self.config.get('weights', {}).get('authority_weight', 25)
		
		title = contact.get('title', '').lower()
		if not title:
			return 0
		
		titles = config.get('authority_titles', [])
		for t in titles:
			if t.lower() in title:
				return weight
			
		return 0
	
	def _score_need(self, contact: Dict[str, Any]) -> int:
		"""Score based on business need indicators"""
		config = self.config.get('criteria', {})
		weight = self.config.get('weights', {}).get('need_weight', 25)
		
		enrichment = contact.get('enrichment_data', {})
		enrichment_text = str(enrichment).lower()
		
		keywords = config.get('need_keywords', [])
		for keyword in keywords:
			if keyword.lower() in enrichment_text:
				return weight
			
		return 0
	
	def _get_tier(self, score: int) -> str:
		"""Determine tier from score"""
		thresholds = self.config.get('thresholds', {})
		hot_min = thresholds.get('hot_min', 71)
		warm_min = thresholds.get('warm_min', 40)
		
		if score >= hot_min:
			return 'Hot'
		elif score >= warm_min:
			return 'Warm'
		else:
			return 'Cold'
		
		
class SPICECalculator:
	"""
	SPICE (Situation, Problem, Implication, Consequence, Economic) Calculator
	Scores leads on solution fit and business impact
	"""
	
	def __init__(self, config: Dict[str, Any]):
		self.config = config
		
	def calculate(self, contact: Dict[str, Any]) -> Dict[str, Any]:
		"""Calculate SPICE score for a contact"""
		score = 0
		breakdown = {}
		
		# Situation (S) - Company context
		situation_points = self._score_situation(contact)
		if situation_points > 0:
			score += situation_points
			breakdown['situation'] = situation_points
			
		# Problem (P) - Problem identification
		problem_points = self._score_problem(contact)
		if problem_points > 0:
			score += problem_points
			breakdown['problem'] = problem_points
			
		# Implication (I) - Business impact
		implication_points = self._score_implication(contact)
		if implication_points > 0:
			score += implication_points
			breakdown['implication'] = implication_points
			
		# Consequence (C) - Risk/urgency
		consequence_points = self._score_consequence(contact)
		if consequence_points > 0:
			score += consequence_points
			breakdown['consequence'] = consequence_points
			
		# Economic (E) - Financial impact
		economic_points = self._score_economic(contact)
		if economic_points > 0:
			score += economic_points
			breakdown['economic'] = economic_points
			
		# Determine tier
		tier = self._get_tier(score)
		
		return {
			'score': score,
			'tier': tier,
			'breakdown': breakdown,
			'framework': 'SPICE'
		}
	
	def _score_situation(self, contact: Dict[str, Any]) -> int:
		"""Score based on company situation"""
		weight = self.config.get('weights', {}).get('situation_weight', 20)
		
		if contact.get('company') or contact.get('vertical'):
			return weight
		return 0
	
	def _score_problem(self, contact: Dict[str, Any]) -> int:
		"""Score based on problem indicators"""
		weight = self.config.get('weights', {}).get('problem_weight', 20)
		config = self.config.get('criteria', {})
		
		enrichment = contact.get('enrichment_data', {})
		enrichment_text = str(enrichment).lower()
		
		keywords = config.get('problem_keywords', [])
		for keyword in keywords:
			if keyword.lower() in enrichment_text:
				return weight
		return 0
	
	def _score_implication(self, contact: Dict[str, Any]) -> int:
		"""Score based on business impact"""
		weight = self.config.get('weights', {}).get('implication_weight', 20)
		config = self.config.get('criteria', {})
		
		enrichment = contact.get('enrichment_data', {})
		enrichment_text = str(enrichment).lower()
		
		keywords = config.get('implication_keywords', [])
		for keyword in keywords:
			if keyword.lower() in enrichment_text:
				return weight
		return 0
	
	def _score_consequence(self, contact: Dict[str, Any]) -> int:
		"""Score based on risk/urgency"""
		weight = self.config.get('weights', {}).get('consequence_weight', 20)
		config = self.config.get('criteria', {})
		
		enrichment = contact.get('enrichment_data', {})
		enrichment_text = str(enrichment).lower()
		
		keywords = config.get('consequence_keywords', [])
		for keyword in keywords:
			if keyword.lower() in enrichment_text:
				return weight
		return 0
	
	def _score_economic(self, contact: Dict[str, Any]) -> int:
		"""Score based on financial capacity"""
		weight = self.config.get('weights', {}).get('economic_weight', 20)
		
		if contact.get('annual_revenue'):
			return weight
		return 0
	
	def _get_tier(self, score: int) -> str:
		"""Determine tier from score"""
		thresholds = self.config.get('thresholds', {})
		hot_min = thresholds.get('hot_min', 71)
		warm_min = thresholds.get('warm_min', 40)
		
		if score >= hot_min:
			return 'Hot'
		elif score >= warm_min:
			return 'Warm'
		else:
			return 'Cold'
		