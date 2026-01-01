# backend/app/hubspot/router.py
# NEW FILE

from fastapi import APIRouter, HTTPException, Depends, Header
from typing import List, Optional
import uuid
import logging

from .hubspot_client import HubSpotClient
from .hubspot_import import HubSpotImporter
from .models import (
    HubSpotAuthRequest,
    HubSpotAuthCallbackRequest,
    HubSpotImportRequest,
    HubSpotImportResponse,
    HubSpotIntegrationStatus,
)
from app.db import get_db_session
from app.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v3/hubspot", tags=["hubspot"])

# =============================================================================
# OAuth Endpoints
# =============================================================================

@router.post("/auth/authorize")
async def authorize_hubspot(
    authorization: str = Header(...),
    db = Depends(get_db_session),
):
    """
    Initiate HubSpot OAuth flow.
    Returns authorization URL for frontend to redirect to.
    """
    try:
        user = await get_current_user(authorization)
        workspace_id = user.get("workspace_id")

        # Generate state token for CSRF protection
        state = str(uuid.uuid4())

        # Build authorization URL
        client = HubSpotClient()
        auth_url = client.get_authorization_url(state=state, workspace_id=workspace_id)

        # Store state in Redis/DB for verification (optional but recommended)
        # For MVP, we'll skip this and trust HubSpot's state param

        return {
            "authorization_url": auth_url,
            "state": state,
        }

    except Exception as e:
        logger.error(f"HubSpot auth error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auth/callback")
async def auth_callback(
    request: HubSpotAuthCallbackRequest,
    authorization: str = Header(...),
    db = Depends(get_db_session),
):
    """
    Handle HubSpot OAuth callback.
    Exchange authorization code for access/refresh tokens.
    """
    try:
        user = await get_current_user(authorization)
        workspace_id = user.get("workspace_id")

        # Exchange code for tokens
        client = HubSpotClient()
        tokens = await client.exchange_code_for_tokens(
            code=request.code,
            state=request.state,
        )

        # Get HubSpot user info
        hubspot_user = await client.get_user_info(tokens["access_token"])

        # Store integration in database
        integration_id = str(uuid.uuid4())

        # Insert into crm_integrations table
        db.execute("""
            INSERT INTO crm_integrations (
                id, workspace_id, provider, access_token, refresh_token,
                token_expires_at, connected_email, connected_at, metadata
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), %s)
            ON CONFLICT (workspace_id, provider) DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                token_expires_at = EXCLUDED.token_expires_at,
                connected_email = EXCLUDED.connected_email,
                metadata = EXCLUDED.metadata
        """, (
            integration_id,
            workspace_id,
            "hubspot",
            tokens["access_token"],
            tokens["refresh_token"],
            tokens["expires_at"],
            hubspot_user["email"],
            {"hubspot_account_id": hubspot_user["hubspot_account_id"]},
        ))

        db.commit()

        return {
            "success": True,
            "message": "HubSpot integration authorized successfully",
            "email": hubspot_user["email"],
        }

    except Exception as e:
        logger.error(f"HubSpot callback error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disconnect")
async def disconnect_hubspot(
    authorization: str = Header(...),
    db = Depends(get_db_session),
):
    """Disconnect HubSpot integration"""
    try:
        user = await get_current_user(authorization)
        workspace_id = user.get("workspace_id")

        # Delete from crm_integrations
        db.execute("""
            DELETE FROM crm_integrations
            WHERE workspace_id = %s AND provider = %s
        """, (workspace_id, "hubspot"))

        db.commit()

        return {"success": True, "message": "HubSpot disconnected"}

    except Exception as e:
        logger.error(f"HubSpot disconnect error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/integration-status")
async def get_integration_status(
    authorization: str = Header(...),
    db = Depends(get_db_session),
) -> HubSpotIntegrationStatus:
    """Get HubSpot integration status for current workspace"""
    try:
        user = await get_current_user(authorization)
        workspace_id = user.get("workspace_id")

        # Query crm_integrations table
        db.execute("""
            SELECT id, provider, access_token, refresh_token, token_expires_at,
                   connected_email, connected_at
            FROM crm_integrations
            WHERE workspace_id = %s AND provider = %s
        """, (workspace_id, "hubspot"))

        row = db.fetchone()

        if not row:
            return HubSpotIntegrationStatus(
                id="",
                provider="hubspot",
                is_connected=False,
            )

        return HubSpotIntegrationStatus(
            id=row[0],
            provider=row[1],
            is_connected=True,
            access_token=row[2],
            refresh_token=row[3],
            token_expires_at=row[5],
            connected_email=row[5],
            connected_at=str(row[6]),
        )

    except Exception as e:
        logger.error(f"Error getting integration status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Import Endpoint
# =============================================================================

@router.post("/import")
async def import_hubspot_contacts(
    request: HubSpotImportRequest,
    authorization: str = Header(...),
    db = Depends(get_db_session),
) -> HubSpotImportResponse:
    """
    Import contacts from HubSpot with filters.
    Auto-enrich via quick-enrich if enabled.
    """
    try:
        user = await get_current_user(authorization)
        workspace_id = user.get("workspace_id")
        user_id = user.get("sub")

        # Get HubSpot integration
        db.execute("""
            SELECT access_token, refresh_token, token_expires_at
            FROM crm_integrations
            WHERE workspace_id = %s AND provider = %s
        """, (workspace_id, "hubspot"))

        integration = db.fetchone()
        if not integration:
            raise HTTPException(
                status_code=400,
                detail="HubSpot not connected. Please authorize first.",
            )

        access_token = integration[0]

        # Initialize importer
        importer = HubSpotImporter(
            access_token=access_token,
            workspace_id=workspace_id,
            db=db,
        )

        # Fetch and import contacts
        result = await importer.import_contacts(
            filters=request.filters,
            properties_to_import=request.properties_to_import,
            auto_enrich=request.auto_enrich,
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Import error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
