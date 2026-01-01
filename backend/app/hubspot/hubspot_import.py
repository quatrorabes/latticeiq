# backend/app/hubspot/hubspot_import.py
# NEW FILE

import logging
import uuid
from typing import List, Dict, Optional
from datetime import datetime

from .hubspot_client import HubSpotClient
from .models import HubSpotImportFilters, HubSpotImportResponse
from app.enrichment_v3.enrich_simple import enrich_contact_perplexity

logger = logging.getLogger(__name__)


class HubSpotImporter:
    """Handles import logic: filtering, mapping, creating contacts, and enriching"""

    def __init__(self, access_token: str, workspace_id: str, db):
        self.client = HubSpotClient()
        self.access_token = access_token
        self.workspace_id = workspace_id
        self.db = db

    async def import_contacts(
        self,
        filters: HubSpotImportFilters,
        properties_to_import: List[str],
        auto_enrich: bool = False,
    ) -> HubSpotImportResponse:
        """
        Main import flow:
        1. Fetch all contacts from HubSpot
        2. Filter by Lead Status and Lifecycle Stage
        3. Parse properties to contact fields
        4. Create contacts in LatticeIQ
        5. Queue auto-enrich if enabled
        """

        logger.info(f"Starting HubSpot import for workspace {self.workspace_id}")

        try:
            # Step 1: Fetch all contacts
            logger.info(f"Fetching contacts from HubSpot with properties: {properties_to_import}")
            hubspot_contacts = await self.client.get_all_contacts(
                access_token=self.access_token,
                properties=properties_to_import,
            )

            logger.info(f"Fetched {len(hubspot_contacts)} total contacts from HubSpot")

            # Step 2: Filter contacts
            filtered_contacts = self._filter_contacts(hubspot_contacts, filters)
            logger.info(f"After filtering: {len(filtered_contacts)} contacts")

            # Step 3: Parse and create contacts
            created_count = 0
            enrichment_queued_count = 0
            duplicate_count = 0
            failed_count = 0
            errors: Dict[str, str] = {}
            created_ids: List[str] = []

            for hubspot_contact in filtered_contacts:
                try:
                    # Parse HubSpot properties to contact fields
                    contact_data = self._map_hubspot_to_contact(hubspot_contact)

                    # Check for duplicates by email
                    if contact_data.get("email"):
                        self.db.execute("""
                            SELECT id FROM contacts
                            WHERE workspace_id = %s AND email = %s
                        """, (self.workspace_id, contact_data["email"]))

                        if self.db.fetchone():
                            duplicate_count += 1
                            continue

                    # Create contact
                    contact_id = str(uuid.uuid4())
                    contact_data["id"] = contact_id
                    contact_data["workspace_id"] = self.workspace_id
                    contact_data["source"] = "hubspot"
                    contact_data["hubspot_id"] = hubspot_contact["id"]
                    contact_data["imported_at"] = datetime.utcnow().isoformat()

                    # Set enrichment status
                    if auto_enrich:
                        contact_data["enrichment_status"] = "queued"
                    else:
                        contact_data["enrichment_status"] = "pending"

                    # Build INSERT statement
                    columns = list(contact_data.keys())
                    placeholders = ", ".join(["%s"] * len(columns))
                    values = [contact_data[col] for col in columns]

                    insert_sql = f"""
                        INSERT INTO contacts ({", ".join(columns)})
                        VALUES ({placeholders})
                    """

                    self.db.execute(insert_sql, values)
                    self.db.commit()

                    created_count += 1
                    created_ids.append(contact_id)

                    # Queue enrichment
                    if auto_enrich:
                        try:
                            # Call quick-enrich async (fire and forget)
                            logger.info(f"Queuing enrichment for contact {contact_id}")
                            # In production, use a background task queue (Celery, etc.)
                            # For MVP, we'll trigger directly
                            import asyncio
                            asyncio.create_task(
                                enrich_contact_perplexity(
                                    contact_id=contact_id,
                                    db=self.db,
                                )
                            )
                            enrichment_queued_count += 1
                        except Exception as e:
                            logger.error(f"Failed to queue enrichment: {str(e)}")

                except Exception as e:
                    failed_count += 1
                    contact_email = hubspot_contact.get("properties", {}).get("email", "unknown")
                    errors[contact_email] = str(e)
                    logger.error(f"Failed to import contact {contact_email}: {str(e)}")

            logger.info(
                f"Import complete: {created_count} created, "
                f"{duplicate_count} duplicates, {failed_count} failed, "
                f"{enrichment_queued_count} enrichments queued"
            )

            return HubSpotImportResponse(
                total_contacts=len(hubspot_contacts),
                imported=created_count,
                enrichment_queued=enrichment_queued_count,
                duplicates_skipped=duplicate_count,
                failed=failed_count,
                created_contact_ids=created_ids,
                errors=errors,
            )

        except Exception as e:
            logger.error(f"Import error: {str(e)}")
            raise

    def _filter_contacts(
        self,
        contacts: List[Dict],
        filters: HubSpotImportFilters,
    ) -> List[Dict]:
        """Filter contacts by Lead Status and Lifecycle Stage"""

        filtered = []

        for contact in contacts:
            properties = contact.get("properties", {})

            # Check Lead Status (exclude if matches)
            lead_status = properties.get("hs_lead_status")
            if lead_status in filters.lead_status_exclude:
                continue

            # Check Lifecycle Stage (exclude if matches)
            lifecycle_stage = properties.get("lifecyclestage")
            if lifecycle_stage in filters.lifecycle_status_exclude:
                continue

            # Require at least email or first/last name
            email = properties.get("email")
            first_name = properties.get("firstname")
            last_name = properties.get("lastname")

            if not (email or (first_name and last_name)):
                continue

            filtered.append(contact)

        return filtered

    def _map_hubspot_to_contact(self, hubspot_contact: Dict) -> Dict:
        """
        Map HubSpot contact properties to LatticeIQ contact fields.
        Returns a dict with all available fields populated.
        """

        properties = hubspot_contact.get("properties", {})

        # Direct mappings
        contact_data = {
            "first_name": properties.get("firstname"),
            "last_name": properties.get("lastname"),
            "email": properties.get("email"),
            "phone": properties.get("phone"),
            "phone_mobile": properties.get("mobilephone"),
            "company": properties.get("company"),
            "job_title": properties.get("jobtitle"),
            "linkedin_url": properties.get("linkedinurl"),
            "industry": properties.get("industry"),
            "company_size": properties.get("numberofemployees"),
            "annual_revenue": properties.get("annualrevenue"),
            "lifecycle_stage": properties.get("lifecyclestage"),
            "lead_status": properties.get("hs_lead_status"),
            "last_activity_date": properties.get("hs_analytics_last_visit"),
            # Additional HubSpot-specific fields
            "hubspot_metadata": {
                "contact_id": hubspot_contact.get("id"),
                "created_at": hubspot_contact.get("createdAt"),
                "updated_at": hubspot_contact.get("updatedAt"),
                "link": hubspot_contact.get("link"),
            },
        }

        # Filter out None values
        return {k: v for k, v in contact_data.items() if v is not None}
