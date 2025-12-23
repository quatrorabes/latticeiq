#!/usr/bin/env python3

from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ContactBase(BaseModel):
	"""Contact data model (matches Supabase schema exactly)."""
	first_name: str
	last_name: str
	email: str
	phone: Optional[str] = None
	company: Optional[str] = None
	job_title: Optional[str] = None
	linkedin_url: Optional[str] = None
	website: Optional[str] = None
	vertical: Optional[str] = None
	persona_type: Optional[str] = None
	annual_revenue: Optional[str] = None
	
class ContactCreate(ContactBase):
	"""For POST requests."""
	enrichment_status: str = "pending"
	
class Contact(ContactBase):
	"""API response model."""
	id: str
	workspace_id: str
	user_id: str
	enrichment_status: str
	enrichment_data: Optional[dict] = None
	enriched_at: Optional[datetime] = None
	apex_score: Optional[int] = None
	mdc_score: Optional[int] = None
	rss_score: Optional[int] = None
	mdcp_score: Optional[int] = None
	bant_score: Optional[int] = None
	spice_score: Optional[int] = None
	notes: Optional[str] = None
	created_at: datetime
	updated_at: datetime
	
	class Config:
		from_attributes = True
		