from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from supabase import create_client
from typing import List, Dict, Optional, Tuple
from jose import jwt, JWTError
import os
import re
import csv
import httpx
from io import StringIO
from datetime import datetime

app = FastAPI(title="LatticeIQ API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")  # Or use SUPABASE_KEY

async def get_current_user(request: Request) -> dict:
    """
    Extract and validate JWT from Authorization header.
    Returns the full decoded JWT payload as a dict.
    """
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
    token = auth_header.split(" ")[1]
    
    try:
        # Decode JWT - Supabase uses HS256
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )
        return payload  # Contains 'sub' (user UUID), 'email', 'role', etc.
    
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
        
        # Wire up to enrichment routes
        from enrichment_v3.api_routes import router as enrichment_router, set_auth_dependency
        
        set_auth_dependency(get_current_user)
        app.include_router(enrichment_router)        

# ============= CONTACT VALIDATOR =============

class ContactValidator:
    """Validates and filters contacts during import."""
    
    DNC_STATUSES = {
        'unqualified', 'bad timing', 'do not contact', 'dnc',
        'unsubscribed', 'opted out', 'optedout', 'opt-out', 'opt out',
        'bounced', 'invalid', 'spam', 'junk', 'disqualified',
        'lost', 'closed lost', 'not interested', 'do_not_contact',
        'do not call', 'blacklist', 'blacklisted', 'deleted', 'rejected',
        'removed', 'inactive', 'dead', 'competitor', 'not a fit',
        'wrong contact', 'no longer there'
    }
    
    INVALID_EMAIL_PATTERNS = [
        r'.*@example\.com$', r'.*@test\.com$', r'.*@localhost.*',
        r'^test@.*', r'^fake@.*', r'^noreply@.*', r'^no-reply@.*',
        r'^donotreply@.*', r'.*@mailinator\.com$', r'.*@tempmail\..*',
        r'.*@guerrillamail\..*', r'.*@10minutemail\..*'
    ]
    
    def __init__(self, filter_dnc: bool = True, require_email: bool = True):
        self.filter_dnc = filter_dnc
        self.require_email = require_email
        self.stats = {
            'total': 0, 'passed': 0, 'filtered_dnc': 0,
            'filtered_no_email': 0, 'filtered_invalid_email': 0
        }
    
    def validate(self, contact: Dict, raw: Dict = None) -> Tuple[bool, str]:
        self.stats['total'] += 1
        raw = raw or {}
        
        # Check email
        email = (contact.get('email') or '').strip().lower()
        if self.require_email:
            if not email:
                self.stats['filtered_no_email'] += 1
                return False, 'missing_email'
            
            # Check invalid patterns
            for pattern in self.INVALID_EMAIL_PATTERNS:
                if re.match(pattern, email, re.IGNORECASE):
                    self.stats['filtered_invalid_email'] += 1
                    return False, 'invalid_email'
            
            # Basic format check
            if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
                self.stats['filtered_invalid_email'] += 1
                return False, 'invalid_email_format'
        
        # Check DNC status
        if self.filter_dnc:
            # HubSpot specific
            props = raw.get('properties', {})
            lead_status = str(props.get('hs_lead_status') or '').lower()
            if lead_status in self.DNC_STATUSES:
                self.stats['filtered_dnc'] += 1
                return False, f'dnc:{lead_status}'
            
            if props.get('hs_email_optout') in ['true', True, '1']:
                self.stats['filtered_dnc'] += 1
                return False, 'hs_email_optout'
            
            # Salesforce specific
            if raw.get('HasOptedOutOfEmail') in [True, 'true']:
                self.stats['filtered_dnc'] += 1
                return False, 'sf_opted_out'
            if raw.get('DoNotCall') in [True, 'true']:
                self.stats['filtered_dnc'] += 1
                return False, 'sf_do_not_call'
            
            # Pipedrive specific
            if raw.get('active_flag') == False:
                self.stats['filtered_dnc'] += 1
                return False, 'pipedrive_inactive'
            
            # General status check
            status = str(contact.get('status') or '').lower()
            if status in self.DNC_STATUSES:
                self.stats['filtered_dnc'] += 1
                return False, f'dnc:{status}'
        
        self.stats['passed'] += 1
        return True, 'valid'


