"""
backend/app/crm/models.py
CRM Import Data Models (Pydantic)
"""

from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, Dict, List, Any
from datetime import datetime
from enum import Enum


class CRMProvider(str, Enum):
    """Supported CRM providers"""
    CSV = "csv"
    HUBSPOT = "hubspot"
    SALESFORCE = "salesforce"
    PIPEDRIVE = "pipedrive"
    API = "api"


class ImportStatus(str, Enum):
    """Import job status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class FieldType(str, Enum):
    """CSV field data types"""
    TEXT = "text"
    EMAIL = "email"
    PHONE = "phone"
    NUMBER = "number"
    DATE = "date"
    URL = "url"
    UNKNOWN = "unknown"


# ============================================================================
# CSV Upload & Preview
# ============================================================================

class DetectedField(BaseModel):
    """Auto-detected CSV field"""
    field_name: str
    detected_type: FieldType
    confidence: float  # 0.0 to 1.0
    sample_values: List[str] = []


class CSVPreviewResponse(BaseModel):
    """Response from /api/v3/crm/preview-csv"""
    file_name: str
    total_rows: int
    preview_rows: List[Dict[str, Any]]
    column_headers: List[str]
    detected_fields: Dict[str, Dict[str, Any]]
    has_errors: bool = False
    error_message: Optional[str] = None


# ============================================================================
# Field Mapping
# ============================================================================

class FieldMappingRequest(BaseModel):
    """Request to save a field mapping"""
    mapping_name: str
    csv_columns: List[str]
    db_field_mapping: Dict[str, str]  # {"CSV Column": "db_field"}
    is_default: bool = False

    @field_validator('mapping_name')
    @classmethod
    def validate_mapping_name(cls, v: str) -> str:
        if not v or len(v) < 3 or len(v) > 100:
            raise ValueError("Mapping name must be 3-100 characters")
        return v


class FieldMappingResponse(BaseModel):
    """Response from /api/v3/crm/save-mapping"""
    id: str
    mapping_name: str
    csv_columns: List[str]
    db_field_mapping: Dict[str, str]
    is_default: bool
    created_at: datetime
    updated_at: datetime


class SavedFieldMapping(BaseModel):
    """Get saved field mappings"""
    id: str
    mapping_name: str
    csv_columns: List[str]
    db_field_mapping: Dict[str, str]
    is_default: bool
    created_at: datetime


# ============================================================================
# Import Filters
# ============================================================================

class ImportFilter(BaseModel):
    """Filters to apply during import"""
    min_score: Optional[int] = None  # Minimum MDCP/BANT/SPICE score
    max_score: Optional[int] = None
    score_type: Optional[str] = None  # "mdcp", "bant", "spice", or None for no filter
    enrichment_status: Optional[str] = None  # "completed", "pending", or None for all
    company_pattern: Optional[str] = None  # Regex or contains pattern
    exclude_duplicates: bool = True
    
    @field_validator('score_type')
    @classmethod
    def validate_score_type(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in ["mdcp", "bant", "spice"]:
            raise ValueError("score_type must be 'mdcp', 'bant', 'spice', or None")
        return v


# ============================================================================
# Contact Import
# ============================================================================

class ContactImportData(BaseModel):
    """Single contact from CSV"""
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    website: Optional[str] = None
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not v or '@' not in v:
            raise ValueError("Invalid email format")
        return v.lower().strip()
    
    @field_validator('first_name', 'last_name')
    @classmethod
    def validate_names(cls, v: str) -> str:
        if not v or len(v) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v.strip()


class ImportContactsRequest(BaseModel):
    """Request to /api/v3/crm/import-contacts"""
    csv_data: str  # Base64 encoded CSV or JSON array of contact objects
    field_mapping: Dict[str, str]  # {"CSV Column": "db_field"}
    import_filters: Optional[ImportFilter] = None
    auto_enrich: bool = False
    auto_score: bool = False
    save_mapping_as: Optional[str] = None  # Save this mapping for reuse


class ImportResult(BaseModel):
    """Result of a single imported contact"""
    contact_id: str
    first_name: str
    email: str
    company: Optional[str]
    status: str = "success"
    error: Optional[str] = None


class ImportJobResponse(BaseModel):
    """Response from /api/v3/crm/import-contacts"""
    import_job_id: str
    total_processed: int
    imported: int
    duplicates_skipped: int
    failed: int
    errors: Dict[int, str]  # {row_number: error_message}
    import_time_seconds: float
    status: ImportStatus
    created_contacts: List[ImportResult] = []


# ============================================================================
# Import History
# ============================================================================

class ImportHistoryEntry(BaseModel):
    """Single entry in import history"""
    id: str
    file_name: str
    total_rows: int
    imported_rows: int
    failed_rows: int
    duplicates_skipped: int
    status: ImportStatus
    source_provider: CRMProvider
    import_filters: Optional[Dict[str, Any]]
    created_at: datetime
    completed_at: Optional[datetime]


class ImportHistoryResponse(BaseModel):
    """Response from /api/v3/crm/import-history"""
    imports: List[ImportHistoryEntry]
    total: int


# ============================================================================
# CRM Integration Credentials
# ============================================================================

class CRMIntegrationRequest(BaseModel):
    """Request to save CRM credentials"""
    provider: CRMProvider
    provider_account_id: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    sync_frequency: str = "manual"  # "manual", "daily", "weekly"


class CRMIntegrationResponse(BaseModel):
    """Response from CRM integration endpoints"""
    id: str
    provider: CRMProvider
    provider_account_id: Optional[str]
    is_active: bool
    last_synced_at: Optional[datetime]
    sync_frequency: str
    created_at: datetime
    updated_at: datetime


class CRMIntegrationListResponse(BaseModel):
    """List of connected CRM integrations"""
    integrations: List[CRMIntegrationResponse]
    total: int


# ============================================================================
# Error Response
# ============================================================================

class ImportErrorDetail(BaseModel):
    """Detailed error for a specific row"""
    row_number: int
    error_code: str
    message: str
    field_name: Optional[str] = None
    value: Optional[str] = None


class ImportErrorResponse(BaseModel):
    """Error response from import endpoints"""
    error: str
    message: str
    details: List[ImportErrorDetail] = []
    status_code: int = 422
