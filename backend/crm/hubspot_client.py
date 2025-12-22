#!/usr/bin/env python3


# ============================================================================
# FILE: backend/crm/hubspot_client.py
# ============================================================================
"""HubSpot API client for contact sync"""

import requests
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime


class HubSpotClient:
	"""HubSpot API client for contact import/sync"""
	
	BASE_URL = "https://api.hubapi.com"
	
	def __init__(self, api_key: str):
		self.api_key = api_key
		self.session = requests.Session()
		self.session.headers.update({
			"Authorization": f"Bearer {api_key}",
			"Content-Type": "application/json"
		})
		
	def get_contacts(self, limit: int = 100, after: Optional[str] = None) -> Dict[str, Any]:
		"""Fetch contacts from HubSpot with pagination"""
		params = {
			"limit": limit,
			"properties": [
				"firstname",
				"lastname",
				"email",
				"phone",
				"company",
				"jobtitle",
				"hs_lead_status",
				"lifecyclestage"
			]
		}
		if after:
			params["after"] = after
			
		response = self.session.get(
			f"{self.BASE_URL}/crm/v3/objects/contacts",
			params=params
		)
		response.raise_for_status()
		return response.json()
	
	def get_all_contacts(self) -> List[Dict[str, Any]]:
		"""Fetch all HubSpot contacts with automatic pagination"""
		all_contacts = []
		after = None
		
		while True:
			data = self.get_contacts(limit=100, after=after)
			all_contacts.extend(data.get("results", []))
			
			paging = data.get("paging", {})
			after = paging.get("next", {}).get("after")
			if not after:
				break
			
		return all_contacts
	
	def map_to_latticeiq(self, hs_contact: Dict[str, Any]) -> Dict[str, Any]:
		"""Map HubSpot contact to LatticeIQ schema"""
		props = hs_contact.get("properties", {})
		
		return {
			"first_name": props.get("firstname", {}).get("value", "Unknown"),
			"last_name": props.get("lastname", {}).get("value", ""),
			"email": props.get("email", {}).get("value", ""),
			"phone": props.get("phone", {}).get("value"),
			"company": props.get("company", {}).get("value"),
			"title": props.get("jobtitle", {}).get("value"),
			"lifecycle_stage": props.get("lifecyclestage", {}).get("value"),
			"external_id": hs_contact.get("id"),
			"crm_type": "hubspot",
		}
	
	def test_connection(self) -> bool:
		"""Test API connection"""
		try:
			response = self.session.get(f"{self.BASE_URL}/crm/v3/objects/contacts?limit=1")
			response.raise_for_status()
			return True
		except Exception as e:
			print(f"HubSpot connection error: {e}")
			return False
		