# ============= CRM IMPORTERS =============

class HubSpotImporter:
    BASE_URL = "https://api.hubapi.com"
    
    def __init__(self, access_token: str, filter_dnc: bool = True):
        self.access_token = access_token
        self.validator = ContactValidator(filter_dnc=filter_dnc)
    
    def _headers(self):
        return {'Authorization': f'Bearer {self.access_token}', 'Content-Type': 'application/json'}
    
    async def fetch_all(self, max_contacts: int = 500) -> List[Dict]:
        all_contacts = []
        after = None
        async with httpx.AsyncClient(timeout=30.0) as client:
            while len(all_contacts) < max_contacts:
                url = f"{self.BASE_URL}/crm/v3/objects/contacts"
                params = {
                    'limit': 100,
                    'properties': 'firstname,lastname,email,phone,company,jobtitle,linkedinbio,website,hs_lead_status,hs_email_optout,lifecyclestage'
                }
                if after:
                    params['after'] = after
                response = await client.get(url, headers=self._headers(), params=params)
                if response.status_code != 200:
                    raise Exception(f"HubSpot API error: {response.status_code} - {response.text}")
                data = response.json()
                contacts = data.get('results', [])
                if not contacts:
                    break
                all_contacts.extend(contacts)
                after = data.get('paging', {}).get('next', {}).get('after')
                if not after:
                    break
        return all_contacts[:max_contacts]
    
    def normalize(self, raw: Dict) -> Dict:
        props = raw.get('properties', {})
        return {
            'first_name': props.get('firstname') or '',
            'last_name': props.get('lastname') or '',
            'email': props.get('email') or '',
            'phone': props.get('phone') or '',
            'company': props.get('company') or '',
            'title': props.get('jobtitle') or '',
            'linkedin_url': props.get('linkedinbio') or '',
            'website': props.get('website') or '',
            'status': props.get('hs_lead_status') or '',
            'enrichment_status': 'pending'
        }


class SalesforceImporter:
    def __init__(self, instance_url: str, access_token: str, filter_dnc: bool = True):
        self.instance_url = instance_url.rstrip('/')
        self.access_token = access_token
        self.validator = ContactValidator(filter_dnc=filter_dnc)
    
    def _headers(self):
        return {'Authorization': f'Bearer {self.access_token}', 'Content-Type': 'application/json'}
    
    async def fetch_all(self, max_contacts: int = 500) -> List[Dict]:
        query = f"""
            SELECT Id, FirstName, LastName, Email, Phone, Account.Name, Title, 
                   HasOptedOutOfEmail, DoNotCall
            FROM Contact
            WHERE Email != null
            ORDER BY CreatedDate DESC
            LIMIT {max_contacts}
        """
        url = f"{self.instance_url}/services/data/v58.0/query"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=self._headers(), params={'q': query})
            if response.status_code != 200:
                raise Exception(f"Salesforce API error: {response.status_code} - {response.text}")
            return response.json().get('records', [])
    
    def normalize(self, raw: Dict) -> Dict:
        account = raw.get('Account') or {}
        return {
            'first_name': raw.get('FirstName') or '',
            'last_name': raw.get('LastName') or '',
            'email': raw.get('Email') or '',
            'phone': raw.get('Phone') or '',
            'company': account.get('Name') or '',
            'title': raw.get('Title') or '',
            'linkedin_url': '',
            'enrichment_status': 'pending'
        }


