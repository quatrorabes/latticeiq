# backend/app/hubspot/hubspot_client.py
# NEW FILE

import aiohttp
import logging
from typing import Dict, Optional, List
from datetime import datetime, timedelta
import os

logger = logging.getLogger(__name__)

class HubSpotClient:
    """HubSpot API client for OAuth and contact fetching"""

    BASE_URL = "https://api.hubapi.com"
    OAUTH_BASE = "https://app.hubapi.com/oauth/authorize"

    def __init__(self):
        self.client_id = os.getenv("HUBSPOT_OAUTH_CLIENT_ID")
        self.client_secret = os.getenv("HUBSPOT_OAUTH_CLIENT_SECRET")
        self.redirect_uri = os.getenv("HUBSPOT_OAUTH_REDIRECT_URI", "https://latticeiq.vercel.app/settings?tab=hubspot")

    def get_authorization_url(self, state: str, workspace_id: str) -> str:
        """Build HubSpot OAuth authorization URL"""
        scopes = [
            "crm.objects.contacts.read",
            "crm.objects.companies.read",
            "oauth",
        ]

        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(scopes),
            "state": state,
        }

        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{self.OAUTH_BASE}?{query_string}"

    async def exchange_code_for_tokens(self, code: str, state: str) -> Dict:
        """Exchange authorization code for access/refresh tokens"""
        async with aiohttp.ClientSession() as session:
            response = await session.post(
                f"{self.BASE_URL}/oauth/v1/token",
                json={
                    "grant_type": "authorization_code",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": self.redirect_uri,
                    "code": code,
                },
            )

            if response.status != 200:
                raise Exception(f"Token exchange failed: {await response.text()}")

            data = await response.json()

            return {
                "access_token": data["access_token"],
                "refresh_token": data.get("refresh_token"),
                "expires_at": (datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600))).isoformat(),
            }

    async def get_user_info(self, access_token: str) -> Dict:
        """Get authenticated user info from HubSpot"""
        async with aiohttp.ClientSession() as session:
            headers = {"Authorization": f"Bearer {access_token}"}
            response = await session.get(
                f"{self.BASE_URL}/oauth/v1/access-tokens/{access_token}",
                headers=headers,
            )

            if response.status != 200:
                raise Exception(f"Failed to get user info: {await response.text()}")

            data = await response.json()

            return {
                "email": data.get("user"),
                "hubspot_account_id": data.get("hub_id"),
            }

    async def get_contacts(
        self,
        access_token: str,
        properties: List[str],
        limit: int = 100,
        after: Optional[str] = None,
    ) -> Dict:
        """
        Fetch contacts from HubSpot with specified properties.
        Returns paginated results.
        """
        async with aiohttp.ClientSession() as session:
            headers = {"Authorization": f"Bearer {access_token}"}

            params = {
                "limit": limit,
                "properties": properties,
            }

            if after:
                params["after"] = after

            response = await session.get(
                f"{self.BASE_URL}/crm/v3/objects/contacts",
                headers=headers,
                params=params,
            )

            if response.status != 200:
                raise Exception(f"Failed to fetch contacts: {await response.text()}")

            return await response.json()

    async def get_all_contacts(
        self,
        access_token: str,
        properties: List[str],
    ) -> List[Dict]:
        """Fetch ALL contacts from HubSpot (paginated)"""
        all_contacts = []
        after = None

        while True:
            response = await self.get_contacts(
                access_token=access_token,
                properties=properties,
                limit=100,
                after=after,
            )

            all_contacts.extend(response.get("results", []))

            # Check for pagination
            paging = response.get("paging", {})
            after = paging.get("next", {}).get("after")

            if not after:
                break

        return all_contacts

    async def refresh_access_token(self, refresh_token: str) -> Dict:
        """Refresh expired access token"""
        async with aiohttp.ClientSession() as session:
            response = await session.post(
                f"{self.BASE_URL}/oauth/v1/token",
                json={
                    "grant_type": "refresh_token",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": refresh_token,
                },
            )

            if response.status != 200:
                raise Exception(f"Token refresh failed: {await response.text()}")

            data = await response.json()

            return {
                "access_token": data["access_token"],
                "expires_at": (datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600))).isoformat(),
            }
