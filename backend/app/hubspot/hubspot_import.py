# backend/app/hubspot/hubspot_import.py
# CORRECTED - Batch processing

from sqlalchemy.orm import Session
from sqlalchemy import text
from app.hubspot.hubspot_client import HubSpotClient
from typing import Dict, Any
import logging
import uuid

logger = logging.getLogger(__name__)

async def import_contacts_batch(
    client: HubSpotClient,
    workspace_id: str,
    batch_size: int = 50,
    db: Session = None
) -> Dict[str, Any]:
    """Import contacts in batches"""
    try:
        # Fetch all contacts
        contacts = await client.get_all_contacts(limit=batch_size)
        
        if not contacts:
            return {
                "success": True,
                "imported": 0,
                "total": 0,
                "message": "No contacts found in HubSpot"
            }

        # Insert into database
        imported_count = 0
        for contact in contacts:
            try:
                properties = contact.get("properties", {})
                
                email = properties.get("email", {}).get("value")
                first_name = properties.get("firstname", {}).get("value", "")
                last_name = properties.get("lastname", {}).get("value", "")
                company = properties.get("company", {}).get("value", "")

                if not email:
                    continue

                # Insert contact
                db.execute(text("""
                    INSERT INTO contacts (id, workspace_id, email, first_name, last_name, company, source, created_at, updated_at)
                    VALUES (:id, :workspace_id, :email, :first_name, :last_name, :company, :source, NOW(), NOW())
                    ON CONFLICT (email, workspace_id) DO UPDATE SET updated_at = NOW()
                """), {
                    "id": str(uuid.uuid4()),
                    "workspace_id": workspace_id,
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "company": company,
                    "source": "hubspot"
                })
                imported_count += 1
            except Exception as e:
                logger.error(f"Error importing contact: {str(e)}")
                continue

        db.commit()

        return {
            "success": True,
            "imported": imported_count,
            "total": len(contacts),
            "message": f"Successfully imported {imported_count} contacts"
        }

    except Exception as e:
        logger.error(f"Batch import error: {str(e)}")
        db.rollback()
        raise
