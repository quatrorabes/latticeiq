"""
LatticeIQ FastAPI Application - FIXED UUID HANDLING

Core API entry point with Supabase auth and contacts CRUD.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client
from scoring import (
    APEXCalculator,
    MDCCalculator,
    BANTCalculator,
    SPICECalculator,
    calculate_all_scores,
    get_default_config
)
from api.routes import profile_config
from domains.scoring.router import router as scoring_router


app = FastAPI()


import logging

logger = logging.getLogger(__name__)


# ============================================================================
# OPTIONAL ROUTERS
# ============================================================================

ENRICHMENT_AVAILABLE = False
ENRICHMENT_ERROR: Optional[str] = None

try:
    from enrichment_v3.api_routes import router as enrichment_router, set_auth_dependency as set_enrichment_auth
    ENRICHMENT_AVAILABLE = True
except Exception as e:
    enrichment_router = None
    set_enrichment_auth = None
    ENRICHMENT_ERROR = str(e)
    print(f"⚠️ enrichment_v3 import failed: {ENRICHMENT_ERROR}")

QUICK_ENRICH_AVAILABLE = False
QUICK_ENRICH_ERROR: Optional[str] = None

try:
    from quick_enrich import router as quick_enrich_router, set_auth_dependency as set_quick_enrich_auth
    QUICK_ENRICH_AVAILABLE = True
except Exception as e:
    quick_enrich_router = None
    set_quick_enrich_auth = None
    QUICK_ENRICH_ERROR = str(e)
    print(f"⚠️ quick_enrich import failed: {QUICK_ENRICH_ERROR}")

# ============================================================================
# APP & CORS
# ============================================================================

app = FastAPI(title="LatticeIQ API", version="1.0.0", description="Sales Intelligence Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# SUPABASE CLIENT & AUTH
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("SUPABASEURL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASEKEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

security = HTTPBearer()

class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    try:
        user_response = supabase.auth.get_user(credentials.credentials)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token (no user)")
        print(f"🔍 AUTH DEBUG: user.id={user.id}, email={user.email}")
        return CurrentUser(id=str(user.id), email=user.email)
    except Exception as e:
        print(f"❌ AUTH ERROR: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
        
verify_jwt_token = get_current_user  # Alias for backward compatibility        

# Inject auth into optional routers
if set_enrichment_auth is not None:
    set_enrichment_auth(get_current_user)
if set_quick_enrich_auth is not None:
    set_quick_enrich_auth(get_current_user)

# ============================================================================
# CONTACT MODELS - FIXED FIELD NAMES (snake_case)
# ============================================================================

class ContactCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    vertical: Optional[str] = None
    persona_type: Optional[str] = None
    enrichment_status: str = "pending"

class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    vertical: Optional[str] = None
    persona_type: Optional[str] = None
    enrichment_status: Optional[str] = None

# ============================================================================
# ROUTER REGISTRATION - FIXED
# ============================================================================

if enrichment_router is not None:
    print("✅ Registering enrichment_v3 router")
    app.include_router(enrichment_router)
else:
    print(f"❌ enrichment_v3 NOT available: {ENRICHMENT_ERROR}")

if quick_enrich_router is not None:
    print("✅ Registering quick_enrich router at /api/v3/enrichment")
    app.include_router(quick_enrich_router)  # Router already has /api/v3/enrichment prefix
else:
    print(f"❌ quick_enrich NOT available: {QUICK_ENRICH_ERROR}")
    
# Scoring Router
if scoring_router is not None:
    print("✅ Registering scoring router at /api/v3/scoring")
    app.include_router(scoring_router)
else:
    print("❌ scoring router NOT available")
    

# ============================================================================
# HEALTH + ROOT
# ============================================================================

@app.get("/health")
async def health_check_root():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "enrichment_available": ENRICHMENT_AVAILABLE,
        "enrichment_error": ENRICHMENT_ERROR,
        "quick_enrich_available": QUICK_ENRICH_AVAILABLE,
        "quick_enrich_error": QUICK_ENRICH_ERROR,
    }

@app.get("/api/health")
async def api_health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "enrichment_available": ENRICHMENT_AVAILABLE,
        "enrichment_error": ENRICHMENT_ERROR,
        "quick_enrich_available": QUICK_ENRICH_AVAILABLE,
        "quick_enrich_error": QUICK_ENRICH_ERROR,
    }

@app.get("/")
async def root():
    return {
        "message": "LatticeIQ Sales Intelligence API",
        "version": "1.0.0",
        "docs": "/docs",
        "enrichment": "available" if ENRICHMENT_AVAILABLE else "unavailable",
        "quick_enrich": "available" if QUICK_ENRICH_AVAILABLE else "unavailable",
    }

# ============================================================================
# CONTACTS CRUD - FIXED UUID HANDLING (use str not UUID)
# ============================================================================

@app.get("/api/contacts")
async def list_contacts(user: CurrentUser = Depends(get_current_user)):
    """List all contacts for the authenticated user"""
    print(f"🔍 DEBUG: user.id = {user.id}")
    result = supabase.table("contacts").select("*").eq("user_id", user.id).execute()
    print(f"🔍 DEBUG: found {len(result.data or [])} contacts")
    return {"contacts": result.data or []}

@app.get("/api/contacts/{contact_id}")
async def get_contact(contact_id: str, user: CurrentUser = Depends(get_current_user)):
    """Get a single contact by ID"""
    result = (
        supabase.table("contacts")
        .select("*")
        .eq("id", contact_id)
        .eq("user_id", user.id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    return result.data[0]

@app.post("/api/contacts")
async def create_contact(contact: ContactCreate, user: CurrentUser = Depends(get_current_user)):
    """Create a new contact"""
    data = contact.dict()
    data["user_id"] = user.id
    
    result = supabase.table("contacts").insert(data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create contact")

    return result.data[0]

@app.put("/api/contacts/{contact_id}")
async def update_contact(contact_id: str, patch: ContactUpdate, user: CurrentUser = Depends(get_current_user)):
    """Update a contact"""
    update_data = {k: v for k, v in patch.dict().items() if v is not None}

    if not update_data:
        return {"updated": False, "message": "No fields to update"}

    result = (
        supabase.table("contacts")
        .update(update_data)
        .eq("id", contact_id)
        .eq("user_id", user.id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    return result.data[0]

# Add to imports
from scoring import (
    APEXCalculator, 
    MDCCalculator, 
    BANTCalculator, 
    SPICECalculator, 
    calculate_all_scores
)

# Add this endpoint (after /api/v3/enrichment endpoints)
@app.post("/api/v3/scoring/calculate/{contact_id}")
async def calculate_all_contact_scores(
    contact_id: str,
    user_id: str = Depends(verify_jwt_token)
):
    """
    Calculate all 4 scoring frameworks for a single contact
    
    Frameworks:
    - APEX (Affinity, Pain, eXecution, eXpert)
    - MDC (Money, Decision-maker, Champion)
    - BANT (Budget, Authority, Need, Timeline)
    - SPICE (Situation, Problem, Implication, Consequence, Economic)
    """
    try:
        # Get contact from Supabase
        response = supabase.table('contacts').select('*').eq('id', contact_id).eq('user_id', user_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Contact not found")
            
        contact_data = response.data
        enrichment_data = contact_data.get('enrichment_data', {})
        
        # Calculate all scores
        results = calculate_all_scores(contact_data, enrichment_data)
        
        # Save scores to database
        update_data = {
            'apex_score': results['scores']['APEX']['score'],
            'mdc_score': results['scores']['MDC']['score'],
            'bant_score': results['scores']['BANT']['score'],
            'spice_score': results['scores']['SPICE']['score']
        }
        
        supabase.table('contacts').update(update_data).eq('id', contact_id).execute()
        
        return {
            'contact_id': contact_id,
            'scores': results,
            'message': 'All scores calculated and saved successfully'
        }
        
    except Exception as e:
        logger.error(f"Scoring error for contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
        
        
    
# =====================================================
# SCORING ENDPOINTS
# =====================================================
        
@app.post("/api/v3/scoring/calculate/{contact_id}")
async def calculate_contact_scores(
    contact_id: str,
    user_id: str = Depends(verify_jwt_token)
):
    """
    Calculate all 4 scoring frameworks for a single contact
    
    Frameworks:
    - APEX (Affinity, Pain, eXecution, eXpert)
    - MDC (Money, Decision-maker, Champion, Process)
    - BANT (Budget, Authority, Need, Timeline)
    - SPICE (Situation, Problem, Implication, Consequence, Economic)
    
    Returns:
        All 4 scores, average score, recommended tier
    
    Example:
        POST /api/v3/scoring/calculate/contact_123
        Returns: {
            "contact_id": "contact_123",
            "scores": {
                "APEX": {"score": 75, "breakdown": {...}},
                "MDC": {"score": 82, "breakdown": {...}},
                "BANT": {"score": 68, "breakdown": {...}},
                "SPICE": {"score": 71, "breakdown": {...}}
            },
            "average_score": 74.0,
            "recommended_tier": "Hot"
        }
    """
    try:
        # Get contact from Supabase
        response = supabase.table('contacts').select('*').eq('id', contact_id).eq('user_id', user_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Contact not found")
            
        contact_data = response.data
        enrichment_data = contact_data.get('enrichment_data', {})
        
        # Ensure enrichment data exists
        if not enrichment_data:
            raise HTTPException(status_code=400, detail="Contact must be enriched before scoring")
            
        # Calculate all scores using scoring module
        results = calculate_all_scores(contact_data, enrichment_data)
        
        # Extract scores
        apex_score = results['scores']['APEX']['score']
        mdc_score = results['scores']['MDC']['score']
        bant_score = results['scores']['BANT']['score']
        spice_score = results['scores']['SPICE']['score']
        recommended_tier = results['recommended_tier']
        
        # Save scores to database
        update_data = {
            'apex_score': round(apex_score, 2),
            'mdc_score': round(mdc_score, 2),
            'bant_score': round(bant_score, 2),
            'spice_score': round(spice_score, 2),
            'recommended_tier': recommended_tier
        }
        
        supabase.table('contacts').update(update_data).eq('id', contact_id).execute()
        
        logger.info(f"Calculated scores for contact {contact_id}: {recommended_tier}")
        
        return {
            'contact_id': contact_id,
            'scores': results['scores'],
            'average_score': round(results['average_score'], 2),
            'recommended_tier': recommended_tier,
            'saved': True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scoring error for contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Scoring error: {str(e)}")
        
        
@app.post("/api/v3/scoring/batch")
async def batch_score_contacts(
    user_id: str = Depends(verify_jwt_token)
):
    """
    Calculate scores for all user's contacts
    
    Returns:
        Summary of scoring results:
        - total_contacts: Total contacts for user
        - scored_contacts: Successfully scored
        - hot_leads: Count of Hot tier
        - warm_leads: Count of Warm tier
        - cold_leads: Count of Cold tier
        - average_apex: Average APEX score
        - average_mdc: Average MDC score
        - average_bant: Average BANT score
        - average_spice: Average SPICE score
    
    Example:
        POST /api/v3/scoring/batch
        Returns: {
            "total_contacts": 50,
            "scored_contacts": 48,
            "hot_leads": 12,
            "warm_leads": 25,
            "cold_leads": 11,
            "average_apex": 68.5,
            "average_mdc": 72.3,
            "average_bant": 61.2,
            "average_spice": 65.8
        }
    """
    try:
        # Get all contacts
        response = supabase.table('contacts').select('*').eq('user_id', user_id).execute()
        contacts = response.data or []
        
        results = []
        failed = []
        
        for contact in contacts:
            try:
                enrichment_data = contact.get('enrichment_data', {})
                
                # Only score if enriched
                if not enrichment_data:
                    continue
                
                contact_results = calculate_all_scores(contact, enrichment_data)
                
                # Save to database
                apex_score = contact_results['scores']['APEX']['score']
                mdc_score = contact_results['scores']['MDC']['score']
                bant_score = contact_results['scores']['BANT']['score']
                spice_score = contact_results['scores']['SPICE']['score']
                
                supabase.table('contacts').update({
                    'apex_score': round(apex_score, 2),
                    'mdc_score': round(mdc_score, 2),
                    'bant_score': round(bant_score, 2),
                    'spice_score': round(spice_score, 2),
                    'recommended_tier': contact_results['recommended_tier']
                }).eq('id', contact['id']).execute()
                
                results.append(contact_results)
                
            except Exception as e:
                logger.error(f"Error scoring contact {contact.get('id')}: {str(e)}")
                failed.append(contact.get('id'))
                continue
            
        # Calculate statistics
        hot_count = len([r for r in results if r['recommended_tier'] == 'Hot'])
        warm_count = len([r for r in results if r['recommended_tier'] == 'Warm'])
        cold_count = len([r for r in results if r['recommended_tier'] == 'Cold'])
        
        avg_apex = sum(r['scores']['APEX']['score'] for r in results) / len(results) if results else 0
        avg_mdc = sum(r['scores']['MDC']['score'] for r in results) / len(results) if results else 0
        avg_bant = sum(r['scores']['BANT']['score'] for r in results) / len(results) if results else 0
        avg_spice = sum(r['scores']['SPICE']['score'] for r in results) / len(results) if results else 0
        
        logger.info(f"Batch scored {len(results)} contacts. Hot: {hot_count}, Warm: {warm_count}, Cold: {cold_count}")
        
        return {
            'total_contacts': len(contacts),
            'enriched_contacts': len([c for c in contacts if c.get('enrichment_data')]),
            'scored_contacts': len(results),
            'failed_contacts': len(failed),
            'hot_leads': hot_count,
            'warm_leads': warm_count,
            'cold_leads': cold_count,
            'average_apex': round(avg_apex, 2),
            'average_mdc': round(avg_mdc, 2),
            'average_bant': round(avg_bant, 2),
            'average_spice': round(avg_spice, 2)
        }
        
    except Exception as e:
        logger.error(f"Batch scoring error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch scoring error: {str(e)}")
        
        
@app.get("/api/v3/scoring/config/{framework}")
async def get_scoring_config(
    framework: str,
    user_id: str = Depends(verify_jwt_token)
):
    """
    Get default configuration for a scoring framework
    
    Parameters:
        framework: One of APEX, MDC, BANT, SPICE
    
    Returns:
        Configuration dict for the framework
    
    Example:
        GET /api/v3/scoring/config/APEX
        Returns: {
            "affinity_weight": 25,
            "pain_weight": 25,
            "execution_weight": 25,
            "expert_weight": 25,
            ...
        }
    """
    try:
        config = get_default_config(framework.upper())
        return {
            'framework': framework.upper(),
            'config': config
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Config error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
        
        
# =====================================================
# END SCORING ENDPOINTS
# =====================================================
        
@app.delete("/api/contacts/{contact_id}")
async def delete_contact(contact_id: str, user: CurrentUser = Depends(get_current_user)):
    """Delete a contact"""
    supabase.table("contacts").delete().eq("id", contact_id).eq("user_id", user.id).execute()
    return {"deleted": True}
