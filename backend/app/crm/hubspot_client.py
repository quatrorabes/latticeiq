#!/usr/bin/env python3
# ============================================================================
# FILE: backend/crm/salesforce_client.py
# ============================================================================
"""Salesforce API client for contact sync"""

import requests
from typing import List, Dict, Any, Optional


class SalesforceClient:
    """Salesforce API client for contact import/sync"""
    
    def __init__(self, instance_url: str, client_id: str, client_secret: str, username: str, password: str):
        """
        Initialize Salesforce client with OAuth credentials
        
        Args:
            instance_url: Salesforce instance URL (e.g., https://myinstance.salesforce.com)
            client_id: OAuth client ID
            client_secret: OAuth client secret
            username: Salesforce username
            password: Salesforce password + security token
        """
        self.instance_url = instance_url.rstrip('/')
        self.client_id = client_id
        self.client_secret = client_secret
        self.username = username
        self.password = password
        self.access_token = None
        self.session = requests.Session()
    
    def authenticate(self) -> bool:
        """Get OAuth access token"""
        try:
            response = requests.post(
                f"{self.instance_url}/services/oauth2/token",
                data={
                    "grant_type": "password",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "username": self.username,
                    "password": self.password
                }
            )
            response.raise_for_status()
            self.access_token = response.json()["access_token"]
            self.session.headers.update({
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            })
            return True
        except Exception as e:
            print(f"Salesforce auth error: {e}")
            return False
    
    def get_contacts(self, soql: Optional[str] = None) -> List[Dict[str, Any]]:
        """Execute SOQL query to fetch contacts"""
        if not self.access_token:
            if not self.authenticate():
                return []
        
        query = soql or "SELECT Id, FirstName, LastName, Email, Phone, Account.Name, Title FROM Contact LIMIT 10000"
        
        response = self.session.get(
            f"{self.instance_url}/services/data/v57.0/query",
            params={"q": query}
        )
        response.raise_for_status()
        return response.json().get("records", [])
    
    def map_to_latticeiq(self, sf_contact: Dict[str, Any]) -> Dict[str, Any]:
        """Map Salesforce contact to LatticeIQ schema"""
        # Handle Account.Name for company (nested object)
        account = sf_contact.get("Account") or {}
        company = account.get("Name") if isinstance(account, dict) else None
        
        return {
            "first_name": sf_contact.get("FirstName") or "Unknown",
            "last_name": sf_contact.get("LastName") or "",
            "email": sf_contact.get("Email") or "",
            "phone": sf_contact.get("Phone"),
            "company": company,
            "job_title": sf_contact.get("Title"),  # FIXED: was "title"
            "external_id": sf_contact.get("Id"),
            "crm_type": "salesforce",
        }
    
    def test_connection(self) -> bool:
        """Test API connection"""
        try:
            if not self.access_token:
                if not self.authenticate():
                    return False
            
            response = self.session.get(
                f"{self.instance_url}/services/data/v57.0/query",
                params={"q": "SELECT Id FROM Contact LIMIT 1"}
            )
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"Salesforce connection error: {e}")
            return False
