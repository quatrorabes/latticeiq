#!/usr/bin/env python3
# ============================================================================
# FILE: backend/app/models.py
# ============================================================================
"""SQLAlchemy ORM models for LatticeIQ"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, JSON, ForeignKey, UniqueConstraint
import uuid

Base = declarative_base()


class User(Base):
    """User account (from Supabase auth)"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CRMIntegration(Base):
    """CRM integration settings per user"""
    __tablename__ = "crm_integrations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    crm_type = Column(String(50), nullable=False)  # hubspot, salesforce, pipedrive
    
    # Encrypted credentials (in production, use encryption at rest)
    api_key = Column(Text)
    api_url = Column(String(255))
    client_id = Column(String(255))
    client_secret = Column(Text)
    username = Column(String(255))
    password = Column(Text)
    
    # Configuration
    is_active = Column(Boolean, default=False)
    test_status = Column(String(50), default="untested")  # untested, success, failed
    last_test_at = Column(DateTime)
    last_sync_at = Column(DateTime)
    
    # Import settings
    import_filters = Column(JSON, default={})  # Filtering rules
    required_fields = Column(JSON, default={})  # Field requirements
    auto_sync_enabled = Column(Boolean, default=False)
    sync_frequency_hours = Column(Integer, default=24)
    max_contacts_per_sync = Column(Integer, default=1000)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint("user_id", "crm_type", name="uq_user_crm_type"),
    )
    


class Contact(Base):
    """Contact record"""
    __tablename__ = "contacts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Basic info
    first_name = Column(String(100))
    last_name = Column(String(100))
    email = Column(String(255), index=True)
    phone = Column(String(20))
    company = Column(String(200))
    job_title = Column(String(100))
    linkedin_url = Column(String(500))
    
    # CRM metadata
    crm_type = Column(String(50))  # hubspot, salesforce, pipedrive
    external_id = Column(String(255))  # ID in source CRM
    
    # Enrichment
    enrichment_status = Column(String(50), default="pending")  # pending, enriched, failed
    enrichment_data = Column(JSON)
    
    # Scoring
    mdcp_score = Column(Integer)
    bant_score = Column(Integer)
    spice_score = Column(Integer)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ImportJob(Base):
    """CRM import job tracking"""
    __tablename__ = "import_jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    crm_type = Column(String(50), nullable=False)
    
    status = Column(String(50), default="pending")  # pending, running, completed, failed
    total_contacts = Column(Integer, default=0)
    imported_contacts = Column(Integer, default=0)
    skipped_contacts = Column(Integer, default=0)
    error_message = Column(Text)
    
    job_metadata = Column(JSON, default={})  # ✅ CORRECT
    
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)


class ImportLog(Base):
    """Individual contact import log"""
    __tablename__ = "import_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("import_jobs.id"), nullable=False)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"))
    
    email = Column(String(255), index=True)
    status = Column(String(50))  # success, duplicate, error, skipped
    reason = Column(Text)  # Why skipped/errored
    
    created_at = Column(DateTime, default=datetime.utcnow)


class DNCEntry(Base):
    """Do Not Contact list"""
    __tablename__ = "dnc_list"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(20))
    reason = Column(String(100))  # unsubscribed, bounced, invalid, manual_block
    created_at = Column(DateTime, default=datetime.utcnow)
    