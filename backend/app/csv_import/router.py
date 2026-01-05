# backend/app/csv_import/router.py
# CSV Import Router v1.0 - Google Contacts, Outlook, and Generic CSV support

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import csv
import io
import logging
import uuid
import os
from datetime import datetime
from supabase import create_client, Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/csv-import", tags=["csv-import"])

# ============================================================================
# SUPABASE CLIENT
# ============================================================================

def get_supabase() -> Client:
    """Get Supabase client"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(url, key)

# ============================================================================
# CSV FORMAT DEFINITIONS
# ============================================================================

# Google Contacts CSV Export field mapping
GOOGLE_CONTACTS_MAPPING = {
    "First Name": "first_name",
    "Last Name": "last_name",
    "Name": "full_name",  # Will be parsed
    "E-mail 1 - Value": "email",
    "E-mail 2 - Value": "email_secondary",
    "Phone 1 - Value": "phone",
    "Phone 2 - Value": "mobile_phone",
    "Organization 1 - Name": "company",
    "Organization 1 - Title": "title",  # Job title in Google
    "Organization 1 - Department": "department",
    "Address 1 - Street": "street_address",
    "Address 1 - City": "city",
    "Address 1 - Region": "state",
    "Address 1 - Postal Code": "postal_code",
    "Address 1 - Country": "country",
    "Address 1 - Formatted": "location",
    "Website 1 - Value": "website",
    "Notes": "notes",
    "Birthday": "birthday",
}

# Outlook CSV Export field mapping
OUTLOOK_CSV_MAPPING = {
    "First Name": "first_name",
    "Last Name": "last_name",
    "E-mail Address": "email",
    "E-mail 2 Address": "email_secondary",
    "Business Phone": "phone",
    "Mobile Phone": "mobile_phone",
    "Home Phone": "phone_home",
    "Company": "company",
    "Job Title": "title",
    "Department": "department",
    "Business Street": "street_address",
    "Business City": "city",
    "Business State": "state",
    "Business Postal Code": "postal_code",
    "Business Country": "country",
    "Web Page": "website",
    "Notes": "notes",
    "Birthday": "birthday",
}

# Generic/fallback mapping (common field names)
GENERIC_CSV_MAPPING = {
    # Name variations
    "first_name": "first_name",
    "firstname": "first_name",
    "first": "first_name",
    "given_name": "first_name",
    "last_name": "last_name",
    "lastname": "last_name",
    "last": "last_name",
    "family_name": "last_name",
    "surname": "last_name",
    "name": "full_name",
    "full_name": "full_name",
    "fullname": "full_name",
    
    # Email variations
    "email": "email",
    "email_address": "email",
    "emailaddress": "email",
    "e-mail": "email",
    "mail": "email",
    "primary_email": "email",
    
    # Phone variations
    "phone": "phone",
    "phone_number": "phone",
    "telephone": "phone",
    "mobile": "mobile_phone",
    "mobile_phone": "mobile_phone",
    "cell": "mobile_phone",
    "cell_phone": "mobile_phone",
    
    # Company/job variations
    "company": "company",
    "company_name": "company",
    "organization": "company",
    "employer": "company",
    "title": "title",
    "job_title": "title",
    "jobtitle": "title",
    "position": "title",
    "role": "title",
    "department": "department",
    
    # Location variations
    "city": "city",
    "state": "state",
    "province": "state",
    "region": "state",
    "country": "country",
    "postal_code": "postal_code",
    "zip": "postal_code",
    "zip_code": "postal_code",
    "zipcode": "postal_code",
    "address": "street_address",
    "street": "street_address",
    "street_address": "street_address",
    
    # Other
    "website": "website",
    "url": "website",
    "web": "website",
    "linkedin": "linkedin_url",
    "linkedin_url": "linkedin_url",
    "twitter": "twitter_handle",
    "twitter_handle": "twitter_handle",
    "notes": "notes",
    "note": "notes",
    "comments": "notes",
    "birthday": "birthday",
    "birth_date": "birthday",
    "industry": "industry",
}

# ============================================================================
# RESPONSE MODELS
# ============================================================================

class CSVPreviewResponse(BaseModel):
    success: bool
    detected_format: str  # "google", "outlook", "generic"
    total_rows: int
    headers: List[str]
    mapped_fields: Dict[str, str]
    unmapped_fields: List[str]
    sample_rows: List[Dict[str, Any]]

class ImportedContact(BaseModel):
    contact_id: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    fields_populated: int = 0
    status: str = "success"

class ImportResponse(BaseModel):
    success: bool
    message: str
    imported: int
    total: int
    duplicates_skipped: int = 0
    failed: int = 0
    no_email: int = 0
    total_fields_populated: int = 0
    avg_fields_per_contact: float = 0.0
    detected_format: str = "generic"
    contacts: List[ImportedContact] = []

class SupportedFormatsResponse(BaseModel):
    formats: List[Dict[str, Any]]

# ============================================================================
# CSV DETECTION AND PARSING
# ============================================================================

def detect_csv_format(headers: List[str]) -> str:
    """Detect CSV format based on header names"""
    headers_lower = [h.lower().strip() for h in headers]
    headers_set = set(headers)
    
    # Check for Google Contacts specific headers
    google_indicators = [
        "E-mail 1 - Value",
        "Organization 1 - Name",
        "Phone 1 - Value",
        "Address 1 - City"
    ]
    if any(h in headers_set for h in google_indicators):
        return "google"
    
    # Check for Outlook specific headers
    outlook_indicators = [
        "E-mail Address",
        "Business Phone",
        "Business City",
        "Job Title"
    ]
    if any(h in headers_set for h in outlook_indicators):
        return "outlook"
    
    return "generic"

def get_field_mapping(csv_format: str) -> Dict[str, str]:
    """Get field mapping based on detected format"""
    if csv_format == "google":
        return GOOGLE_CONTACTS_MAPPING
    elif csv_format == "outlook":
        return OUTLOOK_CSV_MAPPING
    else:
        return GENERIC_CSV_MAPPING

def normalize_header(header: str) -> str:
    """Normalize header for generic matching"""
    return header.lower().strip().replace(" ", "_").replace("-", "_")

def map_csv_row_to_contact(row: Dict[str, str], mapping: Dict[str, str], csv_format: str) -> Dict[str, Any]:
    """Map a CSV row to our contact schema"""
    contact = {
        "source": f"csv_{csv_format}",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    # For generic format, try normalized header matching
    if csv_format == "generic":
        for csv_header, value in row.items():
            if not value or not str(value).strip():
                continue
            
            normalized = normalize_header(csv_header)
            if normalized in mapping:
                our_field = mapping[normalized]
                contact[our_field] = str(value).strip()
    else:
        # For Google/Outlook, use direct mapping
        for csv_header, our_field in mapping.items():
            value = row.get(csv_header)
            if value and str(value).strip():
                contact[our_field] = str(value).strip()
    
    # Handle full_name parsing
    if contact.get("full_name") and not contact.get("first_name"):
        name_parts = contact["full_name"].split(" ", 1)
        contact["first_name"] = name_parts[0]
        if len(name_parts) > 1:
            contact["last_name"] = name_parts[1]
        del contact["full_name"]
    
    # Build location string if not present
    if not contact.get("location"):
        parts = []
        if contact.get("city"):
            parts.append(contact["city"])
        if contact.get("state"):
            parts.append(contact["state"])
        if contact.get("country"):
            parts.append(contact["country"])
        if parts:
            contact["location"] = ", ".join(parts)
    
    # Normalize LinkedIn URL
    linkedin = contact.get("linkedin_url", "")
    if linkedin and not linkedin.startswith("http"):
        if "linkedin.com" not in linkedin:
            contact["linkedin_url"] = f"https://www.linkedin.com/in/{linkedin}"
        else:
            contact["linkedin_url"] = f"https://{linkedin}"
    
    # Normalize Twitter handle
    twitter = contact.get("twitter_handle", "")
    if twitter:
        contact["twitter_handle"] = twitter.lstrip("@")
    
    return contact

def count_populated_fields(contact: Dict[str, Any]) -> int:
    """Count populated fields"""
    exclude = {"id", "created_at", "updated_at", "source", "workspace_id"}
    return sum(
        1 for k, v in contact.items()
        if k not in exclude and v and str(v).strip()
    )

def parse_csv_content(content: str) -> tuple[List[str], List[Dict[str, str]]]:
    """Parse CSV content and return headers and rows"""
    # Try to detect delimiter
    sample = content[:2048]
    sniffer = csv.Sniffer()
    
    try:
        dialect = sniffer.sniff(sample, delimiters=',;\t|')
    except csv.Error:
        dialect = csv.excel  # Default to comma-separated
    
    reader = csv.DictReader(io.StringIO(content), dialect=dialect)
    headers = reader.fieldnames or []
    rows = list(reader)
    
    return headers, rows

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/health")
async def csv_import_health():
    """CSV import router health check"""
    return {
        "status": "ok",
        "service": "csv-import",
        "version": "1.0",
        "supported_formats": ["google", "outlook", "generic"],
        "features": [
            "auto-format-detection",
            "preview-before-import",
            "duplicate-detection",
            "field-mapping-display"
        ]
    }

@router.get("/supported-formats", response_model=SupportedFormatsResponse)
async def get_supported_formats():
    """Get list of supported CSV formats with their field mappings"""
    return SupportedFormatsResponse(
        formats=[
            {
                "name": "google",
                "display_name": "Google Contacts Export",
                "description": "CSV exported from Google Contacts (contacts.google.com)",
                "field_count": len(GOOGLE_CONTACTS_MAPPING),
                "sample_headers": list(GOOGLE_CONTACTS_MAPPING.keys())[:5]
            },
            {
                "name": "outlook",
                "display_name": "Microsoft Outlook Export",
                "description": "CSV exported from Outlook or Microsoft 365 Contacts",
                "field_count": len(OUTLOOK_CSV_MAPPING),
                "sample_headers": list(OUTLOOK_CSV_MAPPING.keys())[:5]
            },
            {
                "name": "generic",
                "display_name": "Generic CSV",
                "description": "Any CSV with common field names (email, first_name, company, etc.)",
                "field_count": len(GENERIC_CSV_MAPPING),
                "sample_headers": ["email", "first_name", "last_name", "company", "title"]
            }
        ]
    )

@router.post("/preview", response_model=CSVPreviewResponse)
async def preview_csv(
    file: UploadFile = File(..., description="CSV file to preview")
):
    """Preview CSV file and show detected format and field mapping"""
    try:
        # Read file content
        content = await file.read()
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1")  # Fallback encoding
        
        # Parse CSV
        headers, rows = parse_csv_content(text)
        
        if not headers:
            raise HTTPException(status_code=400, detail="Could not parse CSV headers")
        
        # Detect format
        csv_format = detect_csv_format(headers)
        mapping = get_field_mapping(csv_format)
        
        # Determine mapped vs unmapped fields
        mapped_fields = {}
        unmapped_fields = []
        
        for header in headers:
            if csv_format == "generic":
                normalized = normalize_header(header)
                if normalized in mapping:
                    mapped_fields[header] = mapping[normalized]
                else:
                    unmapped_fields.append(header)
            else:
                if header in mapping:
                    mapped_fields[header] = mapping[header]
                else:
                    unmapped_fields.append(header)
        
        # Sample rows (first 5)
        sample_rows = rows[:5]
        
        return CSVPreviewResponse(
            success=True,
            detected_format=csv_format,
            total_rows=len(rows),
            headers=headers,
            mapped_fields=mapped_fields,
            unmapped_fields=unmapped_fields,
            sample_rows=sample_rows
        )
        
    except Exception as e:
        logger.error(f"CSV preview error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/import", response_model=ImportResponse)
async def import_csv(
    file: UploadFile = File(..., description="CSV file to import"),
    workspace_id: Optional[str] = Form(default=None, description="Workspace UUID"),
    skip_duplicates: bool = Form(default=True, description="Skip existing contacts by email"),
    force_format: Optional[str] = Form(default=None, description="Force specific format: google, outlook, generic")
):
    """Import contacts from CSV file"""
    try:
        # Read file content
        content = await file.read()
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1")
        
        # Parse CSV
        headers, rows = parse_csv_content(text)
        
        if not headers:
            raise HTTPException(status_code=400, detail="Could not parse CSV headers")
        
        if not rows:
            return ImportResponse(
                success=True,
                message="CSV file is empty",
                imported=0,
                total=0,
                contacts=[]
            )
        
        # Detect or use forced format
        csv_format = force_format if force_format in ["google", "outlook", "generic"] else detect_csv_format(headers)
        mapping = get_field_mapping(csv_format)
        
        logger.info(f"Importing {len(rows)} rows from {csv_format} format CSV")
        
        supabase = get_supabase()
        
        imported_contacts: List[ImportedContact] = []
        duplicates_skipped = 0
        failed = 0
        no_email = 0
        total_fields = 0
        
        for row in rows:
            try:
                # Map row to contact
                mapped = map_csv_row_to_contact(row, mapping, csv_format)
                email = mapped.get("email")
                
                if not email:
                    no_email += 1
                    continue
                
                # Check duplicates
                if skip_duplicates:
                    existing = supabase.table("contacts").select("id").eq("email", email).execute()
                    if existing.data and len(existing.data) > 0:
                        duplicates_skipped += 1
                        imported_contacts.append(ImportedContact(
                            contact_id=existing.data[0]["id"],
                            email=email,
                            first_name=mapped.get("first_name"),
                            last_name=mapped.get("last_name"),
                            company=mapped.get("company"),
                            title=mapped.get("title"),
                            fields_populated=0,
                            status="duplicate_skipped"
                        ))
                        continue
                
                # Create contact
                contact_id = str(uuid.uuid4())
                mapped["id"] = contact_id
                mapped["workspace_id"] = workspace_id if workspace_id else None
                
                fields_count = count_populated_fields(mapped)
                total_fields += fields_count
                
                result = supabase.table("contacts").insert(mapped).execute()
                
                if result.data:
                    imported_contacts.append(ImportedContact(
                        contact_id=contact_id,
                        email=email,
                        first_name=mapped.get("first_name"),
                        last_name=mapped.get("last_name"),
                        company=mapped.get("company"),
                        title=mapped.get("title"),
                        fields_populated=fields_count,
                        status="success"
                    ))
                else:
                    failed += 1
                    
            except Exception as e:
                logger.error(f"Error importing row: {str(e)}")
                failed += 1
                continue
        
        imported_count = len([c for c in imported_contacts if c.status == "success"])
        avg_fields = total_fields / imported_count if imported_count > 0 else 0.0
        
        return ImportResponse(
            success=True,
            message=f"Imported {imported_count} contacts from {csv_format} CSV with avg {avg_fields:.1f} fields",
            imported=imported_count,
            total=len(rows),
            duplicates_skipped=duplicates_skipped,
            failed=failed,
            no_email=no_email,
            total_fields_populated=total_fields,
            avg_fields_per_contact=round(avg_fields, 1),
            detected_format=csv_format,
            contacts=imported_contacts
        )
        
    except Exception as e:
        logger.error(f"CSV import error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

logger.info("CSV import router loaded (v1.0 - Google, Outlook, Generic support)")