class PipedriveImporter:
    BASE_URL = "https://api.pipedrive.com/v1"
    
    def __init__(self, api_token: str, filter_dnc: bool = True):
        self.api_token = api_token
        self.validator = ContactValidator(filter_dnc=filter_dnc)
    
    async def fetch_all(self, max_contacts: int = 500) -> List[Dict]:
        all_contacts = []
        start = 0
        async with httpx.AsyncClient(timeout=30.0) as client:
            while len(all_contacts) < max_contacts:
                url = f"{self.BASE_URL}/persons"
                params = {'api_token': self.api_token, 'start': start, 'limit': 500}
                response = await client.get(url, params=params)
                if response.status_code != 200:
                    raise Exception(f"Pipedrive API error: {response.status_code}")
                data = response.json()
                if not data.get('success'):
                    break
                contacts = data.get('data') or []
                if not contacts:
                    break
                all_contacts.extend(contacts)
                pagination = data.get('additional_data', {}).get('pagination', {})
                if not pagination.get('more_items_in_collection'):
                    break
                start = pagination.get('next_start', start + 500)
        return all_contacts[:max_contacts]
    
    def normalize(self, raw: Dict) -> Dict:
        emails = raw.get('email', [])
        primary_email = ''
        if emails and isinstance(emails, list) and len(emails) > 0:
            primary_email = emails[0].get('value', '')
        elif isinstance(emails, str):
            primary_email = emails
        
        phones = raw.get('phone', [])
        primary_phone = ''
        if phones and isinstance(phones, list) and len(phones) > 0:
            primary_phone = phones[0].get('value', '')
        elif isinstance(phones, str):
            primary_phone = phones
        
        org = raw.get('org_name') or ''
        if isinstance(raw.get('org_id'), dict):
            org = raw['org_id'].get('name', org)
        
        return {
            'first_name': raw.get('first_name') or '',
            'last_name': raw.get('last_name') or '',
            'email': primary_email,
            'phone': primary_phone,
            'company': org,
            'title': raw.get('job_title') or '',
            'linkedin_url': '',
            'enrichment_status': 'pending'
        }


# ============= REQUEST MODELS =============

class HubSpotImportRequest(BaseModel):
    access_token: str
    max_contacts: int = 500
    filter_dnc: bool = True

class SalesforceImportRequest(BaseModel):
    instance_url: str
    access_token: str
    max_contacts: int = 500
    filter_dnc: bool = True

class PipedriveImportRequest(BaseModel):
    api_token: str
    max_contacts: int = 500
    filter_dnc: bool = True

class CSVImportRequest(BaseModel):
    csv_content: str
    filter_dnc: bool = True

class ContactCreate(BaseModel):
    first_name: str = ''
    last_name: str = ''
    email: str
    phone: str = ''
    company: str = ''
    title: str = ''
    linkedin_url: str = ''


# ============= EXISTING ENDPOINTS =============

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/contacts")
def get_contacts(user = Depends(get_current_user)):
    result = supabase.table("contacts").select("*").eq("user_id", user.id).execute()
    return {"contacts": result.data}

@app.get("/api/contacts/{contact_id}")
def get_contact(contact_id: int, user = Depends(get_current_user)):
    result = supabase.table("contacts").select("*").eq("id", contact_id).eq("user_id", user.id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    return result.data[0]

@app.post("/api/contacts")
def create_contact(contact: ContactCreate, user = Depends(get_current_user)):
    data = contact.dict()
    data["user_id"] = user.id
    data["enrichment_status"] = "pending"
    result = supabase.table("contacts").insert(data).execute()
    return result.data[0]

@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: int, user = Depends(get_current_user)):
    supabase.table("contacts").delete().eq("id", contact_id).eq("user_id", user.id).execute()
    return {"deleted": True}


# ============= IMPORT ENDPOINTS =============

async def process_import(importer, raw_contacts: List[Dict], user_id: str) -> Dict:
    """Common import processing logic."""
    imported = 0
    filtered = 0
    duplicates = 0
    filter_reasons = {}
    
    for raw in raw_contacts:
        normalized = importer.normalize(raw)
        is_valid, reason = importer.validator.validate(normalized, raw)
        
        if not is_valid:
            filtered += 1
            filter_reasons[reason] = filter_reasons.get(reason, 0) + 1
            continue
        
        # Check duplicate
        if normalized.get('email'):
            existing = supabase.table('contacts').select('id').eq(
                'user_id', user_id
            ).eq('email', normalized['email']).execute()
            if existing.data:
                duplicates += 1
                continue
        
        # Insert
        supabase.table('contacts').insert({**normalized, 'user_id': user_id}).execute()
        imported += 1
    
    return {
        'success': True,
        'imported': imported,
        'filtered': filtered,
        'duplicates': duplicates,
        'filter_reasons': filter_reasons,
        'stats': importer.validator.stats
    }


