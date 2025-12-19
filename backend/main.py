from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client
from typing import List, Dict, Optional, Tuple
from jose import jwt, JWTError
import os
import re
import csv
import httpx
import uuid
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

# ============= SUPABASE CLIENT =============
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# ============= AUTH =============
def _get_bearer_token(request: Request) -> str:
    auth = request.headers.get("Authorization") or ""
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    return auth.split(" ", 1)[1].strip()

async def get_current_user(request: Request) -> dict:
    token = _get_bearer_token(request)
    jwt_secret = (os.getenv("SUPABASE_JWT_SECRET") or "").strip()
    
    if not jwt_secret:
        raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET not configured")
    
    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        if not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Token missing sub")
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

def extract_user_id(user: dict) -> str:
    """Safely extract and validate user_id (UUID) from JWT payload."""
    user_id = user.get("sub") or user.get("id") or user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    try:
        validated = uuid.UUID(str(user_id))
        return str(validated)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid user ID format")

# ============= CONTACT VALIDATOR =============
class ContactValidator:
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
        email = (contact.get('email') or '').strip().lower()
        
        if self.require_email:
            if not email:
                self.stats['filtered_no_email'] += 1
                return False, 'missing_email'
            for pattern in self.INVALID_EMAIL_PATTERNS:
                if re.match(pattern, email, re.IGNORECASE):
                    self.stats['filtered_invalid_email'] += 1
                    return False, 'invalid_email'
            if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
                self.stats['filtered_invalid_email'] += 1
                return False, 'invalid_email_format'
        
        if self.filter_dnc:
            props = raw.get('properties', {})
            lead_status = str(props.get('hs_lead_status') or '').lower()
            if lead_status in self.DNC_STATUSES:
                self.stats['filtered_dnc'] += 1
                return False, f'dnc:{lead_status}'
            if props.get('hs_email_optout') in ['true', True, '1']:
                self.stats['filtered_dnc'] += 1
                return False, 'hs_email_optout'
            if raw.get('HasOptedOutOfEmail') in [True, 'true']:
                self.stats['filtered_dnc'] += 1
                return False, 'sf_opted_out'
            if raw.get('DoNotCall') in [True, 'true']:
                self.stats['filtered_dnc'] += 1
                return False, 'sf_do_not_call'
            if raw.get('active_flag') == False:
                self.stats['filtered_dnc'] += 1
                return False, 'pipedrive_inactive'
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
            'firstname': props.get('firstname') or '',
            'lastname': props.get('lastname') or '',
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
            FROM Contact WHERE Email != null ORDER BY CreatedDate DESC LIMIT {max_contacts}
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
            'firstname': raw.get('FirstName') or '',
            'lastname': raw.get('LastName') or '',
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
            'firstname': raw.get('first_name') or '',
            'lastname': raw.get('last_name') or '',
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
    firstname: str = ''
    lastname: str = ''
    email: str
    phone: str = ''
    company: str = ''
    title: str = ''
    linkedin_url: str = ''
    website: str = ''
    vertical: str = ''

# ============= HEALTH CHECK =============
@app.get("/health")
def health():
    return {"status": "ok"}

# ============= CONTACT CRUD =============
@app.get("/api/contacts")
def get_contacts(user: dict = Depends(get_current_user)):
    user_id = extract_user_id(user)
    result = supabase.table("contacts").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return result.data

@app.get("/api/contacts/{contact_id}")
def get_contact(contact_id: int, user: dict = Depends(get_current_user)):
    user_id = extract_user_id(user)
    result = supabase.table("contacts").select("*").eq("id", contact_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    return result.data[0]

@app.post("/api/contacts")
def create_contact(contact: ContactCreate, user: dict = Depends(get_current_user)):
    user_id = extract_user_id(user)
    data = contact.dict()
    data["user_id"] = user_id
    data["enrichment_status"] = "pending"
    result = supabase.table("contacts").insert(data).execute()
    return result.data[0]

@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: int, user: dict = Depends(get_current_user)):
    user_id = extract_user_id(user)
    supabase.table("contacts").delete().eq("id", contact_id).eq("user_id", user_id).execute()
    return {"deleted": True}

# ============= IMPORT HELPERS =============
async def process_import(importer, raw_contacts: List[Dict], user_id: str) -> Dict:
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
        if normalized.get('email'):
            existing = supabase.table('contacts').select('id').eq('user_id', user_id).eq('email', normalized['email']).execute()
            if existing.data:
                duplicates += 1
                continue
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

