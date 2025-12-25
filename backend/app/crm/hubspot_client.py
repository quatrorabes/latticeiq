#!/usr/bin/env python3

# ============================================================================
# FILE: backend/app/crm/hubspot_client.py
# ============================================================================
"""HubSpot API client for contact sync with company associations"""

import requests
from typing import List, Dict, Any, Optional

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
        self._company_cache: Dict[str, str] = {}

    def get_contacts(self, limit: int = 100, after: Optional[str] = None) -> Dict[str, Any]:
        """Fetch contacts from HubSpot with pagination and company associations"""
        params = {
            "limit": limit,
            "properties": [
                "firstname",
                "lastname",
                "email",
                "phone",
                "mobilephone",
                "company",
                "jobtitle",
                "hs_lead_status",
                "lifecyclestage",
                "linkedin_url",
                "linkedinbio",
            ],
            "associations": ["companies"]
        }

        if after:
            params["after"] = after

        response = self.session.get(
            f"{self.BASE_URL}/crm/v3/objects/contacts",
            params=params
        )

        response.raise_for_status()
        return response.json()

    def get_company_name(self, company_id: str) -> Optional[str]:
        """Fetch company name by ID (with caching)"""
        if company_id in self._company_cache:
            return self._company_cache[company_id]

        try:
            response = self.session.get(
                f"{self.BASE_URL}/crm/v3/objects/companies/{company_id}",
                params={"properties": "name"}
            )

            response.raise_for_status()
            name = response.json().get("properties", {}).get("name")
            self._company_cache[company_id] = name
            return name

        except Exception as e:
            print(f"Error fetching company {company_id}: {e}")
            return None

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

        # Get company from property OR association
        company = props.get("company")

        if not company:
            # Try to get from company association
            associations = hs_contact.get("associations", {})
            companies = associations.get("companies", {}).get("results", [])

            if companies:
                company_id = companies[0].get("id")
                if company_id:
                    company = self.get_company_name(company_id)

        # Get phone (try both fields)
        phone = props.get("phone") or props.get("mobilephone")

        # Get LinkedIn URL
        linkedin = props.get("linkedin_url") or props.get("linkedinbio")

        return {
            "first_name": props.get("firstname") or "Unknown",
            "last_name": props.get("lastname") or "",
            "email": props.get("email") or "",
            "phone": phone,
            "company": company,
            "job_title": props.get("jobtitle"),
            "linkedin_url": linkedin,
            "lifecycle_stage": props.get("lifecyclestage"),
            "lead_status": props.get("hs_lead_status"),
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
