# backend/app/hubspot/router.py
# COMPREHENSIVE VERSION v3.1 - Fixed LinkedIn field mapping

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

router = APIRouter(prefix="/hubspot", tags=["hubspot"])

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
# HUBSPOT FIELD MAPPING
# ============================================================================

# All available HubSpot contact properties we want to extract
HUBSPOT_PROPERTIES = [
    # Core identity
    "firstname",
    "lastname",
    "email",
    "hs_additional_emails",
    
    # Phone numbers
    "phone",
    "mobilephone",
    "hs_whatsapp_phone_number",
    "fax",
    
    # Professional info
    "jobtitle",
    "company",
    "department",
    "hs_persona",
    
    # Social & web - ALL LinkedIn variants
    "hs_linkedinid",
    "linkedin_account",        # Custom field (internal name)
    "linkedin_profile_url",    # Custom field (internal name)
    "hs_linkedin_url",         # HubSpot built-in
    "linkedinbio",
    "twitterhandle",
    "website",
    
    # Location
    "city",
    "state",
    "country",
    "zip",
    "address",
    "hs_timezone",
    
    # Company intel
    "industry",
    "company_size",
    "annualrevenue",
    "numemployees",
    
    # Lead/sales info
    "hs_lead_status",
    "lifecyclestage",
    "hs_sales_email_last_replied",
    "notes_last_contacted",
    "hs_buying_role",
    
    # Engagement metrics
    "hs_email_open",
    "hs_email_click",
    "hs_analytics_num_page_views",
    "hs_analytics_num_visits",
    
    # Dates
    "createdate",
    "lastmodifieddate",
    "hs_lastactivitydate",
    "notes_last_updated",
    "date_of_birth",
    
    # Custom/misc
    "message",
    "hs_content_membership_notes",
]

# All possible LinkedIn field names in HubSpot (checked in order of priority)
LINKEDIN_FIELDS = [
    "linkedin_account",        # Custom - highest fill rate (29.81%)
    "hs_linkedin_url",         # HubSpot built-in (9.08%)
    "linkedin_profile_url",    # Custom (6.79%)
    "hs_linkedinid",           # Legacy HubSpot field
    "linkedinbio",             # Fallback
]

# Map HubSpot fields to our database schema (using `title` not `job_title`)
FIELD_MAPPING = {
    # Core fields
    "firstname": "first_name",
    "lastname": "last_name",
    "email": "email",
    "phone": "phone",
    "mobilephone": "mobile_phone",
    "jobtitle": "title",  # Maps to `title` for consistency with Salesforce/models
    "company": "company",
    "department": "department",
    
    # Social/web - LinkedIn handled separately in map function
    "twitterhandle": "twitter_handle",
    "website": "website",
    
    # Location
    "city": "city",
    "state": "state",
    "country": "country",
    "zip": "postal_code",
    "address": "street_address",
    
    # Company intel
    "industry": "industry",
    "company_size": "company_size",
    "annualrevenue": "annual_revenue",
    "numemployees": "employee_count",
    
    # Lead info
    "hs_lead_status": "lead_status",
    "lifecyclestage": "lifecycle_stage",
    "hs_buying_role": "buying_role",
    "hs_persona": "hubspot_persona",
    
    # Engagement
    "hs_analytics_num_page_views": "page_views",
    "hs_analytics_num_visits": "site_visits",
    
    # Dates
    "date_of_birth": "birthday",
    "hs_lastactivitydate": "last_activity_at",
    
    # Notes
    "message": "notes",
}

# ============================================================================
# REQUEST MODELS
# ============================================================================

class TestConnectionRequest(BaseModel):
    api_key: str = Field(..., min_length=10, description="HubSpot Private App Token")

class ImportRequest(BaseModel):
    api_key: str = Field(..., min_length=10, description="HubSpot Private App Token")
    batch_size: int = Field(default=50, ge=1, le=500, description="Number of contacts to import")
    workspace_id: Optional[str] = Field(default=None, description="Workspace UUID for multi-tenant isolation")
    skip_duplicates: bool = Field(default=True, description="Skip contacts that already exist by email")
    include_all_properties: bool = Field(default=True, description="Fetch all available HubSpot properties")

# ============================================================================
# RESPONSE MODELS
# ============================================================================

class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    contact_count: int = 0
    portal_id: Optional[str] = None
    available_properties: int = 0

class ImportedContact(BaseModel):
    contact_id: str
    hubspot_id: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    linkedin_url: Optional[str] = None
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
    hubspot_properties: List[str]
    field_mapping: Dict[str, str]
    linkedin_fields: List[str]
    total_properties: int

# ============================================================================
# HUBSPOT API FUNCTIONS
# ============================================================================

