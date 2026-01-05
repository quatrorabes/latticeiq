# backend/app/salesforce/router.py
# COMPREHENSIVE VERSION v1.0 - Maximum field extraction from Salesforce

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

router = APIRouter(prefix="/salesforce", tags=["salesforce"])

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
# SALESFORCE FIELD MAPPING
# ============================================================================

# SOQL fields to query from Salesforce Contact object
SALESFORCE_CONTACT_FIELDS = [
    # Core identity
    "Id",
    "FirstName",
    "LastName",
    "Email",
    "Phone",
    "MobilePhone",
    "HomePhone",
    "OtherPhone",
    "Fax",
    
    # Professional
    "Title",           # Job title - maps to our `title`
    "Department",
    "AccountId",       # Link to Account/Company
    
    # Address
    "MailingStreet",
    "MailingCity",
    "MailingState",
    "MailingPostalCode",
    "MailingCountry",
    "OtherStreet",
    "OtherCity",
    "OtherState",
    "OtherPostalCode",
    "OtherCountry",
    
    # Additional info
    "Birthdate",
    "Description",
    "LeadSource",
    "OwnerId",
    
    # Social (if enabled)
    # "LinkedIn_URL__c",  # Custom field example
    
    # Metadata
    "CreatedDate",
    "LastModifiedDate",
    "LastActivityDate",
]

# SOQL fields for Account (company info)
SALESFORCE_ACCOUNT_FIELDS = [
    "Id",
    "Name",
    "Industry",
    "Type",
    "Website",
    "Phone",
    "NumberOfEmployees",
    "AnnualRevenue",
    "Description",
    "BillingStreet",
    "BillingCity",
    "BillingState",
    "BillingPostalCode",
    "BillingCountry",
]

# Map Salesforce fields to our database schema
FIELD_MAPPING = {
    # Contact fields
    "FirstName": "first_name",
    "LastName": "last_name",
    "Email": "email",
    "Phone": "phone",
    "MobilePhone": "mobile_phone",
    "Title": "title",  # Salesforce uses Title for job title
    "Department": "department",
    
    # Address (Mailing)
    "MailingStreet": "street_address",
    "MailingCity": "city",
    "MailingState": "state",
    "MailingPostalCode": "postal_code",
    "MailingCountry": "country",
    
    # Other info
    "Birthdate": "birthday",
    "Description": "notes",
    "LeadSource": "lead_source",
    "LastActivityDate": "last_activity_at",
    
    # Account fields (prefixed)
    "Account.Name": "company",
    "Account.Industry": "industry",
    "Account.Website": "website",
    "Account.NumberOfEmployees": "employee_count",
    "Account.AnnualRevenue": "annual_revenue",
}

# ============================================================================
# REQUEST MODELS
# ============================================================================

class SalesforceCredentials(BaseModel):
    instance_url: str = Field(..., description="Salesforce instance URL (e.g., https://yourorg.salesforce.com)")
    access_token: str = Field(..., min_length=10, description="Salesforce OAuth access token")

class TestConnectionRequest(SalesforceCredentials):
    pass

class ImportRequest(SalesforceCredentials):
    batch_size: int = Field(default=50, ge=1, le=2000, description="Number of contacts to import")
    workspace_id: Optional[str] = Field(default=None, description="Workspace UUID")
    skip_duplicates: bool = Field(default=True, description="Skip existing contacts by email")
    include_accounts: bool = Field(default=True, description="Fetch related Account data")

# ============================================================================
# RESPONSE MODELS
# ============================================================================

class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    contact_count: int = 0
    account_count: int = 0
    org_id: Optional[str] = None
    username: Optional[str] = None

class ImportedContact(BaseModel):
    contact_id: str
    salesforce_id: str
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
    contact_fields: List[str]
    account_fields: List[str]
    field_mapping: Dict[str, str]

# ============================================================================
# SALESFORCE API FUNCTIONS
# ============================================================================

