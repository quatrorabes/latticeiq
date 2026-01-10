# ============================================================================
# FILE: backend/app/routers/import_router.py
# PURPOSE: Unified import router for CSV with validation + filters
# VERSION: 2.0.0 - Complete rewrite with ImportService
# ============================================================================

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Header
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import csv
import io
import json
import logging
import uuid

from app.services.import_service import (
    ImportService, ImportFilters, ImportSource,
    ImportValidationSummary, FilterPresets, ContactNormalizer
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/import", tags=["Import"])


# ============================================================================
# DEPENDENCIES
# ============================================================================

def get_supabase():
    """Get Supabase client - imported from main."""
    from app.main import supabase
    return supabase


async def get_current_user_id(authorization: str = Header(...)) -> str:
    """Extract user ID from JWT token."""
    import jwt
    try:
        parts = authorization.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization format")
        
        token = parts[1]
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user id")
        
        return str(user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class CSVImportRequest(BaseModel):
    """Request model for CSV import with filters."""
    filters: Optional[ImportFilters] = Field(default=None)
    field_mapping: Optional[Dict[str, str]] = Field(
        default=None,
        description="Custom field mapping: {csv_column: standard_field}"
    )
    preview_only: bool = Field(default=False, description="Only preview, don't import")


class ImportPreviewResponse(BaseModel):
    """Preview response showing what would be imported."""
    total_rows: int
    valid_contacts: int
    rejected_contacts: int
    rejection_reasons: Dict[str, int]
    sample_valid: List[Dict[str, Any]] = Field(default_factory=list, max_length=5)
    sample_rejected: List[Dict[str, Any]] = Field(default_factory=list, max_length=5)
    detected_columns: List[str]
    suggested_mapping: Dict[str, str]


class ImportResultResponse(BaseModel):
    """Response after successful import."""
    success: bool
    import_id: str
    total_processed: int
    imported_count: int
    skipped_count: int
    failed_count: int
    rejection_reasons: Dict[str, int]
    contacts_created: List[str] = Field(default_factory=list, description="IDs of created contacts")
    duration_ms: int


class FilterPresetsResponse(BaseModel):
    """Available filter presets."""
    presets: Dict[str, ImportFilters]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def detect_csv_columns(content: str) -> List[str]:
    """Detect column names from CSV content."""
    reader = csv.reader(io.StringIO(content))
    try:
        headers = next(reader)
        return [h.strip() for h in headers]
    except StopIteration:
        return []


def suggest_field_mapping(columns: List[str]) -> Dict[str, str]:
    """Suggest field mapping based on column names."""
    mapping = {}
    
    column_aliases = {
        "first_name": ["first_name", "firstname", "first", "given_name", "givenname", "first name"],
        "last_name": ["last_name", "lastname", "last", "surname", "family_name", "familyname", "last name"],
        "email": ["email", "email_address", "e-mail", "mail", "emailaddress", "e-mail address"],
        "phone": ["phone", "phone_number", "telephone", "mobile", "cell", "mobilephone", "phone number"],
        "company": ["company", "company_name", "organization", "org", "employer", "company name"],
        "title": ["title", "job_title", "jobtitle", "position", "role", "job title"],
        "linkedin_url": ["linkedin_url", "linkedin", "linkedin_profile", "linkedinurl", "linkedin url"],
        "website": ["website", "url", "company_website", "web"],
        "city": ["city", "locality"],
        "state": ["state", "region", "province"],
        "country": ["country", "country_name"],
        "industry": ["industry", "company_industry"],
    }
    
    for col in columns:
        col_lower = col.lower().strip()
        for standard_field, aliases in column_aliases.items():
            if col_lower in aliases:
                mapping[col] = standard_field
                break
    
    return mapping


def apply_field_mapping(row: Dict[str, Any], mapping: Dict[str, str]) -> Dict[str, Any]:
    """Apply field mapping to a row."""
    mapped = {}
    for csv_col, value in row.items():
        if csv_col in mapping:
            mapped[mapping[csv_col]] = value
        else:
            # Keep unmapped fields with original name (lowercase, underscored)
            clean_key = csv_col.lower().strip().replace(" ", "_")
            mapped[clean_key] = value
    return mapped


def parse_csv_content(content: str, mapping: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    """Parse CSV content into list of dictionaries."""
    reader = csv.DictReader(io.StringIO(content))
    rows = []
    
    for row in reader:
        # Clean empty values
        cleaned = {k: v.strip() if v else None for k, v in row.items()}
        
        # Apply mapping if provided
        if mapping:
            cleaned = apply_field_mapping(cleaned, mapping)
        
        rows.append(cleaned)
    
    return rows


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/health")
async def import_health():
    """Health check for import service."""
    return {
        "status": "operational",
        "service": "import",
        "version": "2.0.0",
        "supported_sources": ["csv", "hubspot", "salesforce", "pipedrive"],
        "features": ["validation", "filtering", "deduplication", "preview"]
    }


@router.get("/filters/presets", response_model=FilterPresetsResponse)
async def get_filter_presets():
    """Get available filter presets."""
    return FilterPresetsResponse(
        presets={
            "quality_leads": FilterPresets.quality_leads(),
            "linkedin_enrichable": FilterPresets.linkedin_enrichable(),
            "enterprise_only": FilterPresets.enterprise_only(),
            "smb_only": FilterPresets.smb_only(),
            "recent_30_days": FilterPresets.recent_activity(30),
        }
    )


@router.post("/csv/preview", response_model=ImportPreviewResponse)
async def preview_csv_import(
    file: UploadFile = File(...),
    filters_json: Optional[str] = Form(default=None),
    field_mapping_json: Optional[str] = Form(default=None),
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """
    Preview CSV import without actually importing.
    Shows validation results and suggested mappings.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    # Read file content
    content = await file.read()
    try:
        content_str = content.decode('utf-8')
    except UnicodeDecodeError:
        content_str = content.decode('latin-1')
    
    # Detect columns
    columns = detect_csv_columns(content_str)
    if not columns:
        raise HTTPException(status_code=400, detail="Could not detect CSV columns")
    
    # Get suggested mapping
    suggested_mapping = suggest_field_mapping(columns)
    
    # Parse filters and mapping
    filters = None
    if filters_json:
        try:
            filters = ImportFilters(**json.loads(filters_json))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid filters: {e}")
    
    field_mapping = suggested_mapping  # Use suggested by default
    if field_mapping_json:
        try:
            custom_mapping = json.loads(field_mapping_json)
            field_mapping.update(custom_mapping)  # Override with custom
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid field mapping: {e}")
    
    # Parse CSV
    rows = parse_csv_content(content_str, field_mapping)
    
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    
    # Create import service and process
    import_service = ImportService(supabase)
    
    # Get existing emails for deduplication check
    existing_emails = await import_service.get_existing_emails(user_id)
    
    # Process batch (preview mode - just validate)
    valid_contacts, summary = import_service.process_batch(
        raw_contacts=rows,
        source=ImportSource.CSV,
        filters=filters,
        existing_emails=existing_emails
    )
    
    # Collect samples
    sample_valid = valid_contacts[:5]
    
    # Get sample rejected (re-process to find them)
    sample_rejected = []
    for row in rows[:20]:  # Check first 20 for rejected samples
        result = import_service.validate_contact(row, ImportSource.CSV, filters)
        if not result.is_valid and len(sample_rejected) < 5:
            sample_rejected.append({
                "data": row,
                "reason": result.rejection_reason
            })
    
    return ImportPreviewResponse(
        total_rows=len(rows),
        valid_contacts=summary.valid_contacts,
        rejected_contacts=summary.rejected_contacts,
        rejection_reasons=summary.rejection_reasons,
        sample_valid=sample_valid,
        sample_rejected=sample_rejected,
        detected_columns=columns,
        suggested_mapping=suggested_mapping
    )


@router.post("/csv", response_model=ImportResultResponse)
async def import_csv(
    file: UploadFile = File(...),
    filters_json: Optional[str] = Form(default=None),
    field_mapping_json: Optional[str] = Form(default=None),
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """
    Import contacts from CSV file with validation and filtering.
    
    Minimum requirements:
    - first_name + last_name (required)
    - At least ONE of: email, phone, company, linkedin_url
    
    Filters can be applied to further restrict imports.
    """
    start_time = datetime.now(timezone.utc)
    import_id = str(uuid.uuid4())
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    # Read file content
    content = await file.read()
    try:
        content_str = content.decode('utf-8')
    except UnicodeDecodeError:
        content_str = content.decode('latin-1')
    
    # Detect columns and get suggested mapping
    columns = detect_csv_columns(content_str)
    suggested_mapping = suggest_field_mapping(columns)
    
    # Parse filters
    filters = ImportFilters()  # Default filters
    if filters_json:
        try:
            filters = ImportFilters(**json.loads(filters_json))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid filters: {e}")
    
    # Parse field mapping
    field_mapping = suggested_mapping
    if field_mapping_json:
        try:
            custom_mapping = json.loads(field_mapping_json)
            field_mapping.update(custom_mapping)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid field mapping: {e}")
    
    # Parse CSV
    rows = parse_csv_content(content_str, field_mapping)
    
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    
    # Create import service
    import_service = ImportService(supabase)
    
    # Get existing emails
    existing_emails = await import_service.get_existing_emails(user_id)
    
    # Process batch
    valid_contacts, summary = import_service.process_batch(
        raw_contacts=rows,
        source=ImportSource.CSV,
        filters=filters,
        existing_emails=existing_emails
    )
    
    # Create import history record
    try:
        history_record = {
            "id": import_id,
            "user_id": user_id,
            "source": "csv",
            "source_file_name": file.filename,
            "total_processed": summary.total_processed,
            "imported_count": 0,  # Will update
            "skipped_count": summary.rejected_contacts,
            "failed_count": 0,
            "filters_applied": filters.model_dump() if filters else {},
            "rejection_reasons": summary.rejection_reasons,
            "status": "in_progress",
            "started_at": start_time.isoformat()
        }
        supabase.table("import_history").insert(history_record).execute()
    except Exception as e:
        logger.warning(f"Could not create import history: {e}")
    
    # Insert valid contacts
    created_ids = []
    failed_count = 0
    
    for contact in valid_contacts:
        try:
            contact["user_id"] = user_id
            contact["id"] = str(uuid.uuid4())
            
            result = supabase.table("contacts").insert(contact).execute()
            
            if result.data:
                created_ids.append(contact["id"])
        except Exception as e:
            logger.error(f"Failed to insert contact: {e}")
            failed_count += 1
    
    # Calculate duration
    end_time = datetime.now(timezone.utc)
    duration_ms = int((end_time - start_time).total_seconds() * 1000)
    
    # Update import history
    try:
        supabase.table("import_history").update({
            "imported_count": len(created_ids),
            "failed_count": failed_count,
            "status": "completed",
            "completed_at": end_time.isoformat(),
            "duration_ms": duration_ms
        }).eq("id", import_id).execute()
    except Exception as e:
        logger.warning(f"Could not update import history: {e}")
    
    return ImportResultResponse(
        success=True,
        import_id=import_id,
        total_processed=summary.total_processed,
        imported_count=len(created_ids),
        skipped_count=summary.rejected_contacts,
        failed_count=failed_count,
        rejection_reasons=summary.rejection_reasons,
        contacts_created=created_ids[:100],  # Return first 100 IDs
        duration_ms=duration_ms
    )


@router.get("/history")
async def get_import_history(
    limit: int = 20,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """Get user's import history."""
    try:
        result = supabase.table("import_history")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
        
        return {
            "imports": result.data or [],
            "count": len(result.data or []),
            "offset": offset,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"Failed to fetch import history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch import history")


@router.get("/history/{import_id}")
async def get_import_details(
    import_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    """Get details of a specific import."""
    try:
        result = supabase.table("import_history")\
            .select("*")\
            .eq("id", import_id)\
            .eq("user_id", user_id)\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Import not found")
        
        return result.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch import details: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch import details")
