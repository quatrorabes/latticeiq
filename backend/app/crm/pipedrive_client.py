#!/usr/bin/env python3
# ============================================================================
# FILE: backend/crm/pipedrive_client.py
# ============================================================================
"""Pipedrive API client for contact sync"""

import requests
from typing import List, Dict, Any, Optional


class PipedriveClient:
    """Pipedrive API client for person import/sync"""
    
    BASE_URL = "https://api.pipedrive.com/v1"
    
    def __init__(self, api_token: str):
        self.api_token = api_token
        self.session = requests.Session()
    
    def get_persons(self, limit: int = 500, start: int = 0) -> Dict[str, Any]:
        """Fetch persons (contacts) from Pipedrive with pagination"""
        params = {
            "api_token": self.api_token,
            "limit": limit,
            "start": start
        }
        
        response = self.session.get(f"{self.BASE_URL}/persons", params=params)
        response.raise_for_status()
        return response.json()
    
    def get_all_persons(self) -> List[Dict[str, Any]]:
        """Fetch all Pipedrive persons with automatic pagination"""
        all_persons = []
        start = 0
        
        while True:
            data = self.get_persons(limit=500, start=start)
            
            if not data.get("success"):
                break
            
            all_persons.extend(data.get("data") or [])
            
            pagination = data.get("additional_data", {}).get("pagination", {})
            if not pagination.get("more_items_in_collection"):
                break
            
            start = pagination.get("next_start", 0)
        
        return all_persons
    
    def map_to_latticeiq(self, pd_person: Dict[str, Any]) -> Dict[str, Any]:
        """Map Pipedrive person to LatticeIQ schema"""
        # Pipedrive stores emails/phones as arrays
        emails = pd_person.get("email") or []
        primary_email = emails[0].get("value") if emails and isinstance(emails, list) else ""
        
        phones = pd_person.get("phone") or []
        primary_phone = phones[0].get("value") if phones and isinstance(phones, list) else None
        
        # Get company from org_id (linked organization)
        org = pd_person.get("org_id")
        company = org.get("name") if isinstance(org, dict) else None
        
        return {
            "first_name": pd_person.get("first_name") or "Unknown",
            "last_name": pd_person.get("last_name") or "",
            "email": primary_email,
            "phone": primary_phone,
            "company": company,
            "job_title": None,  # FIXED: Pipedrive doesn't have job_title in standard fields
            "external_id": str(pd_person.get("id")),
            "crm_type": "pipedrive",
        }
    
    def test_connection(self) -> bool:
        """Test API connection"""
        try:
            params = {"api_token": self.api_token, "limit": 1}
            response = self.session.get(f"{self.BASE_URL}/persons", params=params)
            response.raise_for_status()
            return response.json().get("success", False)
        except Exception as e:
            print(f"Pipedrive connection error: {e}")
            return False