async def test_hubspot_connection(api_key: str) -> Dict[str, Any]:
    """Test the HubSpot API connection and return account info"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    async with aiohttp.ClientSession() as session:
        # Test basic access
        async with session.get(
            "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
            headers=headers
        ) as resp:
            if resp.status == 401:
                raise Exception("Invalid API key - check your HubSpot Private App token")
            if resp.status == 403:
                raise Exception("Access forbidden - ensure your Private App has 'crm.objects.contacts.read' scope")
            if resp.status != 200:
                text = await resp.text()
                raise Exception(f"HubSpot API error: {resp.status} - {text}")
            await resp.json()

        # Get contact count
        async with session.get(
            "https://api.hubapi.com/crm/v3/objects/contacts?limit=0",
            headers=headers
        ) as resp:
            total = 0
            if resp.status == 200:
                count_data = await resp.json()
                total = count_data.get("total", 0)
        
        # Get available properties count
        available_props = 0
        async with session.get(
            "https://api.hubapi.com/crm/v3/properties/contacts",
            headers=headers
        ) as resp:
            if resp.status == 200:
                props_data = await resp.json()
                available_props = len(props_data.get("results", []))
                
        return {
            "authenticated": True, 
            "contact_count": total,
            "available_properties": available_props
        }

async def fetch_hubspot_contacts(
    api_key: str, 
    batch_size: int = 50,
    include_all_properties: bool = True
) -> List[Dict[str, Any]]:
    """Fetch contacts from HubSpot API with ALL available properties"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    all_contacts: List[Dict[str, Any]] = []
    after: Optional[str] = None
    remaining = batch_size
    
    # Use comprehensive property list or basic
    properties = HUBSPOT_PROPERTIES if include_all_properties else [
        "firstname", "lastname", "email", "company", "phone", "jobtitle"
    ]
    
    async with aiohttp.ClientSession() as session:
        while remaining > 0:
            fetch_count = min(remaining, 100)
            
            url = "https://api.hubapi.com/crm/v3/objects/contacts"
            params: Dict[str, Any] = {
                "limit": fetch_count,
                "properties": ",".join(properties)
            }
            if after:
                params["after"] = after
            
            async with session.get(url, headers=headers, params=params) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"Failed to fetch contacts: {resp.status} - {text}")
                
                data = await resp.json()
                contacts = data.get("results", [])
                
                logger.info(f"Fetched {len(contacts)} contacts from HubSpot")
                if contacts:
                    sample_props = contacts[0].get("properties", {})
                    populated = sum(1 for v in sample_props.values() if v)
                    logger.info(f"Sample contact has {populated} populated fields")
                
                all_contacts.extend(contacts)
                remaining -= len(contacts)
                
                paging = data.get("paging", {})
                next_link = paging.get("next", {})
                after = next_link.get("after") if next_link else None
                
                if not after or len(contacts) == 0:
                    break
    
    return all_contacts[:batch_size]


def extract_linkedin_url(props: Dict[str, Any]) -> Optional[str]:
    """
    Extract LinkedIn URL from any of the possible HubSpot LinkedIn fields.
    Checks all variants and returns the first non-empty value, normalized to a full URL.
    """
    linkedin = None
    source_field = None
    
    # Check each LinkedIn field in priority order
    for field in LINKEDIN_FIELDS:
        value = props.get(field)
        if value and str(value).strip():
            linkedin = str(value).strip()
            source_field = field
            logger.debug(f"Found LinkedIn in '{field}': {linkedin[:50]}...")
            break
    
    if not linkedin:
        return None
    
    # Normalize to full URL
    if not linkedin.startswith("http"):
        if "linkedin.com" in linkedin:
            linkedin = f"https://{linkedin}"
        else:
            # Just a username/slug
            linkedin = f"https://www.linkedin.com/in/{linkedin}"
    
    # Ensure https
    if linkedin.startswith("http://"):
        linkedin = linkedin.replace("http://", "https://")
    
    logger.info(f"Extracted LinkedIn URL from '{source_field}': {linkedin}")
    return linkedin


