# backend/app/routers/crm_export_csv.py
"""
CSV Export Router
Export contacts to CSV format compatible with Google Contacts and Outlook
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging
import uuid
import os
import csv
import io
from datetime import datetime
from supabase import create_client, Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export/csv", tags=["crm-export", "csv"])

def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(url, key)

# Google Contacts CSV format
GOOGLE_CONTACTS_HEADERS = [
    "Name", "Given Name", "Family Name", "E-mail 1 - Type", "E-mail 1 - Value",
    "Phone 1 - Type", "Phone 1 - Value", "Organization 1 - Name", "Organization 1 - Title",
    "Website 1 - Value", "Notes"
]

# Outlook CSV format
OUTLOOK_HEADERS = [
    "First Name", "Last Name", "E-mail Address", "Business Phone", "Mobile Phone",
    "Company", "Job Title", "Web Page", "Notes"
]

class CSVExportRequest(BaseModel):
    contact_id: str
    format: str = Field(default="google_contacts", description="google_contacts, outlook, or generic")

class CSVBulkExportRequest(BaseModel):
    contact_ids: List[str] = Field(..., max_length=10000)
    format: str = Field(default="google_contacts")
    include_enrichment: bool = True
    include_scores: bool = True

class CSVExportResponse(BaseModel):
    success: bool
    message: str
    download_url: Optional[str] = None
    row_count: int = 0

def contact_to_google_row(contact: Dict[str, Any]) -> List[str]:
    """Convert contact to Google Contacts CSV row"""
    first = contact.get("first_name", "")
    last = contact.get("last_name", "")
    name = f"{first} {last}".strip()
    
    notes = []
    if contact.get("linkedin_url"):
        notes.append(f"LinkedIn: {contact['linkedin_url']}")
    if contact.get("composite_score"):
        notes.append(f"Score: {contact['composite_score']}")
    
    return [
        name,
        first,
        last,
        "Work",
        contact.get("email", ""),
        "Work",
        contact.get("phone", ""),
        contact.get("company", ""),
        contact.get("title", ""),
        contact.get("website", ""),
        " | ".join(notes)
    ]

def contact_to_outlook_row(contact: Dict[str, Any]) -> List[str]:
    """Convert contact to Outlook CSV row"""
    notes = []
    if contact.get("linkedin_url"):
        notes.append(f"LinkedIn: {contact['linkedin_url']}")
    
    return [
        contact.get("first_name", ""),
        contact.get("last_name", ""),
        contact.get("email", ""),
        contact.get("phone", ""),
        contact.get("mobile_phone", ""),
        contact.get("company", ""),
        contact.get("title", ""),
        contact.get("website", ""),
        " | ".join(notes)
    ]

def generate_csv(contacts: List[Dict[str, Any]], format: str) -> str:
    """Generate CSV string from contacts"""
    output = io.StringIO()
    
    if format == "google_contacts":
        headers = GOOGLE_CONTACTS_HEADERS
        row_func = contact_to_google_row
    elif format == "outlook":
        headers = OUTLOOK_HEADERS
        row_func = contact_to_outlook_row
    else:  # generic
        headers = ["first_name", "last_name", "email", "phone", "company", "title", "linkedin_url"]
        row_func = lambda c: [c.get(h, "") for h in headers]
    
    writer = csv.writer(output)
    writer.writerow(headers)
    
    for contact in contacts:
        writer.writerow(row_func(contact))
    
    return output.getvalue()

@router.get("/health")
async def csv_export_health():
    return {
        "status": "ok",
        "service": "csv_export",
        "version": "1.0",
        "formats": ["google_contacts", "outlook", "generic"]
    }

@router.get("/formats")
async def get_csv_formats():
    """Get available CSV export formats"""
    return {
        "formats": [
            {
                "id": "google_contacts",
                "name": "Google Contacts",
                "description": "Compatible with Google Contacts import",
                "headers": GOOGLE_CONTACTS_HEADERS
            },
            {
                "id": "outlook",
                "name": "Microsoft Outlook",
                "description": "Compatible with Outlook/Microsoft 365 import",
                "headers": OUTLOOK_HEADERS
            },
            {
                "id": "generic",
                "name": "Generic CSV",
                "description": "Simple CSV with standard field names",
                "headers": ["first_name", "last_name", "email", "phone", "company", "title", "linkedin_url"]
            }
        ]
    }

@router.post("/")
async def export_single_to_csv(request: CSVExportRequest):
    """Export single contact to CSV"""
    try:
        supabase = get_supabase()
        result = supabase.table("contacts").select("*").eq("id", request.contact_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        csv_content = generate_csv(result.data, request.format)
        
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=contact_{request.contact_id}.csv"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CSV export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk")
async def bulk_export_to_csv(request: CSVBulkExportRequest):
    """Export multiple contacts to CSV"""
    try:
        supabase = get_supabase()
        
        # Fetch all contacts
        result = supabase.table("contacts").select("*").in_("id", request.contact_ids).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="No contacts found")
        
        csv_content = generate_csv(result.data, request.format)
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"contacts_export_{timestamp}.csv"
        
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk CSV export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

logger.info("CSV Export router loaded (Google Contacts, Outlook, Generic)")
