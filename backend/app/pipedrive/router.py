# backend/app/pipedrive/router.py
# COMPREHENSIVE VERSION v1.0 - Maximum field extraction from Pipedrive

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import aiohttp
import logging
import uuid
import os
from datetime import datetime
from supabase import create_client, Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipedrive", tags=["pipedrive"])

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
# PIPEDRIVE FIELD MAPPING
# ============================================================================

# Pipedrive Person fields (contacts)
PIPEDRIVE_PERSON_FIELDS = [
    "id",
    "name",
    "first_name",
    "last_name",
    "email",           # Array of {value, primary, label}
    "phone",           # Array of {value, primary, label}
    "org_id",          # Related organization
    "org_name",
    "job_title",       # Maps to our `title`
    "owner_id",
    "visible_to",
    "label",
    "picture_id",
    "marketing_status",
    "postal_address",
    "postal_address_subpremise",
    "postal_address_street_number",
    "postal_address_route",
    "postal_address_sublocality",
    "postal_address_locality",
    "postal_address_admin_area_level_1",
    "postal_address_admin_area_level_2",
    "postal_address_country",
    "postal_address_postal_code",
    "postal_address_formatted_address",
    "notes",
    "birthday",
    "add_time",
    "update_time",
    "last_activity_date",
    "next_activity_date",
    "open_deals_count",
    "closed_deals_count",
    "won_deals_count",
    "lost_deals_count",
    "activities_count",
    "done_activities_count",
    "undone_activities_count",
    "files_count",
    "followers_count",
]

# Pipedrive Organization fields (companies)
PIPEDRIVE_ORG_FIELDS = [
    "id",
    "name",
    "owner_id",
    "address",
    "address_subpremise",
    "address_street_number",
    "address_route",
    "address_sublocality",
    "address_locality",
    "address_admin_area_level_1",
    "address_admin_area_level_2",
    "address_country",
    "address_postal_code",
    "address_formatted_address",
    "people_count",
    "open_deals_count",
    "add_time",
    "update_time",
]

# Map Pipedrive fields to our database schema
FIELD_MAPPING = {
    # Person fields
    "first_name": "first_name",
    "last_name": "last_name",
    "job_title": "title",  # Pipedrive uses job_title
    "org_name": "company",
    "birthday": "birthday",
    "notes": "notes",
    "last_activity_date": "last_activity_at",
    
    # Address fields
    "postal_address_locality": "city",
    "postal_address_admin_area_level_1": "state",
    "postal_address_country": "country",
    "postal_address_postal_code": "postal_code",
    "postal_address_route": "street_address",
    "postal_address_formatted_address": "location",
}

# ============================================================================
# REQUEST MODELS
# ============================================================================

class TestConnectionRequest(BaseModel):
    api_token: str = Field(..., min_length=10, description="Pipedrive API Token")
    company_domain: Optional[str] = Field(default=None, description="Company domain (e.g., yourcompany for yourcompany.pipedrive.com)")

class ImportRequest(BaseModel):
    api_token: str = Field(..., min_length=10, description="Pipedrive API Token")
    company_domain: Optional[str] = Field(default=None, description="Company domain")
    batch_size: int = Field(default=50, ge=1, le=500, description="Number of contacts to import")
    workspace_id: Optional[str] = Field(default=None, description="Workspace UUID")
    skip_duplicates: bool = Field(default=True, description="Skip existing contacts by email")
    include_organizations: bool = Field(default=True, description="Fetch related org data")

# ============================================================================
# RESPONSE MODELS
# ============================================================================

class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    person_count: int = 0
    org_count: int = 0
    company_name: Optional[str] = None

class ImportedContact(BaseModel):
    contact_id: str
    pipedrive_id: str
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
    total_fields_populated: int = 0
    avg_fields_per_contact: float = 0.0
    contacts: List[ImportedContact] = []

class FieldMappingResponse(BaseModel):
    person_fields: List[str]
    org_fields: List[str]
    field_mapping: Dict[str, str]

# ============================================================================
# PIPEDRIVE API FUNCTIONS
# ============================================================================

def get_pipedrive_base_url(company_domain: Optional[str] = None) -> str:
    """Get Pipedrive API base URL"""
    if company_domain:
        return f"https://{company_domain}.pipedrive.com/api/v1"
    return "https://api.pipedrive.com/v1"

