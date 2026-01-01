# backend/app/hubspot/router.py
# NEW - Simple API key based (no OAuth)

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.hubspot.hubspot_client import HubSpotClient
from app.hubspot.hubspot_import import import_contacts_batch
from app.auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v3/hubspot", tags=["hubspot"])

@router.post("/test-connection")
async def test_connection(
    api_key: str = Query(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Test HubSpot API key connection"""
    try:
        client = HubSpotClient(api_key=api_key)
        result = await client.test_connection()
        return {"success": True, "message": "Connected to HubSpot", "result": result}
    except Exception as e:
        logger.error(f"HubSpot connection error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/import-batch")
async def import_batch(
    api_key: str = Query(...),
    batch_size: int = Query(50, ge=10, le=500),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Import a batch of contacts from HubSpot"""
    try:
        client = HubSpotClient(api_key=api_key)
        result = await import_contacts_batch(
            client=client,
            workspace_id=current_user.workspace_id,
            batch_size=batch_size,
            db=db
        )
        return result
    except Exception as e:
        logger.error(f"HubSpot import error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/health")
async def health_check():
    """HubSpot router health check"""
    return {"status": "ok", "service": "hubspot"}
