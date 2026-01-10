# ============================================================================
# FILE: backend/app/routers/import_router.py
# PURPOSE: CSV import with auto-enrich option
# ============================================================================

import os
import csv
import io
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from supabase import create_client
import jwt

router = APIRouter(prefix="/import", tags=["Import"])

# Supabase
supabase = None
def get_supabase():
    global supabase
    if supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        if url and key:
            supabase = create_client(url, key)
    return supabase

# Auth
async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization")
    try:
        token = authorization.split(" ", 1)[1]
        payload = jwt.decode(token, options={"verify_signature": False})
        return {"id": payload.get("sub"), "email": payload.get("email", "")}
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

# Column mapping presets
COLUMN_MAPPINGS = {
    "default": {
        "first_name": ["first_name", "firstname", "first name", "first"],
        "last_name": ["last_name", "lastname", "last name", "last", "surname"],
        "email": ["email", "email_address", "e-mail", "mail"],
        "phone": ["phone", "phone_number", "telephone", "mobile", "cell"],
        "company": ["company", "company_name", "organization", "org"],
        "title": ["title", "job_title", "position", "role"],
        "linkedin_url": ["linkedin", "linkedin_url", "linkedin_profile"],
        "website": ["website", "url", "company_website"],
    }
}

def map_columns(headers: List[str]) -> dict:
    """Map CSV headers to contact fields."""
    mapping = {}
    headers_lower = [h.lower().strip() for h in headers]
    
    for field, aliases in COLUMN_MAPPINGS["default"].items():
        for i, header in enumerate(headers_lower):
            if header in aliases:
                mapping[field] = i
                break
    
    return mapping

async def enrich_contact_background(contact_id: str, token: str):
    """Background task to enrich a contact."""
    import urllib.request
    import json
    
    API_BASE = os.getenv("API_BASE_URL", "https://latticeiq-backend.onrender.com")
    
    try:
        req = urllib.request.Request(
            f"{API_BASE}/api/v3/enrichment/quick-enrich/{contact_id}",
            method="POST",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=60):
            pass
    except Exception as e:
        print(f"Background enrich failed for {contact_id}: {e}")

@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    auto_enrich: bool = Form(False),
    skip_duplicates: bool = Form(True),
    background_tasks: BackgroundTasks = None,
    user: dict = Depends(get_current_user),
    authorization: str = Header(None)
):
    """Import contacts from CSV file."""
    
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Read CSV
    try:
        content = await file.read()
        text = content.decode('utf-8-sig')  # Handle BOM
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
    
    if len(rows) < 2:
        raise HTTPException(status_code=400, detail="CSV must have header row and at least one data row")
    
    headers = rows[0]
    data_rows = rows[1:]
    
    # Map columns
    mapping = map_columns(headers)
    
    if "email" not in mapping:
        raise HTTPException(status_code=400, detail="CSV must have an email column")
    
    # Get existing emails if skip_duplicates
    existing_emails = set()
    if skip_duplicates:
        result = client.table("contacts").select("email").execute()
        existing_emails = {c["email"].lower() for c in (result.data or []) if c.get("email")}
    
    # Process rows
    now = datetime.now(timezone.utc).isoformat()
    imported = []
    skipped = 0
    errors = []
    
    for i, row in enumerate(data_rows):
        try:
            email_idx = mapping["email"]
            if email_idx >= len(row):
                continue
            
            email = row[email_idx].strip().lower()
            if not email or "@" not in email:
                continue
            
            if skip_duplicates and email in existing_emails:
                skipped += 1
                continue
            
            # Build contact
            contact = {
                "email": email,
                "user_id": user["id"],
                "created_at": now,
                "updated_at": now,
                "enrichment_status": "pending",
                "pipeline_stage": "new"
            }
            
            for field, idx in mapping.items():
                if field != "email" and idx < len(row):
                    value = row[idx].strip()
                    if value:
                        contact[field] = value
            
            # Insert
            result = client.table("contacts").insert(contact).execute()
            
            if result.data:
                imported.append(result.data[0])
                existing_emails.add(email)
                
        except Exception as e:
            errors.append({"row": i + 2, "error": str(e)})
    
    # Queue auto-enrichment if requested
    enrichment_queued = 0
    if auto_enrich and imported and background_tasks:
        token = authorization.split(" ", 1)[1] if authorization else None
        for contact in imported[:50]:  # Limit to 50 for auto-enrich
            background_tasks.add_task(enrich_contact_background, contact["id"], token)
            enrichment_queued += 1
    
    return {
        "status": "completed",
        "imported": len(imported),
        "skipped": skipped,
        "errors": len(errors),
        "error_details": errors[:10],  # First 10 errors
        "auto_enrich_queued": enrichment_queued,
        "column_mapping": {k: headers[v] for k, v in mapping.items()}
    }

@router.get("/templates")
async def get_import_templates():
    """Get CSV template information."""
    return {
        "required_columns": ["email"],
        "optional_columns": ["first_name", "last_name", "phone", "company", "title", "linkedin_url", "website"],
        "sample_csv": "first_name,last_name,email,company,title\nJohn,Smith,john@acme.com,Acme Inc,CEO\nJane,Doe,jane@example.com,Example Corp,VP Sales"
    }

@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Preview CSV import without importing."""
    
    try:
        content = await file.read()
        text = content.decode('utf-8-sig')
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
    
    if len(rows) < 1:
        raise HTTPException(status_code=400, detail="CSV is empty")
    
    headers = rows[0]
    mapping = map_columns(headers)
    
    # Preview first 5 rows
    preview = []
    for row in rows[1:6]:
        contact = {}
        for field, idx in mapping.items():
            if idx < len(row):
                contact[field] = row[idx].strip()
        preview.append(contact)
    
    return {
        "headers": headers,
        "column_mapping": {k: headers[v] for k, v in mapping.items()},
        "unmapped_columns": [h for i, h in enumerate(headers) if i not in mapping.values()],
        "total_rows": len(rows) - 1,
        "preview": preview
    }
