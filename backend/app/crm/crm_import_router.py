#!/usr/bin/env python3
"""
================================================================================
# FILE: app/crm/crm_import_router.py
# CRM Import Integration Module for LatticeIQ
================================================================================
"""

import csv
import io
import logging
import re
from typing import Dict, List, Optional, Set, Tuple
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError

from app.crm.models import (
    # Enums
    CRMProvider,
    ImportStatus,
    FieldType,
    # Requests
    CSVUploadRequest,
    FieldDetectionRequest,
    SaveMappingRequest,
    ImportFilterRequest,
    ValidateImportRequest,
    ExecuteImportRequest,
    # Responses
    CSVPreviewResponse,
    FieldDetectionResult,
    FieldDetectionResponse,
    SaveMappingResponse,
    SavedMapping,
    SavedMappingsResponse,
    ValidationError as ValidationErrorModel,
    ValidateImportResponse,
    ImportResult,
    ExecuteImportResponse,
    ImportHistoryItem,
    ImportHistoryResponse,
)

# ================================================================================
# SETUP
# ================================================================================

router = APIRouter(prefix="/crm", tags=["crm"])
logger = logging.getLogger(__name__)

# Field detection patterns
FIELD_PATTERNS = {
    FieldType.EMAIL: re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'),
    FieldType.PHONE: re.compile(r'^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$'),
    FieldType.WEBSITE: re.compile(r'^https?://[^\s/$.?#].[^\s]*$|^www\.[^\s]*$'),
    FieldType.ZIP: re.compile(r'^\d{5}(-\d{4})?$'),
}

# ================================================================================
# HELPER FUNCTIONS
# ================================================================================

def parse_csv_content(csv_content: str) -> Tuple[List[str], List[Dict[str, str]]]:
    """Parse CSV content into headers and rows."""
    try:
        reader = csv.DictReader(io.StringIO(csv_content))
        headers = reader.fieldnames or []
        rows = list(reader)
        return list(headers), rows
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {str(e)}"
        )

def detect_field_type(column_name: str, sample_values: List[str]) -> Tuple[FieldType, float]:
    """Detect field type based on column name and sample values."""
    column_lower = column_name.lower()
    
    # Check column name patterns first (high confidence)
    name_patterns = {
        FieldType.EMAIL: ['email', 'e-mail', 'mail'],
        FieldType.PHONE: ['phone', 'mobile', 'tel', 'telephone'],
        FieldType.WEBSITE: ['website', 'url', 'web', 'site'],
        FieldType.COMPANY: ['company', 'organization', 'org', 'firm'],
        FieldType.NAME: ['name', 'fullname', 'first_name', 'last_name'],
        FieldType.ADDRESS: ['address', 'street'],
        FieldType.CITY: ['city', 'town'],
        FieldType.STATE: ['state', 'province'],
        FieldType.ZIP: ['zip', 'postal', 'code'],
        FieldType.COUNTRY: ['country', 'nation'],
        FieldType.DATE: ['date', 'created', 'updated', 'birth'],
    }
    
    for field_type, patterns in name_patterns.items():
        if any(pattern in column_lower for pattern in patterns):
            return field_type, 0.95
    
    # Check sample values
    if not sample_values:
        return FieldType.TEXT, 0.5
    
    matches = {field_type: 0 for field_type in FieldType}
    
    for value in sample_values:
        if not value or value.isspace():
            continue
            
        if FieldType.EMAIL in FIELD_PATTERNS and FIELD_PATTERNS[FieldType.EMAIL].match(value):
            matches[FieldType.EMAIL] += 1
        elif FieldType.PHONE in FIELD_PATTERNS and FIELD_PATTERNS[FieldType.PHONE].match(value):
            matches[FieldType.PHONE] += 1
        elif FieldType.WEBSITE in FIELD_PATTERNS and FIELD_PATTERNS[FieldType.WEBSITE].match(value):
            matches[FieldType.WEBSITE] += 1
        elif FieldType.ZIP in FIELD_PATTERNS and FIELD_PATTERNS[FieldType.ZIP].match(value):
            matches[FieldType.ZIP] += 1
        elif value.isdigit():
            matches[FieldType.NUMBER] += 1
    
    # Find best match
    best_type = FieldType.TEXT
    best_count = 0
    
    for field_type, count in matches.items():
        if count > best_count:
            best_type = field_type
            best_count = count
    
    # Calculate confidence
    confidence = min(1.0, best_count / len(sample_values)) if sample_values else 0.5
    
    return best_type, confidence

