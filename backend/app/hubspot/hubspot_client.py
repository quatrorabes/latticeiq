# backend/app/hubspot/hubspot_client.py
# CORRECTED - Works with API key

import aiohttp
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

class HubSpotClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.hubapi.com"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    async def test_connection(self) -> Dict[str, Any]:
        """Test the API connection"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/crm/v3/objects/contacts?limit=1",
                headers=self.headers
            ) as resp:
                if resp.status == 401:
                    raise Exception("Invalid API key")
                if resp.status == 200:
                    data = await resp.json()
                    return {"authenticated": True, "contact_count": data.get("paging", {}).get("total", 0)}
                raise Exception(f"Connection failed: {resp.status}")

    async def get_contacts(self, limit: int = 100, after: Optional[str] = None) -> Dict[str, Any]:
        """Fetch contacts from HubSpot"""
        params = {
            "limit": limit,
            "properties": [
                "firstname",
                "lastname",
                "email",
                "company",
                "phone",
                "mobilephone",
                "jobtitle",
                "industry"
            ]
        }
        if after:
            params["after"] = after

        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/crm/v3/objects/contacts",
                headers=self.headers,
                params=params
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                raise Exception(f"Failed to fetch contacts: {resp.status}")

    async def get_all_contacts(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch all contacts with pagination"""
        all_contacts = []
        after = None

        while True:
            data = await self.get_contacts(limit=limit, after=after)
            contacts = data.get("results", [])
            all_contacts.extend(contacts)

            # Check for next page
            paging = data.get("paging", {})
            after = paging.get("next", {}).get("after")
            if not after:
                break

        return all_contacts