# ============= IMPORT ENDPOINTS =============
@app.post("/api/import/hubspot")
async def import_hubspot(request: HubSpotImportRequest, user: dict = Depends(get_current_user)):
    try:
        user_id = extract_user_id(user)
        importer = HubSpotImporter(request.access_token, filter_dnc=request.filter_dnc)
        raw_contacts = await importer.fetch_all(request.max_contacts)
        return await process_import(importer, raw_contacts, user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/import/salesforce")
async def import_salesforce(request: SalesforceImportRequest, user: dict = Depends(get_current_user)):
    try:
        user_id = extract_user_id(user)
        importer = SalesforceImporter(request.instance_url, request.access_token, filter_dnc=request.filter_dnc)
        raw_contacts = await importer.fetch_all(request.max_contacts)
        return await process_import(importer, raw_contacts, user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/import/pipedrive")
async def import_pipedrive(request: PipedriveImportRequest, user: dict = Depends(get_current_user)):
    try:
        user_id = extract_user_id(user)
        importer = PipedriveImporter(request.api_token, filter_dnc=request.filter_dnc)
        raw_contacts = await importer.fetch_all(request.max_contacts)
        return await process_import(importer, raw_contacts, user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/import/csv")
async def import_csv(request: CSVImportRequest, user: dict = Depends(get_current_user)):
    FIELD_MAP = {
        'first name': 'firstname', 'firstname': 'firstname', 'first': 'firstname',
        'last name': 'lastname', 'lastname': 'lastname', 'last': 'lastname',
        'full name': 'name', 'name': 'name',
        'email': 'email', 'email address': 'email', 'e-mail': 'email',
        'phone': 'phone', 'phone number': 'phone', 'mobile': 'phone', 'telephone': 'phone',
        'company': 'company', 'company name': 'company', 'organization': 'company', 'account': 'company',
        'title': 'title', 'job title': 'title', 'position': 'title', 'role': 'title',
        'linkedin': 'linkedin_url', 'linkedin url': 'linkedin_url',
        'status': 'status', 'lead status': 'status'
    }
    user_id = extract_user_id(user)
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
        contact = {'enrichment_status': 'pending'}
        for csv_field, value in row.items():
            if value:
                key = csv_field.lower().strip()
                if key in FIELD_MAP:
                    contact[FIELD_MAP[key]] = value.strip()
        if contact.get('name') and not contact.get('firstname'):
            parts = contact['name'].split(' ', 1)
            contact['firstname'] = parts[0]
            contact['lastname'] = parts[1] if len(parts) > 1 else ''
        is_valid, reason = validator.validate(contact, row)
        if not is_valid:
            filtered += 1
            filter_reasons[reason] = filter_reasons.get(reason, 0) + 1
            continue
        if contact.get('email'):
            existing = supabase.table('contacts').select('id').eq('user_id', user_id).eq('email', contact['email']).execute()
            if existing.data:
                duplicates += 1
                continue
        supabase.table('contacts').insert({**contact, 'user_id': user_id}).execute()
        imported += 1
    
    return {
        'success': True,
        'imported': imported,
        'filtered': filtered,
        'duplicates': duplicates,
        'filter_reasons': filter_reasons,
        'stats': validator.stats
    }

# Add this endpoint to main.py (near other contact endpoints)

@app.get("/api/contacts/{contact_id}/download-enrichment")
async def download_enrichment(contact_id: int, user_id: str = Depends(get_current_user)):
    """Download enrichment data as a text file"""
    result = supabase.table("contacts").select("*").eq("id", contact_id).eq("user_id", user_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
        
    contact = result.data[0]
    
    # Build text content
    lines = [
        "=" * 60,
        f"LATTICEIQ ENRICHMENT REPORT",
        "=" * 60,
        "",
        f"Name: {contact.get('first_name', '')} {contact.get('last_name', '')}",
        f"Email: {contact.get('email', 'N/A')}",
        f"Phone: {contact.get('phone', 'N/A')}",
        f"Company: {contact.get('company', 'N/A')}",
        f"Title: {contact.get('title', 'N/A')}",
        "",
        "-" * 60,
        "SCORES",
        "-" * 60,
        f"APEX Score: {contact.get('apex_score', 'N/A')}",
        f"Match Tier: {contact.get('match_tier', 'N/A')}",
        f"MDCP Score: {contact.get('mdcp_score', 'N/A')}",
        f"RSS Score: {contact.get('rss_score', 'N/A')}",
        f"BANT Score: {contact.get('bant_total_score', 'N/A')}",
        f"SPICE Score: {contact.get('spice_total_score', 'N/A')}",
        "",
        "-" * 60,
        "ENRICHMENT STATUS",
        "-" * 60,
        f"Status: {contact.get('enrichment_status', 'N/A')}",
        f"Enriched At: {contact.get('enriched_at', 'N/A')}",
        "",
        "-" * 60,
        "RAW ENRICHMENT DATA",
        "-" * 60,
    ]
    
    # Add enrichment data
    enrichment_data = contact.get('enrichment_data')
    if enrichment_data:
        if isinstance(enrichment_data, str):
            import json
            try:
                enrichment_data = json.loads(enrichment_data)
            except:
                pass
                
        if isinstance(enrichment_data, dict):
            lines.append(json.dumps(enrichment_data, indent=2))
        else:
            lines.append(str(enrichment_data))
    else:
        lines.append("No enrichment data available")
        
    lines.append("")
    lines.append("=" * 60)
    lines.append("END OF REPORT")
    lines.append("=" * 60)
    
    content = "\n".join(lines)
    
    filename = f"{contact.get('first_name', 'contact')}_{contact.get('last_name', '')}_{contact_id}_enrichment.txt"
    
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(
        content=content,
        media_type="text/plain",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
    
# ============= ENRICHMENT V3 ROUTER =============
try:
    from enrichment_v3.api_routes import router as enrichment_v3_router, set_auth_dependency
    
    # Wire up the auth dependency to enrichment routes
    set_auth_dependency(get_current_user)
    
    app.include_router(enrichment_v3_router)
    print("✓ Enrichment V3 routes registered with auth")
except ImportError as e:
    print(f"⚠ Enrichment V3 not available: {e}")
    