def suggest_field_mapping(headers: List[str], detected_fields: List[FieldDetectionResult]) -> Dict[str, str]:
    """Suggest database field names based on detected types."""
    suggestions = {}
    
    db_field_names = {
        FieldType.EMAIL: "email",
        FieldType.PHONE: "phone",
        FieldType.NAME: "name",
        FieldType.COMPANY: "company",
        FieldType.WEBSITE: "website",
        FieldType.ADDRESS: "address",
        FieldType.CITY: "city",
        FieldType.STATE: "state",
        FieldType.ZIP: "zip_code",
        FieldType.COUNTRY: "country",
        FieldType.DATE: "date_field",
        FieldType.NUMBER: "numeric_value",
        FieldType.TEXT: "text_field",
    }
    
    for field in detected_fields:
        db_name = db_field_names.get(field.detected_type, "custom_field")
        suggestions[field.column_name] = db_name
    
    return suggestions

def detect_duplicates(rows: List[Dict[str, str]], email_column: str) -> Set[str]:
    """Detect duplicate emails in data."""
    emails = set()
    duplicates = set()
    
    for row in rows:
        email = row.get(email_column, "").strip().lower()
        if email:
            if email in emails:
                duplicates.add(email)
            emails.add(email)
    
    return duplicates

# ================================================================================
# API ENDPOINTS
# ================================================================================

@router.post("/preview-csv", response_model=CSVPreviewResponse)
async def preview_csv(request: CSVUploadRequest):
    """
    Preview CSV file with field detection.
    
    Returns first 5 rows, detected field types, and field mapping suggestions.
    """
    try:
        headers, rows = parse_csv_content(request.csv_content)
        
        if not headers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV file has no headers"
            )
        
        # Get sample values (first 5 rows)
        sample_rows = rows[:5] if rows else []
        
        # Detect field types
        detected_fields = []
        for header in headers:
            sample_values = [row.get(header, "") for row in sample_rows if header in row]
            field_type, confidence = detect_field_type(header, sample_values)
            
            detected_fields.append(FieldDetectionResult(
                column_name=header,
                detected_type=field_type,
                confidence=confidence,
                sample_values=sample_values[:5]
            ))
        
        # Convert sample rows to list of dicts for response
        preview_data = []
        for row in sample_rows:
            preview_data.append({k: str(v) for k, v in row.items()})
        
        return CSVPreviewResponse(
            file_name=request.file_name,
            total_rows=len(rows),
            preview_rows=len(sample_rows),
            headers=headers,
            sample_data=preview_data,
            detected_fields=detected_fields
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing CSV: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error previewing CSV: {str(e)}"
        )

@router.post("/detect-fields", response_model=FieldDetectionResponse)
async def detect_fields(request: FieldDetectionRequest):
    """
    Detect field types in CSV content.
    
    Returns detected types and suggested database field mappings.
    """
    try:
        headers, rows = parse_csv_content(request.csv_content)
        
        detected_fields = []
        for header in headers:
            sample_values = [row.get(header, "") for row in rows[:5] if header in row]
            field_type, confidence = detect_field_type(header, sample_values)
            
            detected_fields.append(FieldDetectionResult(
                column_name=header,
                detected_type=field_type,
                confidence=confidence,
                sample_values=sample_values[:5]
            ))
        
        suggestions = suggest_field_mapping(headers, detected_fields)
        
        return FieldDetectionResponse(
            detected_fields=detected_fields,
            suggestions=suggestions
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error detecting fields: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error detecting fields: {str(e)}"
        )

@router.post("/save-mapping", response_model=SaveMappingResponse)
async def save_mapping(request: SaveMappingRequest):
    """
    Save field mapping for reuse.
    
    Note: In production, this would save to database with workspace isolation.
    For now, returns confirmation.
    """
    try:
        # In production, save to field_mappings table
        # with workspace_id and user_id from auth token
        
        mapping_id = "map_" + datetime.utcnow().isoformat()
        
        return SaveMappingResponse(
            mapping_id=mapping_id,
            mapping_name=request.mapping_name,
            created_at=datetime.utcnow().isoformat()
        )
    
    except Exception as e:
        logger.error(f"Error saving mapping: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving mapping: {str(e)}"
        )