@app.post("/api/import/hubspot")
async def import_hubspot(request: HubSpotImportRequest, user = Depends(get_current_user)):
    """Import contacts from HubSpot with DNC filtering."""
    try:
        importer = HubSpotImporter(request.access_token, filter_dnc=request.filter_dnc)
        raw_contacts = await importer.fetch_all(request.max_contacts)
        return await process_import(importer, raw_contacts, user.id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/import/salesforce")
async def import_salesforce(request: SalesforceImportRequest, user = Depends(get_current_user)):
    """Import contacts from Salesforce with DNC filtering."""
    try:
        importer = SalesforceImporter(request.instance_url, request.access_token, filter_dnc=request.filter_dnc)
        raw_contacts = await importer.fetch_all(request.max_contacts)
        return await process_import(importer, raw_contacts, user.id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/import/pipedrive")
async def import_pipedrive(request: PipedriveImportRequest, user = Depends(get_current_user)):
    """Import contacts from Pipedrive with DNC filtering."""
    try:
        importer = PipedriveImporter(request.api_token, filter_dnc=request.filter_dnc)
        raw_contacts = await importer.fetch_all(request.max_contacts)
        return await process_import(importer, raw_contacts, user.id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/import/csv")
async def import_csv(request: CSVImportRequest, user = Depends(get_current_user)):
    """Import contacts from CSV with DNC filtering."""
    
    FIELD_MAP = {
        'first name': 'first_name', 'firstname': 'first_name', 'first': 'first_name',
        'last name': 'last_name', 'lastname': 'last_name', 'last': 'last_name',
        'full name': 'name', 'name': 'name',
        'email': 'email', 'email address': 'email', 'e-mail': 'email',
        'phone': 'phone', 'phone number': 'phone', 'mobile': 'phone', 'telephone': 'phone',
        'company': 'company', 'company name': 'company', 'organization': 'company', 'account': 'company',
        'title': 'title', 'job title': 'title', 'position': 'title', 'role': 'title',
        'linkedin': 'linkedin_url', 'linkedin url': 'linkedin_url',
        'status': 'status', 'lead status': 'status'
    }
    
    validator = ContactValidator(filter_dnc=request.filter_dnc)
    
    try:
        reader = csv.DictReader(StringIO(request.csv_content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {str(e)}")
    
    imported = 0
    filtered = 0
    duplicates = 0
    filter_reasons = {}
    
    for row in reader:
        # Normalize fields
        contact = {'enrichment_status': 'pending'}
        for csv_field, value in row.items():
            if value:
                key = csv_field.lower().strip()
                if key in FIELD_MAP:
                    contact[FIELD_MAP[key]] = value.strip()
        
        # Handle full name split
        if contact.get('name') and not contact.get('first_name'):
            parts = contact['name'].split(' ', 1)
            contact['first_name'] = parts[0]
            contact['last_name'] = parts[1] if len(parts) > 1 else ''
        
        # Validate
        is_valid, reason = validator.validate(contact, row)
        if not is_valid:
            filtered += 1
            filter_reasons[reason] = filter_reasons.get(reason, 0) + 1
            continue
        
        # Check duplicate
        if contact.get('email'):
            existing = supabase.table('contacts').select('id').eq(
                'user_id', user.id
            ).eq('email', contact['email']).execute()
            if existing.data:
                duplicates += 1
                continue
        
        # Insert
        supabase.table('contacts').insert({**contact, 'user_id': user.id}).execute()
        imported += 1
    
    return {
        'success': True,
        'imported': imported,
        'filtered': filtered,
        'duplicates': duplicates,
        'filter_reasons': filter_reasons,
        'stats': validator.stats
    }


# ============= ENRICHMENT V3 - PARALLEL ARCHITECTURE =============
try:
    from enrichment_v3.api_routes import router as enrichment_v3_router, set_auth_dependency
    set_auth_dependency(get_current_user)
    app.include_router(enrichment_v3_router)
    print("✓ Enrichment V3 (Parallel) routes registered")
except ImportError as e:
    print(f"⚠ Enrichment V3 not available: {e}")
    