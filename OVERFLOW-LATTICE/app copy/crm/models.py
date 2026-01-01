from pydantic import BaseModel, Field, EmailStr, validator
from typing import List, Optional, Dict, Any
from enum import Enum
import re

# ================================================================================
# ENUMS
# ================================================================================

class CRMProvider(str, Enum):
    """Supported CRM providers"""
    CSV = "csv"
    HUBSPOT = "hubspot"
    SALESFORCE = "salesforce"
    PIPEDRIVE = "pipedrive"

class ImportStatus(str, Enum):
    """Import job status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class FieldType(str, Enum):
    """Detected field types"""
    EMAIL = "email"
    PHONE = "phone"
    NAME = "name"
    COMPANY = "company"
    WEBSITE = "website"
    ADDRESS = "address"
    CITY = "city"
    STATE = "state"
    ZIP = "zip"
    COUNTRY = "country"
    DATE = "date"
    NUMBER = "number"
    TEXT = "text"
    UNKNOWN = "unknown"

# ================================================================================
# REQUEST MODELS
# ================================================================================

class CSVUploadRequest(BaseModel):
    """CSV file upload request"""
    csv_content: str = Field(..., description="CSV file content as string")
    file_name: str = Field(..., description="Original file name")
    
    class Config:
        json_schema_extra = {
            "example": {
                "csv_content": "name,email,company\nJohn Doe,john@example.com,Acme",
                "file_name": "contacts.csv"
            }
        }

class FieldDetectionRequest(BaseModel):
    """Field type detection request"""
    csv_content: str = Field(..., description="CSV content to analyze")
    
    class Config:
        json_schema_extra = {
            "example": {
                "csv_content": "name,email,company\nJohn,john@example.com,Acme"
            }
        }

class FieldMapping(BaseModel):
    """Column to database field mapping"""
    csv_column: str = Field(..., description="CSV column name")
    db_field: str = Field(..., description="Database field name")
    field_type: FieldType = Field(..., description="Detected field type")
    confidence: float = Field(default=1.0, ge=0, le=1, description="Detection confidence 0-1")

class SaveMappingRequest(BaseModel):
    """Save field mapping for reuse"""
    mapping_name: str = Field(..., description="Name for this mapping")
    csv_columns: List[str] = Field(..., description="CSV column names in order")
    db_field_mapping: Dict[str, str] = Field(..., description="CSV column to DB field mapping")
    is_default: bool = Field(default=False, description="Mark as default mapping")
    
    class Config:
        json_schema_extra = {
            "example": {
                "mapping_name": "Standard CRM Import",
                "csv_columns": ["name", "email", "company"],
                "db_field_mapping": {
                    "name": "contact_name",
                    "email": "contact_email",
                    "company": "company_name"
                },
                "is_default": True
            }
        }

class ImportFilterRequest(BaseModel):
    """Filters for import preview/execution"""
    min_score: Optional[int] = Field(default=None, ge=0, le=100)
    company_filter: Optional[str] = Field(default=None)
    status_filter: Optional[str] = Field(default=None)

class ValidateImportRequest(BaseModel):
    """Validate import data before execution"""
    csv_content: str = Field(..., description="CSV content")
    field_mapping: Dict[str, str] = Field(..., description="Column mapping")
    filters: Optional[ImportFilterRequest] = Field(default=None)

class ExecuteImportRequest(BaseModel):
    """Execute actual import"""
    csv_content: str = Field(..., description="CSV content")
    field_mapping: Dict[str, str] = Field(..., description="Column mapping")
    filters: Optional[ImportFilterRequest] = Field(default=None)
    skip_duplicates: bool = Field(default=True)

# ================================================================================
# RESPONSE MODELS
# ================================================================================

class FieldDetectionResult(BaseModel):
    """Single field detection result"""
    column_name: str = Field(..., description="CSV column name")
    detected_type: FieldType = Field(..., description="Detected field type")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score 0-1")
    sample_values: List[str] = Field(..., description="Sample values from column")

class CSVPreviewResponse(BaseModel):
    """CSV preview with detected fields"""
    file_name: str = Field(..., description="Original file name")
    total_rows: int = Field(..., description="Total rows in CSV")
    preview_rows: int = Field(..., description="Number of preview rows")
    headers: List[str] = Field(..., description="CSV column headers")
    sample_data: List[Dict[str, str]] = Field(..., description="Sample rows")
    detected_fields: List[FieldDetectionResult] = Field(..., description="Detected field types")
    
    class Config:
        json_schema_extra = {
            "example": {
                "file_name": "contacts.csv",
                "total_rows": 100,
                "preview_rows": 5,
                "headers": ["name", "email", "company"],
                "sample_data": [
                    {"name": "John Doe", "email": "john@example.com", "company": "Acme"}
                ],
                "detected_fields": [
                    {
                        "column_name": "name",
                        "detected_type": "name",
                        "confidence": 0.95,
                        "sample_values": ["John Doe", "Jane Smith"]
                    }
                ]
            }
        }

class FieldDetectionResponse(BaseModel):
    """Field detection results"""
    detected_fields: List[FieldDetectionResult] = Field(..., description="Detected fields")
    suggestions: Dict[str, str] = Field(..., description="Suggested field mappings")

class SaveMappingResponse(BaseModel):
    """Saved mapping confirmation"""
    mapping_id: str = Field(..., description="UUID of saved mapping")
    mapping_name: str = Field(..., description="Name of mapping")
    created_at: str = Field(..., description="Creation timestamp")

class SavedMapping(BaseModel):
    """Saved mapping info"""
    id: str = Field(..., description="Mapping UUID")
    mapping_name: str = Field(..., description="Mapping name")
    csv_columns: List[str] = Field(..., description="CSV column names")
    db_field_mapping: Dict[str, str] = Field(..., description="Field mapping")
    is_default: bool = Field(..., description="Is default mapping")
    created_at: str = Field(..., description="Creation timestamp")

class SavedMappingsResponse(BaseModel):
    """List of saved mappings"""
    mappings: List[SavedMapping] = Field(..., description="List of saved mappings")
    count: int = Field(..., description="Total count")

class ValidationError(BaseModel):
    """Single validation error"""
    row_number: int = Field(..., description="Row number (1-indexed)")
    column: str = Field(..., description="Column name")
    error: str = Field(..., description="Error message")
    value: str = Field(..., description="Problematic value")

class ValidateImportResponse(BaseModel):
    """Import validation results"""
    is_valid: bool = Field(..., description="Is import valid")
    total_rows: int = Field(..., description="Total rows to import")
    valid_rows: int = Field(..., description="Valid rows")
    invalid_rows: int = Field(..., description="Invalid rows")
    errors: List[ValidationError] = Field(..., description="List of errors")
    duplicates_found: int = Field(default=0, description="Number of duplicates")
    warnings: List[str] = Field(default=[], description="Warnings")

class ImportResult(BaseModel):
    """Single import result"""
    row_number: int = Field(..., description="Original CSV row number")
    status: str = Field(..., description="'success' or 'error'")
    contact_id: Optional[str] = Field(default=None, description="Created contact UUID")
    error: Optional[str] = Field(default=None, description="Error message if failed")

class ImportProgressResponse(BaseModel):
    """Import progress update"""
    import_id: str = Field(..., description="Import job UUID")
    status: ImportStatus = Field(..., description="Current status")
    total_rows: int = Field(..., description="Total rows")
    processed_rows: int = Field(..., description="Rows processed so far")
    successful_imports: int = Field(..., description="Successful imports")
    failed_imports: int = Field(..., description="Failed imports")
    skipped_duplicates: int = Field(..., description="Skipped duplicates")
    progress_percent: int = Field(..., ge=0, le=100, description="Progress 0-100%")

class ExecuteImportResponse(BaseModel):
    """Import execution result"""
    import_id: str = Field(..., description="Import job UUID")
    status: ImportStatus = Field(..., description="Final status")
    total_rows: int = Field(..., description="Total rows")
    successful_imports: int = Field(..., description="Successfully imported")
    failed_imports: int = Field(..., description="Failed imports")
    skipped_duplicates: int = Field(..., description="Skipped duplicates")
    results: List[ImportResult] = Field(..., description="Per-row results")
    errors: List[str] = Field(default=[], description="Summary errors")

class ImportHistoryItem(BaseModel):
    """Single import history entry"""
    id: str = Field(..., description="Import job UUID")
    file_name: str = Field(..., description="Imported file name")
    status: ImportStatus = Field(..., description="Import status")
    total_rows: int = Field(..., description="Total rows imported")
    successful: int = Field(..., description="Successful imports")
    failed: int = Field(..., description="Failed imports")
    duplicates_skipped: int = Field(..., description="Duplicates skipped")
    created_at: str = Field(..., description="Import timestamp")

class ImportHistoryResponse(BaseModel):
    """Import history list"""
    imports: List[ImportHistoryItem] = Field(..., description="List of imports")
    count: int = Field(..., description="Total imports")
