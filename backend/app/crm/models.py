#!/usr/bin/env python3


# ============================================================================
# FILE: backend/crm/models.py
# ============================================================================
"""Data models for CRM imports and tracking"""

from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID, uuid4


class ImportJob(BaseModel):
	"""Represents a CRM import job"""
	id: UUID = Field(default_factory=uuid4)
	user_id: UUID  # Foreign key to auth.users
	crm_type: str  # "hubspot", "salesforce", "pipedrive", "csv"
	status: str = "pending"  # pending, running, completed, failed
	total_contacts: int = 0
	imported_contacts: int = 0
	skipped_contacts: int = 0
	error_message: Optional[str] = None
	metadata: Dict[str, Any] = Field(default_factory=dict)  # crm_account_id, filename, etc.
	created_at: datetime = Field(default_factory=datetime.utcnow)
	completed_at: Optional[datetime] = None
	
	class Config:
		json_encoders = {UUID: str}
		
		
class ImportLog(BaseModel):
	"""Log entry for individual contact import"""
	id: UUID = Field(default_factory=uuid4)
	job_id: UUID  # Foreign key to import_jobs
	contact_id: Optional[UUID] = None  # If successfully imported
	email: str
	status: str  # "success", "duplicate", "error", "skipped"
	reason: Optional[str] = None  # Why skipped/errored
	created_at: datetime = Field(default_factory=datetime.utcnow)
	
	class Config:
		json_encoders = {UUID: str}
		
		
class DNCEntry(BaseModel):
	"""Do Not Contact list entry"""
	id: UUID = Field(default_factory=uuid4)
	user_id: UUID
	email: str
	phone: Optional[str] = None
	reason: str  # "unsubscribed", "bounced", "invalid", "manual_block"
	created_at: datetime = Field(default_factory=datetime.utcnow)
	
	class Config:
		json_encoders = {UUID: str}
		