async def test_pipedrive_connection(request: TestConnectionRequest) -> Dict[str, Any]:
    """Test Pipedrive connection"""
    base_url = get_pipedrive_base_url(request.company_domain)
    
    async with aiohttp.ClientSession() as session:
        # Get user/company info
        async with session.get(
            f"{base_url}/users/me",
            params={"api_token": request.api_token}
        ) as resp:
            if resp.status == 401:
                raise Exception("Invalid API token")
            if resp.status != 200:
                text = await resp.text()
                raise Exception(f"Pipedrive API error: {resp.status} - {text}")
            user_data = await resp.json()
            
            if not user_data.get("success"):
                raise Exception(user_data.get("error", "Unknown error"))
            
            company_name = user_data.get("data", {}).get("company_name")
        
        # Count persons
        async with session.get(
            f"{base_url}/persons",
            params={"api_token": request.api_token, "limit": 1}
        ) as resp:
            person_count = 0
            if resp.status == 200:
                data = await resp.json()
                if data.get("additional_data"):
                    person_count = data["additional_data"].get("pagination", {}).get("total_count", 0)
        
        # Count organizations
        async with session.get(
            f"{base_url}/organizations",
            params={"api_token": request.api_token, "limit": 1}
        ) as resp:
            org_count = 0
            if resp.status == 200:
                data = await resp.json()
                if data.get("additional_data"):
                    org_count = data["additional_data"].get("pagination", {}).get("total_count", 0)
        
        return {
            "company_name": company_name,
            "person_count": person_count,
            "org_count": org_count
        }

async def fetch_pipedrive_persons(
    request: ImportRequest,
    batch_size: int = 50
) -> List[Dict[str, Any]]:
    """Fetch persons from Pipedrive"""
    base_url = get_pipedrive_base_url(request.company_domain)
    all_persons: List[Dict[str, Any]] = []
    start = 0
    
    async with aiohttp.ClientSession() as session:
        while len(all_persons) < batch_size:
            fetch_limit = min(batch_size - len(all_persons), 100)
            
            async with session.get(
                f"{base_url}/persons",
                params={
                    "api_token": request.api_token,
                    "limit": fetch_limit,
                    "start": start
                }
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"Failed to fetch persons: {resp.status} - {text}")
                
                data = await resp.json()
                
                if not data.get("success"):
                    raise Exception(data.get("error", "Unknown error"))
                
                persons = data.get("data") or []
                if not persons:
                    break
                
                all_persons.extend(persons)
                
                # Check if more pages
                pagination = data.get("additional_data", {}).get("pagination", {})
                if not pagination.get("more_items_in_collection"):
                    break
                
                start = pagination.get("next_start", start + fetch_limit)
    
    logger.info(f"Fetched {len(all_persons)} persons from Pipedrive")
    return all_persons[:batch_size]

def extract_primary_email(email_field: Any) -> Optional[str]:
    """Extract primary email from Pipedrive email array"""
    if not email_field:
        return None
    
    if isinstance(email_field, str):
        return email_field
    
    if isinstance(email_field, list):
        # Find primary email
        for e in email_field:
            if isinstance(e, dict) and e.get("primary"):
                return e.get("value")
        # Fallback to first email
        for e in email_field:
            if isinstance(e, dict) and e.get("value"):
                return e.get("value")
    
    return None

def extract_primary_phone(phone_field: Any) -> Optional[str]:
    """Extract primary phone from Pipedrive phone array"""
    if not phone_field:
        return None
    
    if isinstance(phone_field, str):
        return phone_field
    
    if isinstance(phone_field, list):
        for p in phone_field:
            if isinstance(p, dict) and p.get("primary"):
                return p.get("value")
        for p in phone_field:
            if isinstance(p, dict) and p.get("value"):
                return p.get("value")
    
    return None