@router.get("/saved-mappings", response_model=SavedMappingsResponse)
async def get_saved_mappings():
    """
    Get all saved field mappings for user.
    
    Note: In production, would filter by workspace_id and user_id.
    """
    try:
        # In production, query field_mappings table
        
        return SavedMappingsResponse(
            mappings=[],
            count=0
        )
    
    except Exception as e:
        logger.error(f"Error fetching mappings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching mappings: {str(e)}"
        )

@router.post("/validate-import", response_model=ValidateImportResponse)
async def validate_import(request: ValidateImportRequest):
    """
    Validate import data before execution.
    
    Checks for required fields, data format, and duplicates.
    """
    try:
        headers, rows = parse_csv_content(request.csv_content)
        
        errors: List[ValidationErrorModel] = []
        valid_count = 0
        duplicates_found = 0
        
        # Validate each row
        for idx, row in enumerate(rows, start=2):  # Start at 2 (1-indexed, skip header)
            for csv_col, db_field in request.field_mapping.items():
                if csv_col not in row:
                    errors.append(ValidationErrorModel(
                        row_number=idx,
                        column=csv_col,
                        error=f"Column not found in CSV",
                        value=""
                    ))
                    continue
                
                value = row[csv_col].strip()
                
                # Check required fields
                if not value and db_field in ['email', 'name']:
                    errors.append(ValidationErrorModel(
                        row_number=idx,
                        column=csv_col,
                        error=f"Required field '{db_field}' is empty",
                        value=value
                    ))
                
                # Validate email format if email field
                if db_field == 'email' and value:
                    email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
                    if not email_pattern.match(value):
                        errors.append(ValidationErrorModel(
                            row_number=idx,
                            column=csv_col,
                            error="Invalid email format",
                            value=value
                        ))
            
            if not any(e.row_number == idx for e in errors):
                valid_count += 1
        
        # Check for duplicates in email field
        email_column = next((k for k, v in request.field_mapping.items() if v == 'email'), None)
        if email_column:
            duplicates = detect_duplicates(rows, email_column)
            duplicates_found = len(duplicates)
        
        return ValidateImportResponse(
            is_valid=len(errors) == 0,
            total_rows=len(rows),
            valid_rows=valid_count,
            invalid_rows=len(errors),
            errors=errors,
            duplicates_found=duplicates_found,
            warnings=[]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating import: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validating import: {str(e)}"
        )

@router.post("/import-contacts", response_model=ExecuteImportResponse)
async def import_contacts(request: ExecuteImportRequest):
    """
    Execute actual import of contacts.
    
    Creates import job, processes rows, handles duplicates, and returns results.
    """
    try:
        headers, rows = parse_csv_content(request.csv_content)
        
        import_id = "imp_" + datetime.utcnow().isoformat()
        results: List[ImportResult] = []
        successful = 0
        failed = 0
        skipped_dupes = 0
        
        # Get email column for duplicate detection
        email_column = next((k for k, v in request.field_mapping.items() if v == 'email'), None)
        existing_emails = set()
        
        for idx, row in enumerate(rows, start=1):
            try:
                # Check for duplicates
                email = row.get(email_column, "").strip().lower() if email_column else ""
                
                if email and email in existing_emails:
                    if request.skip_duplicates:
                        skipped_dupes += 1
                        continue
                
                if email:
                    existing_emails.add(email)
                
                # In production, would insert into contacts table here
                # For now, just track success
                successful += 1
                results.append(ImportResult(
                    row_number=idx,
                    status="success",
                    contact_id=f"contact_{idx}",
                    error=None
                ))
            
            except Exception as e:
                failed += 1
                results.append(ImportResult(
                    row_number=idx,
                    status="error",
                    contact_id=None,
                    error=str(e)
                ))
        
        return ExecuteImportResponse(
            import_id=import_id,
            status=ImportStatus.COMPLETED if failed == 0 else ImportStatus.COMPLETED,
            total_rows=len(rows),
            successful_imports=successful,
            failed_imports=failed,
            skipped_duplicates=skipped_dupes,
            results=results,
            errors=[]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing contacts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error importing contacts: {str(e)}"
        )

@router.get("/import-history", response_model=ImportHistoryResponse)
async def get_import_history():
    """
    Get import history for user's workspace.
    
    Note: In production, would filter by workspace_id.
    """
    try:
        # In production, query import_jobs table
        
        return ImportHistoryResponse(
            imports=[],
            count=0
        )
    
    except Exception as e:
        logger.error(f"Error fetching import history: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching import history: {str(e)}"
        )
