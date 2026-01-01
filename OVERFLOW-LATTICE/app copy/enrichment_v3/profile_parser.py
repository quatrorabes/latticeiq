#!/usr/bin/env python3

import json
import re
from typing import Dict, Optional, Any
from datetime import datetime

class ProfileParser:
	"""Extracts structured contact profile from enrichment_data."""
	
	def __init__(self, enrichment_data: Dict[str, Any]):
		self.data = enrichment_data or {}
		self.raw_results = self.data.get('raw_results', {})
		self.synthesized = self.data.get('synthesized', {})
		
	def extract_summary(self) -> Optional[str]:
		"""Extract profile summary from synthesis."""
		if self.synthesized:
			return self.synthesized.get('profile_summary') or \
					self.synthesized.get('summary')
		return self._extract_from_raw('summary', 'profile summary')
	
	def extract_opening_line(self) -> Optional[str]:
		"""Extract opening line for cold outreach."""
		if self.synthesized:
			return self.synthesized.get('opening_line')
		return self._extract_from_raw('opening', 'opening line')
	
	def extract_hook(self) -> Optional[str]:
		"""Extract best hook angle."""
		if self.synthesized:
			return self.synthesized.get('hook_angle')
		return self._extract_from_raw('hook', 'hook angle')
	
	def extract_why_now(self) -> Optional[str]:
		"""Extract 'why now' context."""
		if self.synthesized:
			return self.synthesized.get('why_buy_now')
		return self._extract_from_raw('why', 'buy now')
	
	def extract_talking_points(self) -> list[str]:
		"""Extract key talking points."""
		if self.synthesized and self.synthesized.get('talking_points'):
			tp = self.synthesized['talking_points']
			if isinstance(tp, list):
				return tp
			return [tp]
		
		points = []
		for domain, result in self.raw_results.items():
			if result.get('content'):
				# Parse bullet points from content
				lines = result['content'].split('\n')
				for line in lines:
					if line.strip().startswith('-') or line.strip().startswith('•'):
						points.append(line.strip('- •').strip())
		return points[:5]  # Top 5
	
	def extract_company_info(self) -> Dict[str, str]:
		"""Extract company details."""
		info = {}
		
		if self.synthesized:
			info['name'] = self.synthesized.get('company_name')
			info['description'] = self.synthesized.get('company_description')
			info['industry'] = self.synthesized.get('industry')
			info['size'] = self.synthesized.get('company_size')
			info['founded'] = self.synthesized.get('founded_year')
			info['website'] = self.synthesized.get('website')
			
		# Extract from COMPANY domain results
		company_result = self.raw_results.get('COMPANY', {})
		if company_result.get('content') and not info.get('name'):
			# Parse company details from content
			content = company_result['content']
			if 'industry' in content.lower():
				info['industry'] = self._extract_field(content, 'industry')
				
		return {k: v for k, v in info.items() if v}
	
	def extract_person_info(self) -> Dict[str, str]:
		"""Extract person-specific details."""
		info = {}
		
		if self.synthesized:
			info['background'] = self.synthesized.get('background')
			info['experience'] = self.synthesized.get('experience_summary')
			info['expertise'] = self.synthesized.get('key_expertise')
			info['linkedin'] = self.synthesized.get('linkedin_url')
			info['recent_activity'] = self.synthesized.get('recent_news')
			
		return {k: v for k, v in info.items() if v}
	
	def extract_pain_points(self) -> list[str]:
		"""Extract potential pain points."""
		if self.synthesized and self.synthesized.get('pain_points'):
			pp = self.synthesized['pain_points']
			return pp if isinstance(pp, list) else [pp]
		
		# Extract from raw results
		points = []
		for domain, result in self.raw_results.items():
			if 'problem' in (result.get('content') or '').lower():
				points.append(result.get('content', ''))
		return points
	
	def extract_objection_handlers(self) -> Dict[str, str]:
		"""Map common objections to handling approaches."""
		if self.synthesized and self.synthesized.get('objection_handlers'):
			return self.synthesized['objection_handlers']
		
		return {
			'Budget': 'Focus on ROI and cost savings',
			'Authority': 'Loop in decision maker',
			'Need': 'Build consensus on problem severity',
			'Timing': 'Establish urgency with market changes',
		}
	
	def extract_bant_scores(self) -> Dict[str, Optional[int]]:
		"""Extract BANT framework scores."""
		return {
			'budget': self.synthesized.get('bant_budget'),
			'authority': self.synthesized.get('bant_authority'),
			'need': self.synthesized.get('bant_need'),
			'timing': self.synthesized.get('bant_timing'),
		}
	
	def to_profile(self) -> Dict[str, Any]:
		"""Convert to complete contact profile."""
		return {
			'summary': self.extract_summary(),
			'opening_line': self.extract_opening_line(),
			'hook_angle': self.extract_hook(),
			'why_buy_now': self.extract_why_now(),
			'talking_points': self.extract_talking_points(),
			'company': self.extract_company_info(),
			'person': self.extract_person_info(),
			'pain_points': self.extract_pain_points(),
			'objection_handlers': self.extract_objection_handlers(),
			'bant': self.extract_bant_scores(),
			'parsed_at': datetime.now().isoformat(),
		}
	
	def _extract_from_raw(self, *keywords) -> Optional[str]:
		"""Search raw results for matching keywords."""
		for domain, result in self.raw_results.items():
			content = (result.get('content') or '').lower()
			for kw in keywords:
				if kw.lower() in content:
					return result.get('content')[:500]  # First 500 chars
		return None
	
	def _extract_field(self, text: str, field: str) -> Optional[str]:
		"""Extract field value from text."""
		pattern = rf'{field}[:\s]+([^\n]+)'
		match = re.search(pattern, text, re.IGNORECASE)
		return match.group(1).strip() if match else None
	