def map_hubspot_to_contact(props: Dict[str, Any], hubspot_id: str) -> Dict[str, Any]:
    """Map HubSpot properties to our contact schema with maximum data extraction"""
    
    contact = {
        "hubspot_id": hubspot_id,
        "source": "hubspot",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    # Apply field mapping
    for hs_field, our_field in FIELD_MAPPING.items():
        value = props.get(hs_field)
        if value and str(value).strip():
            contact[our_field] = str(value).strip()
    
    # Handle LinkedIn URL - check ALL possible fields
    linkedin_url = extract_linkedin_url(props)
    if linkedin_url:
        contact["linkedin_url"] = linkedin_url
    
    # Twitter handle normalization (remove @)
    twitter = props.get("twitterhandle") or ""
    if twitter:
        contact["twitter_handle"] = str(twitter).lstrip("@").strip()
    
    # Annual revenue - convert to integer if possible
    revenue = props.get("annualrevenue")
    if revenue:
        try:
            contact["annual_revenue"] = int(float(revenue))
        except (ValueError, TypeError):
            contact["annual_revenue"] = str(revenue)
    
    # Employee count
    employees = props.get("numemployees") or props.get("company_size")
    if employees:
        contact["employee_count"] = str(employees)
    
    # Location fields
    city = props.get("city")
    state = props.get("state")
    country = props.get("country")
    
    if city:
        contact["city"] = str(city).strip()
    if state:
        contact["state"] = str(state).strip()
    if country:
        contact["country"] = str(country).strip()
    if props.get("zip"):
        contact["postal_code"] = str(props["zip"]).strip()
    if props.get("address"):
        contact["street_address"] = str(props["address"]).strip()
    
    # Build combined location string for easy display
    location_parts = [p for p in [city, state, country] if p]
    if location_parts:
        contact["location"] = ", ".join(str(p).strip() for p in location_parts)
    
    return contact

def count_populated_fields(contact: Dict[str, Any]) -> int:
    """Count how many fields have values"""
    exclude = {"id", "created_at", "updated_at", "source", "hubspot_id", "workspace_id"}
    return sum(
        1 for k, v in contact.items() 
        if k not in exclude and v and str(v).strip()
    )

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/health")
async def hubspot_health():
    """HubSpot router health check"""
    return {
        "status": "ok",
        "service": "hubspot",
        "version": "3.1",
        "features": [
            "test-connection",
            "import-batch",
            "comprehensive-field-mapping",
            "multi-linkedin-field-support",
            "debug-fetch",
            "field-mapping"
        ],
        "properties_tracked": len(HUBSPOT_PROPERTIES),
        "linkedin_fields_checked": len(LINKEDIN_FIELDS),
        "field_mapping_count": len(FIELD_MAPPING)
    }

@router.get("/field-mapping", response_model=FieldMappingResponse)
async def get_field_mapping():
    """Get the HubSpot to LatticeIQ field mapping reference"""
    return FieldMappingResponse(
        hubspot_properties=HUBSPOT_PROPERTIES,
        field_mapping=FIELD_MAPPING,
        linkedin_fields=LINKEDIN_FIELDS,
        total_properties=len(HUBSPOT_PROPERTIES)
    )

@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(request: TestConnectionRequest):
    """Test HubSpot API connection."""
    try:
        logger.info("Testing HubSpot connection...")
        result = await test_hubspot_connection(request.api_key)
        
        return TestConnectionResponse(
            success=True,
            message="Connected to HubSpot successfully!",
            contact_count=result.get("contact_count", 0),
            available_properties=result.get("available_properties", 0)
        )
    except Exception as e:
        logger.error(f"HubSpot connection error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/debug-fetch")
async def debug_fetch(request: TestConnectionRequest):
    """Debug: Show raw HubSpot contact data with all properties and field coverage"""
    try:
        contacts = await fetch_hubspot_contacts(
            request.api_key, 
            batch_size=5,
            include_all_properties=True
        )
        
        # Analyze which fields have data across sample
        field_coverage = {}
        linkedin_analysis = []
        
        for contact in contacts:
            props = contact.get("properties", {})
            
            # Track LinkedIn fields specifically
            contact_linkedin = {}
            for lf in LINKEDIN_FIELDS:
                val = props.get(lf)
                contact_linkedin[lf] = val if val else None
            linkedin_analysis.append({
                "email": props.get("email"),
                "linkedin_fields": contact_linkedin,
                "extracted_url": extract_linkedin_url(props)
            })
            
            for key, value in props.items():
                if key not in field_coverage:
                    field_coverage[key] = {"has_value": 0, "empty": 0, "sample_value": None}
                if value and str(value).strip():
                    field_coverage[key]["has_value"] += 1
                    if field_coverage[key]["sample_value"] is None:
                        field_coverage[key]["sample_value"] = str(value)[:100]
                else:
                    field_coverage[key]["empty"] += 1
        
        # Sort by fields that have data
        sorted_coverage = dict(sorted(
            field_coverage.items(), 
            key=lambda x: x[1]["has_value"], 
            reverse=True
        ))
        
        return {
            "count": len(contacts),
            "properties_requested": len(HUBSPOT_PROPERTIES),
            "linkedin_fields_checked": LINKEDIN_FIELDS,
            "linkedin_analysis": linkedin_analysis,
            "field_coverage": sorted_coverage,
            "sample_contacts": contacts[:3],
            "mapping_preview": FIELD_MAPPING
        }
    except Exception as e:
        logger.error(f"Debug fetch error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/import-batch", response_model=ImportResponse)
async def import_batch(request: ImportRequest):
    """Import contacts from HubSpot with comprehensive field mapping."""
    try:
        logger.info(f"Importing {request.batch_size} contacts from HubSpot (comprehensive mode={request.include_all_properties})...")
        
        # Fetch contacts with all properties
        hubspot_contacts = await fetch_hubspot_contacts(
            request.api_key, 
            request.batch_size,
            include_all_properties=request.include_all_properties
        )
        
        if not hubspot_contacts:
            return ImportResponse(
                success=True,
                message="No contacts found in HubSpot",
                imported=0,
                total=0,
                contacts=[]
            )
        
        supabase = get_supabase()
        
        imported_contacts: List[ImportedContact] = []
        duplicates_skipped = 0
        failed = 0
        total_fields = 0
        
        for contact in hubspot_contacts:
            try:
                props = contact.get("properties") or {}
                hubspot_id = contact.get("id", "")
                email = props.get("email")
                
                logger.info(f"Processing contact: hubspot_id={hubspot_id}, email={email}")
                
                if not email:
                    logger.warning(f"Skipping contact {hubspot_id}: no email")
                    failed += 1
                    continue
                
                # Extract LinkedIn for display
                linkedin_url = extract_linkedin_url(props)
                
                # Check for duplicates
                if request.skip_duplicates:
                    existing = supabase.table("contacts").select("id").eq("email", email).execute()
                    
                    if existing.data and len(existing.data) > 0:
                        duplicates_skipped += 1
                        imported_contacts.append(ImportedContact(
                            contact_id=existing.data[0]["id"],
                            hubspot_id=hubspot_id,
                            email=email,
                            first_name=props.get("firstname"),
                            last_name=props.get("lastname"),
                            company=props.get("company"),
                            title=props.get("jobtitle"),
                            linkedin_url=linkedin_url,
                            fields_populated=0,
                            status="duplicate_skipped"
                        ))
                        continue
                
                # Map HubSpot data to our schema
                contact_id = str(uuid.uuid4())
                mapped_contact = map_hubspot_to_contact(props, hubspot_id)
                mapped_contact["id"] = contact_id
                mapped_contact["email"] = email
                
                # Handle workspace_id (UUID type)
                if request.workspace_id:
                    mapped_contact["workspace_id"] = request.workspace_id
                else:
                    mapped_contact["workspace_id"] = None
                
                # Count populated fields
                fields_count = count_populated_fields(mapped_contact)
                total_fields += fields_count
                
                logger.info(f"Inserting contact: {email} with {fields_count} populated fields (LinkedIn: {mapped_contact.get('linkedin_url', 'none')})")
                result = supabase.table("contacts").insert(mapped_contact).execute()
                
                if result.data:
                    logger.info(f"Successfully inserted: {email}")
                    imported_contacts.append(ImportedContact(
                        contact_id=contact_id,
                        hubspot_id=hubspot_id,
                        email=email,
                        first_name=mapped_contact.get("first_name"),
                        last_name=mapped_contact.get("last_name"),
                        company=mapped_contact.get("company"),
                        title=mapped_contact.get("title"),
                        linkedin_url=mapped_contact.get("linkedin_url"),
                        fields_populated=fields_count,
                        status="success"
                    ))
                else:
                    logger.error(f"Insert returned no data for: {email}")
                    failed += 1
                    
            except Exception as e:
                logger.error(f"Error saving contact {email if 'email' in dir() else 'unknown'}: {str(e)}")
                failed += 1
                continue
        
        imported_count = len([c for c in imported_contacts if c.status == "success"])
        avg_fields = total_fields / imported_count if imported_count > 0 else 0.0
        
        logger.info(
            f"HubSpot import complete: {imported_count} imported, "
            f"{duplicates_skipped} duplicates, {failed} failed, "
            f"avg {avg_fields:.1f} fields per contact"
        )
        
        return ImportResponse(
            success=True,
            message=f"Imported {imported_count} contacts with avg {avg_fields:.1f} fields each",
            imported=imported_count,
            total=len(hubspot_contacts),
            duplicates_skipped=duplicates_skipped,
            failed=failed,
            total_fields_populated=total_fields,
            avg_fields_per_contact=round(avg_fields, 1),
            contacts=imported_contacts
        )
        
    except Exception as e:
        logger.error(f"HubSpot import error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

logger.info(f"HubSpot router loaded (v3.1 - multi-LinkedIn field support, {len(HUBSPOT_PROPERTIES)} properties tracked)")
