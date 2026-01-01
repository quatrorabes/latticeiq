from fastapi import APIRouter, Depends, HTTPException
from app.database import get_current_user

router = APIRouter(tags=["integrations"])

@router.get("/integrations/status")
async def get_integrations_status(user=Depends(get_current_user)):
    """Get integration status - placeholder for future integrations"""
    return {
        "slack": {"configured": False, "enabled": False},
        "webhooks": {"count": 0, "active": 0},
        "zapier": {"configured": False}
    }