async def test_salesforce_connection(creds: SalesforceCredentials) -> Dict[str, Any]:
    """Test Salesforce connection and get org info"""
    headers = {
        "Authorization": f"Bearer {creds.access_token}",
        "Content-Type": "application/json"
    }
    
    async with aiohttp.ClientSession() as session:
        # Get user info
        async with session.get(
            f"{creds.instance_url}/services/oauth2/userinfo",
            headers=headers
        ) as resp:
            if resp.status == 401:
                raise Exception("Invalid or expired access token")
            if resp.status != 200:
                text = await resp.text()
                raise Exception(f"Salesforce API error: {resp.status} - {text}")
            user_info = await resp.json()
        
        # Count contacts
        query = "SELECT COUNT() FROM Contact"
        async with session.get(
            f"{creds.instance_url}/services/data/v59.0/query",
            headers=headers,
            params={"q": query}
        ) as resp:
            contact_count = 0
            if resp.status == 200:
                data = await resp.json()
                contact_count = data.get("totalSize", 0)
        
        # Count accounts
        query = "SELECT COUNT() FROM Account"
        async with session.get(
            f"{creds.instance_url}/services/data/v59.0/query",
            headers=headers,
            params={"q": query}
        ) as resp:
            account_count = 0
            if resp.status == 200:
                data = await resp.json()
                account_count = data.get("totalSize", 0)
        
        return {
            "org_id": user_info.get("organization_id"),
            "username": user_info.get("preferred_username"),
            "contact_count": contact_count,
            "account_count": account_count
        }

async def fetch_salesforce_contacts(
    creds: SalesforceCredentials,
    batch_size: int = 50,
    include_accounts: bool = True
) -> List[Dict[str, Any]]:
    """Fetch contacts from Salesforce with SOQL"""
    headers = {
        "Authorization": f"Bearer {creds.access_token}",
        "Content-Type": "application/json"
    }
    
    # Build SOQL query with Account relationship
    contact_fields = ", ".join(SALESFORCE_CONTACT_FIELDS)
    
    if include_accounts:
        account_fields = ", ".join([f"Account.{f}" for f in SALESFORCE_ACCOUNT_FIELDS if f != "Id"])
        query = f"SELECT {contact_fields}, {account_fields} FROM Contact WHERE Email != null LIMIT {batch_size}"
    else:
        query = f"SELECT {contact_fields} FROM Contact WHERE Email != null LIMIT {batch_size}"
    
    logger.info(f"SOQL Query: {query[:200]}...")
    
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{creds.instance_url}/services/data/v59.0/query",
            headers=headers,
            params={"q": query}
        ) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise Exception(f"SOQL query failed: {resp.status} - {text}")
            
            data = await resp.json()
            contacts = data.get("records", [])
            logger.info(f"Fetched {len(contacts)} contacts from Salesforce")
            
            return contacts