def map_pipedrive_to_contact(person: Dict[str, Any]) -> Dict[str, Any]:
    """Map Pipedrive person to our schema"""
    contact = {
        "pipedrive_id": str(person.get("id", "")),
        "source": "pipedrive",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    # Extract email and phone (special handling for arrays)
    email = extract_primary_email(person.get("email"))
    if email:
        contact["email"] = email
    
    phone = extract_primary_phone(person.get("phone"))
    if phone:
        contact["phone"] = phone
    
    # Map direct fields
    for pd_field, our_field in FIELD_MAPPING.items():
        value = person.get(pd_field)
        if value and str(value).strip():
            contact[our_field] = str(value).strip()
    
    # Handle name parsing if first_name/last_name not present
    if not contact.get("first_name") and not contact.get("last_name"):
        full_name = person.get("name", "")
        if full_name:
            parts = full_name.split(" ", 1)
            contact["first_name"] = parts[0]
            if len(parts) > 1:
                contact["last_name"] = parts[1]
    
    # Organization data
    org_name = person.get("org_name")
    if org_name:
        contact["company"] = org_name
    elif person.get("org_id") and isinstance(person.get("org_id"), dict):
        contact["company"] = person["org_id"].get("name", "")
    
    # Build location from address parts
    city = person.get("postal_address_locality")
    state = person.get("postal_address_admin_area_level_1")
    country = person.get("postal_address_country")
    
    if city:
        contact["city"] = city
    if state:
        contact["state"] = state
    if country:
        contact["country"] = country
    if person.get("postal_address_postal_code"):
        contact["postal_code"] = person["postal_address_postal_code"]
    
    # Formatted address as location
    if person.get("postal_address_formatted_address"):
        contact["location"] = person["postal_address_formatted_address"]
    elif city or state or country:
        parts = [p for p in [city, state, country] if p]
        contact["location"] = ", ".join(parts)
    
    return contact

def count_populated_fields(contact: Dict[str, Any]) -> int:
    """Count populated fields"""
    exclude = {"id", "created_at", "updated_at", "source", "pipedrive_id", "workspace_id"}
    return sum(
        1 for k, v in contact.items()
        if k not in exclude and v and str(v).strip()
    )

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/health")
async def pipedrive_health():
    """Pipedrive router health check"""
    return {
        "status": "ok",
        "service": "pipedrive",
        "version": "1.0",
        "features": [
            "test-connection",
            "import-batch",
            "email-phone-array-handling",
            "organization-linking"
        ],
        "person_fields": len(PIPEDRIVE_PERSON_FIELDS),
        "org_fields": len(PIPEDRIVE_ORG_FIELDS)
    }

@router.get("/field-mapping", response_model=FieldMappingResponse)
async def get_field_mapping():
    """Get Pipedrive to LatticeIQ field mapping"""
    return FieldMappingResponse(
        person_fields=PIPEDRIVE_PERSON_FIELDS,
        org_fields=PIPEDRIVE_ORG_FIELDS,
        field_mapping=FIELD_MAPPING
    )

@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(request: TestConnectionRequest):
    """Test Pipedrive connection"""
    try:
        logger.info("Testing Pipedrive connection...")
        result = await test_pipedrive_connection(request)
        
        return TestConnectionResponse(
            success=True,
            message="Connected to Pipedrive successfully!",
            person_count=result.get("person_count", 0),
            org_count=result.get("org_count", 0),
            company_name=result.get("company_name")
        )
    except Exception as e:
        logger.error(f"Pipedrive connection error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/debug-fetch")
async def debug_fetch(request: TestConnectionRequest):
    """Debug: Show raw Pipedrive data"""
    try:
        import_req = ImportRequest(
            api_token=request.api_token,
            company_domain=request.company_domain,
            batch_size=3
        )
        persons = await fetch_pipedrive_persons(import_req, batch_size=3)
        
        return {
            "count": len(persons),
            "sample_persons": persons[:3]
        }
    except Exception as e:
        logger.error(f"Debug fetch error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/import-batch", response_model=ImportResponse)
async def import_batch(request: ImportRequest):
    """Import contacts from Pipedrive"""
    try:
        logger.info(f"Importing {request.batch_size} persons from Pipedrive...")
        
        persons = await fetch_pipedrive_persons(request, request.batch_size)
        
        if not persons:
            return ImportResponse(
                success=True,
                message="No persons found in Pipedrive",
                imported=0,
                total=0,
                contacts=[]
            )
        
        supabase = get_supabase()
        
        imported_contacts: List[ImportedContact] = []
        duplicates_skipped = 0
        failed = 0
        total_fields = 0
        
        for person in persons:
            try:
                email = extract_primary_email(person.get("email"))
                pipedrive_id = str(person.get("id", ""))
                
                if not email:
                    failed += 1
                    continue
                
                # Check duplicates
                if request.skip_duplicates:
                    existing = supabase.table("contacts").select("id").eq("email", email).execute()
                    if existing.data and len(existing.data) > 0:
                        duplicates_skipped += 1
                        imported_contacts.append(ImportedContact(
                            contact_id=existing.data[0]["id"],
                            pipedrive_id=pipedrive_id,
                            email=email,
                            first_name=person.get("first_name"),
                            last_name=person.get("last_name"),
                            company=person.get("org_name"),
                            title=person.get("job_title"),
                            fields_populated=0,
                            status="duplicate_skipped"
                        ))
                        continue
                
                # Map to our schema
                contact_id = str(uuid.uuid4())
                mapped = map_pipedrive_to_contact(person)
                mapped["id"] = contact_id
                mapped["workspace_id"] = request.workspace_id if request.workspace_id else None
                
                fields_count = count_populated_fields(mapped)
                total_fields += fields_count
                
                result = supabase.table("contacts").insert(mapped).execute()
                
                if result.data:
                    imported_contacts.append(ImportedContact(
                        contact_id=contact_id,
                        pipedrive_id=pipedrive_id,
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
                logger.error(f"Error importing person: {str(e)}")
                failed += 1
                continue
        
        imported_count = len([c for c in imported_contacts if c.status == "success"])
        avg_fields = total_fields / imported_count if imported_count > 0 else 0.0
        
        return ImportResponse(
            success=True,
            message=f"Imported {imported_count} contacts with avg {avg_fields:.1f} fields",
            imported=imported_count,
            total=len(persons),
            duplicates_skipped=duplicates_skipped,
            failed=failed,
            total_fields_populated=total_fields,
            avg_fields_per_contact=round(avg_fields, 1),
            contacts=imported_contacts
        )
        
    except Exception as e:
        logger.error(f"Pipedrive import error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

logger.info(f"Pipedrive router loaded (v1.0 - {len(PIPEDRIVE_PERSON_FIELDS)} person fields)")
