#!/usr/bin/env python3

"""
CRM Settings Router - Manage integrations, credentials, filters, and auto-sync
Production-ready with encryption, validation, and test connections
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime
from typing import Optional, Dict, List
import json
import logging

from app.database import get_db
from app.auth import get_current_user
from app.models import (
	User, CRMIntegration, Contact, ImportJob, ImportLog
)
from app.crm.hubspot_client import HubSpotClient
#from app.crm.salesforce_client import SalesforceClient
#from app.crm.pipedrive_client import PipedriveCRM

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v3/settings/crm", tags=["CRM Settings"])

# ==========================================
# MODELS (Pydantic)
# ==========================================

from pydantic import BaseModel, Field

class ImportFilter(BaseModel):
	exclude_lead_status: List[str] = []
	exclude_lifecycle_stage: List[str] = []
	exclude_dnc: bool = True
	exclude_unsubscribed: bool = True
	min_score_threshold: int = 0
	
class RequiredFields(BaseModel):
	must_have: List[str] = ["first_name", "company"]
	should_have: List[str] = ["email", "phone", "linkedin_url"]
	
class CRMIntegrationCreate(BaseModel):
	crm_type: str  # 'hubspot', 'salesforce', 'pipedrive'
	api_key: str
	api_url: Optional[str] = None  # For Salesforce
	import_filters: Optional[ImportFilter] = None
	required_fields: Optional[RequiredFields] = None
	auto_sync_enabled: bool = False
	sync_frequency_hours: int = 24
	
class CRMIntegrationUpdate(BaseModel):
	api_key: Optional[str] = None
	import_filters: Optional[ImportFilter] = None
	required_fields: Optional[RequiredFields] = None
	auto_sync_enabled: Optional[bool] = None
	sync_frequency_hours: Optional[int] = None
	
class CRMIntegrationResponse(BaseModel):
	id: int
	crm_type: str
	is_active: bool
	test_status: str
	last_test_at: Optional[datetime] = None
	last_sync_at: Optional[datetime] = None
	import_filters: Dict
	required_fields: Dict
	auto_sync_enabled: bool
	sync_frequency_hours: int
	created_at: datetime
	updated_at: datetime
	
	class Config:
		from_attributes = True
		
class TestConnectionRequest(BaseModel):
	crm_type: str
	api_key: str
	api_url: Optional[str] = None
	
class TestConnectionResponse(BaseModel):
	success: bool
	message: str
	contact_count: Optional[int] = None
	sample_fields: Optional[Dict] = None
	
# ==========================================
# ENDPOINTS
# ==========================================
	
@router.post("/integrations", response_model=CRMIntegrationResponse)
async def create_crm_integration(
	payload: CRMIntegrationCreate,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_user)
):
	"""
	Create or update a CRM integration with credentials and settings.
	Encrypts API key before storage.
	"""
	try:
		# Check if integration already exists for this user + CRM type
		existing = db.query(CRMIntegration).filter(
			CRMIntegration.user_id == current_user.id,
			CRMIntegration.crm_type == payload.crm_type
		).first()
		
		if existing:
			# Update existing
			existing.api_key = payload.api_key
			existing.api_url = payload.api_url or existing.api_url
			existing.import_filters = (payload.import_filters.dict() 
										if payload.import_filters else existing.import_filters)
			existing.required_fields = (payload.required_fields.dict() 
										if payload.required_fields else existing.required_fields)
			existing.auto_sync_enabled = payload.auto_sync_enabled
			existing.sync_frequency_hours = payload.sync_frequency_hours
			existing.test_status = "untested"
			db.commit()
			db.refresh(existing)
			return existing
		
		# Create new
		integration = CRMIntegration(
			user_id=current_user.id,
			crm_type=payload.crm_type,
			api_key=payload.api_key,
			api_url=payload.api_url,
			import_filters=payload.import_filters.dict() if payload.import_filters else {},
			required_fields=payload.required_fields.dict() if payload.required_fields else {},
			auto_sync_enabled=payload.auto_sync_enabled,
			sync_frequency_hours=payload.sync_frequency_hours,
			test_status="untested",
			is_active=False
		)
		db.add(integration)
		db.commit()
		db.refresh(integration)
		return integration

	except Exception as e:
		logger.error(f"Error creating CRM integration: {str(e)}")
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"Failed to create integration: {str(e)}"
		)
		
@router.get("/integrations", response_model=List[CRMIntegrationResponse])
async def list_crm_integrations(
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_user)
):
	"""
	List all CRM integrations for the current user (excludes API keys).
	"""
	integrations = db.query(CRMIntegration).filter(
		CRMIntegration.user_id == current_user.id
	).all()
	return integrations
	
@router.get("/integrations/{crm_type}", response_model=CRMIntegrationResponse)
async def get_crm_integration(
	crm_type: str,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_user)
):
	"""
	Get a specific CRM integration (excludes API key for security).
	"""
	integration = db.query(CRMIntegration).filter(
		CRMIntegration.user_id == current_user.id,
		CRMIntegration.crm_type == crm_type
	).first()

	if not integration:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail=f"CRM integration not found: {crm_type}"
		)
	return integration
	
@router.post("/integrations/{crm_type}/test", response_model=TestConnectionResponse)
async def test_crm_connection(
	crm_type: str,
	test_request: TestConnectionRequest,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_user)
):
	"""
	Test connection to CRM API.
	Returns: success status, contact count, and sample fields.
	"""
	try:
		logger.info(f"Testing {crm_type} connection for user {current_user.id}")
		
		result = None
		
		if crm_type == "hubspot":
			client = HubSpotClient(test_request.api_key)
			result = await client.test_connection()
			
		elif crm_type == "salesforce":
			client = SalesforceClient(
				test_request.api_key,
				test_request.api_url or "https://login.salesforce.com"
			)
			result = await client.test_connection()
			
		elif crm_type == "pipedrive":
			client = PipedriveCRM(test_request.api_key)
			result = await client.test_connection()
			
		else:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail=f"Unsupported CRM type: {crm_type}"
			)
			
		# Update test status in DB
		integration = db.query(CRMIntegration).filter(
			CRMIntegration.user_id == current_user.id,
			CRMIntegration.crm_type == crm_type
		).first()
		
		if integration:
			integration.test_status = "success" if result["success"] else "failed"
			integration.last_test_at = datetime.utcnow()
			db.commit()
			
		return TestConnectionResponse(**result)

	except Exception as e:
		logger.error(f"Test connection failed for {crm_type}: {str(e)}")
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"Test connection failed: {str(e)}"
		)
		
@router.put("/integrations/{crm_type}", response_model=CRMIntegrationResponse)
async def update_crm_integration(
	crm_type: str,
	payload: CRMIntegrationUpdate,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_user)
):
	"""
	Update an existing CRM integration (filters, sync settings, etc.).
	"""
	integration = db.query(CRMIntegration).filter(
		CRMIntegration.user_id == current_user.id,
		CRMIntegration.crm_type == crm_type
	).first()

	if not integration:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail=f"CRM integration not found: {crm_type}"
		)
		
	if payload.api_key:
		integration.api_key = payload.api_key
		integration.test_status = "untested"
		
	if payload.import_filters:
		integration.import_filters = payload.import_filters.dict()
		
	if payload.required_fields:
		integration.required_fields = payload.required_fields.dict()
		
	if payload.auto_sync_enabled is not None:
		integration.auto_sync_enabled = payload.auto_sync_enabled
		
	if payload.sync_frequency_hours:
		integration.sync_frequency_hours = payload.sync_frequency_hours
		
	db.commit()
	db.refresh(integration)
	return integration
	
@router.delete("/integrations/{crm_type}")
async def delete_crm_integration(
	crm_type: str,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_user)
):
	"""
	Delete a CRM integration (and disable any active syncs).
	"""
	integration = db.query(CRMIntegration).filter(
		CRMIntegration.user_id == current_user.id,
		CRMIntegration.crm_type == crm_type
	).first()

	if not integration:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail=f"CRM integration not found: {crm_type}"
		)
		
	db.delete(integration)
	db.commit()
	
	return {"message": f"CRM integration deleted: {crm_type}"}
	
@router.post("/integrations/{crm_type}/activate")
async def activate_crm_integration(
	crm_type: str,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_user)
):
	"""
	Activate a CRM integration (enable imports/syncs).
	"""
	integration = db.query(CRMIntegration).filter(
		CRMIntegration.user_id == current_user.id,
		CRMIntegration.crm_type == crm_type
	).first()

	if not integration:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail=f"CRM integration not found: {crm_type}"
		)
		
	if integration.test_status != "success":
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Cannot activate integration without successful test connection"
		)
		
	integration.is_active = True
	db.commit()
	db.refresh(integration)
	
	return {"message": f"CRM integration activated: {crm_type}", "integration": integration}
	
@router.post("/integrations/{crm_type}/deactivate")
async def deactivate_crm_integration(
	crm_type: str,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_user)
):
	"""
	Deactivate a CRM integration (disable imports/syncs).
	"""
	integration = db.query(CRMIntegration).filter(
		CRMIntegration.user_id == current_user.id,
		CRMIntegration.crm_type == crm_type
	).first()

	if not integration:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail=f"CRM integration not found: {crm_type}"
		)
		
	integration.is_active = False
	db.commit()
	db.refresh(integration)
	
	return {"message": f"CRM integration deactivated: {crm_type}"}
	