def map_salesforce_to_contact(sf_contact: Dict[str, Any]) -> Dict[str, Any]:
    """Map Salesforce contact to our schema"""
    contact = {
        "salesforce_id": sf_contact.get("Id"),
        "source": "salesforce",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    # Map direct contact fields
    for sf_field, our_field in FIELD_MAPPING.items():
        if "." not in sf_field:  # Direct field
            value = sf_contact.get(sf_field)
            if value and str(value).strip():
                contact[our_field] = str(value).strip()
    
    # Map Account (company) fields
    account = sf_contact.get("Account") or {}
    if account:
        if account.get("Name"):
            contact["company"] = account["Name"]
        if account.get("Industry"):
            contact["industry"] = account["Industry"]
        if account.get("Website"):
            contact["website"] = account["Website"]
        if account.get("NumberOfEmployees"):
            contact["employee_count"] = str(account["NumberOfEmployees"])
        if account.get("AnnualRevenue"):
            try:
                contact["annual_revenue"] = int(float(account["AnnualRevenue"]))
            except (ValueError, TypeError):
                pass
    
    # Build location string
    city = contact.get("city")
    state = contact.get("state")
    country = contact.get("country")
    location_parts = [p for p in [city, state, country] if p]
    if location_parts:
        contact["location"] = ", ".join(location_parts)
    
    return contact

def count_populated_fields(contact: Dict[str, Any]) -> int:
    """Count populated fields"""
    exclude = {"id", "created_at", "updated_at", "source", "salesforce_id", "workspace_id"}
    return sum(
        1 for k, v in contact.items()
        if k not in exclude and v and str(v).strip()
    )

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/health")
async def salesforce_health():
    """Salesforce router health check"""
    return {
        "status": "ok",
        "service": "salesforce",
        "version": "1.0",
        "features": [
            "test-connection",
            "import-batch",
            "soql-field-extraction",
            "account-relationship"
        ],
        "contact_fields": len(SALESFORCE_CONTACT_FIELDS),
        "account_fields": len(SALESFORCE_ACCOUNT_FIELDS)
    }

@router.get("/field-mapping", response_model=FieldMappingResponse)
async def get_field_mapping():
    """Get Salesforce to LatticeIQ field mapping"""
    return FieldMappingResponse(
        contact_fields=SALESFORCE_CONTACT_FIELDS,
        account_fields=SALESFORCE_ACCOUNT_FIELDS,
        field_mapping=FIELD_MAPPING
    )

@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(request: TestConnectionRequest):
    """Test Salesforce connection"""
    try:
        logger.info("Testing Salesforce connection...")
        result = await test_salesforce_connection(request)
        
        return TestConnectionResponse(
            success=True,
            message="Connected to Salesforce successfully!",
            contact_count=result.get("contact_count", 0),
            account_count=result.get("account_count", 0),
            org_id=result.get("org_id"),
            username=result.get("username")
        )
    except Exception as e:
        logger.error(f"Salesforce connection error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/debug-fetch")
async def debug_fetch(request: TestConnectionRequest):
    """Debug: Show raw Salesforce data"""
    try:
        contacts = await fetch_salesforce_contacts(
            request,
            batch_size=3,
            include_accounts=True
        )
        
        # Analyze field coverage
        field_coverage = {}
        for contact in contacts:
            for key, value in contact.items():
                if key in ["attributes", "Account"]:
                    continue
                if key not in field_coverage:
                    field_coverage[key] = {"has_value": 0, "empty": 0}
                if value:
                    field_coverage[key]["has_value"] += 1
                else:
                    field_coverage[key]["empty"] += 1
        
        return {
            "count": len(contacts),
            "field_coverage": field_coverage,
            "sample_contacts": contacts[:3]
        }
    except Exception as e:
        logger.error(f"Debug fetch error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/import-batch", response_model=ImportResponse)
async def import_batch(request: ImportRequest):
    """Import contacts from Salesforce"""
    try:
        logger.info(f"Importing {request.batch_size} contacts from Salesforce...")
        
        sf_contacts = await fetch_salesforce_contacts(
            request,
            request.batch_size,
            include_accounts=request.include_accounts
        )
        
        if not sf_contacts:
            return ImportResponse(
                success=True,
                message="No contacts found in Salesforce",
                imported=0,
                total=0,
                contacts=[]
            )
        
        supabase = get_supabase()
        
        imported_contacts: List[ImportedContact] = []
        duplicates_skipped = 0
        failed = 0
        total_fields = 0
        
        for sf_contact in sf_contacts:
            try:
                email = sf_contact.get("Email")
                salesforce_id = sf_contact.get("Id", "")
                
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
                            salesforce_id=salesforce_id,
                            email=email,
                            first_name=sf_contact.get("FirstName"),
                            last_name=sf_contact.get("LastName"),
                            company=(sf_contact.get("Account") or {}).get("Name"),
                            title=sf_contact.get("Title"),
                            fields_populated=0,
                            status="duplicate_skipped"
                        ))
                        continue
                
                # Map to our schema
                contact_id = str(uuid.uuid4())
                mapped = map_salesforce_to_contact(sf_contact)
                mapped["id"] = contact_id
                mapped["email"] = email
                mapped["workspace_id"] = request.workspace_id if request.workspace_id else None
                
                fields_count = count_populated_fields(mapped)
                total_fields += fields_count
                
                result = supabase.table("contacts").insert(mapped).execute()
                
                if result.data:
                    imported_contacts.append(ImportedContact(
                        contact_id=contact_id,
                        salesforce_id=salesforce_id,
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
                logger.error(f"Error importing contact: {str(e)}")
                failed += 1
                continue
        
        imported_count = len([c for c in imported_contacts if c.status == "success"])
        avg_fields = total_fields / imported_count if imported_count > 0 else 0.0
        
        return ImportResponse(
            success=True,
            message=f"Imported {imported_count} contacts with avg {avg_fields:.1f} fields",
            imported=imported_count,
            total=len(sf_contacts),
            duplicates_skipped=duplicates_skipped,
            failed=failed,
            total_fields_populated=total_fields,
            avg_fields_per_contact=round(avg_fields, 1),
            contacts=imported_contacts
        )
        
    except Exception as e:
        logger.error(f"Salesforce import error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

logger.info(f"Salesforce router loaded (v1.0 - {len(SALESFORCE_CONTACT_FIELDS)} contact fields, {len(SALESFORCE_ACCOUNT_FIELDS)} account fields)")
