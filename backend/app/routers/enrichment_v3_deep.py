# backend/app/routers/enrichment_v3_deep.py

"""
Deep Enrichment API - Perplexity + GPT-4 Pipeline
"""

import os
import requests
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Header
from supabase import create_client, Client
from pydantic import BaseModel
import openai
import logging

logger = logging.getLogger(__name__)

# Initialize clients
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

supabase: Optional[Client] = None
openai_client = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("✅ Supabase connected")
    except Exception as e:
        logger.error(f"❌ Supabase failed: {e}")

if OPENAI_API_KEY:
    openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)
    logger.info("✅ OpenAI connected")

router = APIRouter(prefix="/enrichment", tags=["Deep Enrichment"])


class DeepEnrichRequest(BaseModel):
    contact_name: str
    company_name: str
    title: str
    email: Optional[str] = None
    linkedin_url: Optional[str] = None


class DeepEnrichResponse(BaseModel):
    success: bool
    job_id: Optional[str] = None
    status: str
    contact_id: str
    profile: Optional[dict] = None
    error: Optional[str] = None


def build_perplexity_query(name: str, title: str, company: str, linkedin_url: str = None) -> str:
    """Build research query for Perplexity."""
    context = f"{name}, {title} at {company}"
    if linkedin_url:
        context += f". LinkedIn: {linkedin_url}"
    
    return f"""{context}

You are a professional profile-building assistant. Generate an up-to-date profile using public web sources.

For the PERSON ({name}):
1. Overview - Current title and organization
2. Background - Work history, notable achievements
3. Education - Degrees and institutions
4. Recent Activity - News, LinkedIn posts, speaking engagements
5. Social Profiles - LinkedIn, Twitter, etc.

For the COMPANY ({company}):
1. Overview - Description, mission, founding, HQ
2. Products/Services - Key offerings
3. Leadership - Key executives
4. Market Position - Industry, competitors
5. Recent News - Announcements, funding, deals

STRATEGIC INTELLIGENCE:
- Pain Points: 5 specific challenges someone in {name}'s role faces
- Key Insights: 3 non-obvious insights valuable for business conversation

Be specific and cite sources where possible."""


def call_perplexity(query: str) -> Optional[str]:
    """Call Perplexity API for research."""
    if not PERPLEXITY_API_KEY:
        logger.error("No Perplexity API key")
        return None
    
    try:
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "sonar-pro",
                "messages": [{"role": "user", "content": query}]
            },
            timeout=60
        )
        
        if response.status_code == 200:
            data = response.json()
            return data["choices"][0]["message"]["content"]
        else:
            logger.error(f"Perplexity error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"Perplexity request failed: {e}")
        return None


def polish_with_gpt4(raw_profile: str, name: str, title: str, company: str) -> Optional[str]:
    """Polish raw research into sales-ready dossier."""
    if not openai_client:
        logger.error("No OpenAI client")
        return None
    
    prompt = f"""Transform this research into a polished, sales-ready professional dossier.

Contact: {name}, {title} at {company}

Raw Research:
{raw_profile}

Create a structured dossier with these exact sections:

## PROFESSIONAL PROFILE: {name.upper()}

### 1. Overview
[Current role, organization, key responsibilities]

### 2. Background  
[Career history, achievements, expertise areas]

### 3. Education
[Degrees, institutions, certifications]

### 4. Recent Activity
[News, posts, speaking, awards]

---

## COMPANY PROFILE: {company.upper()}

### 1. Overview
[Description, mission, founding, size, location]

### 2. Products & Services
[Key offerings, markets served]

### 3. Leadership
[Key executives]

### 4. Market Position
[Industry, competitors, differentiation]

### 5. Recent News
[Announcements, deals, funding]

---

## STRATEGIC INTELLIGENCE

### Pain Points
[5 specific challenges for someone in this role]

### Talking Points
[5 conversation starters for sales outreach]

### Key Insights
[3 non-obvious insights for business conversation]

Format with markdown. Be specific and actionable."""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": "You are a professional business intelligence analyst creating sales-ready dossiers."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=4000
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"GPT-4 polish failed: {e}")
        return None


@router.post("/deep-enrich/{contact_id}", response_model=DeepEnrichResponse)
async def deep_enrich_contact(
    contact_id: str,
    request: DeepEnrichRequest,
    x_workspace_id: str = Header(None),
):
    """
    Execute deep enrichment: Perplexity research → GPT-4 polish.
    Returns full profile synchronously.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")
    
    if not x_workspace_id:
        raise HTTPException(status_code=401, detail="Missing x-workspace-id")
    
    if not PERPLEXITY_API_KEY:
        raise HTTPException(status_code=503, detail="Perplexity API not configured")
    
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OpenAI API not configured")
    
    # Create job record
    try:
        job_response = supabase.table("enrichment_deep_jobs").insert({
            "contact_id": contact_id,
            "workspace_id": x_workspace_id,
            "status": "processing",
        }).execute()
        
        job_id = job_response.data[0]["id"] if job_response.data else None
    except Exception as e:
        logger.error(f"Failed to create job: {e}")
        job_id = None
    
    # Stage 1: Perplexity Research
    logger.info(f"Stage 1: Perplexity research for {request.contact_name}")
    query = build_perplexity_query(
        request.contact_name,
        request.title,
        request.company_name,
        request.linkedin_url
    )
    
    raw_profile = call_perplexity(query)
    
    if not raw_profile:
        # Update job status
        if job_id:
            supabase.table("enrichment_deep_jobs").update({
                "status": "failed",
                "error_message": "Perplexity research failed"
            }).eq("id", job_id).execute()
        
        return DeepEnrichResponse(
            success=False,
            job_id=job_id,
            status="failed",
            contact_id=contact_id,
            error="Perplexity research failed"
        )
    
    # Stage 2: GPT-4 Polish
    logger.info(f"Stage 2: GPT-4 polishing for {request.contact_name}")
    polished_profile = polish_with_gpt4(
        raw_profile,
        request.contact_name,
        request.title,
        request.company_name
    )
    
    if not polished_profile:
        polished_profile = raw_profile  # Fallback to raw
    
    # Update job and contact
    if job_id:
        supabase.table("enrichment_deep_jobs").update({
            "status": "completed",
            "raw_profile": raw_profile,
            "polished_profile": polished_profile,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", job_id).execute()
    
    # Update contact with enrichment data
    try:
        supabase.table("contacts").update({
            "enrichment_full_profile": polished_profile,
            "enrichment_last_deep_enriched_at": datetime.utcnow().isoformat(),
            "enrichment_deep_quality_score": 85,  # Default good score
            "enrichment_status": "enriched"
        }).eq("id", contact_id).execute()
    except Exception as e:
        logger.warning(f"Failed to update contact: {e}")
    
    return DeepEnrichResponse(
        success=True,
        job_id=job_id,
        status="completed",
        contact_id=contact_id,
        profile={
            "raw": raw_profile[:500] + "..." if len(raw_profile) > 500 else raw_profile,
            "polished": polished_profile,
            "generated_at": datetime.utcnow().isoformat()
        }
    )


@router.get("/deep-enrich/{contact_id}/status")
async def get_enrichment_status(
    contact_id: str,
    x_workspace_id: str = Header(None),
):
    """Get deep enrichment job status and result."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Service unavailable")
    
    if not x_workspace_id:
        raise HTTPException(status_code=401, detail="Missing x-workspace-id")
    
    try:
        result = supabase.table("enrichment_deep_jobs").select("*").eq(
            "contact_id", contact_id
        ).eq("workspace_id", x_workspace_id).order(
            "created_at", desc=True
        ).limit(1).execute()
        
        if result.data:
            job = result.data[0]
            return {
                "success": True,
                "job_id": job.get("id"),
                "status": job.get("status"),
                "polished_profile": job.get("polished_profile"),
                "completed_at": job.get("completed_at"),
            }
        
        return {"success": False, "status": "not_found"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/deep-profile/{contact_id}")
async def get_deep_profile(
    contact_id: str,
    x_workspace_id: str = Header(None),
):
    """Get the stored deep profile for a contact."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Service unavailable")
    
    if not x_workspace_id:
        raise HTTPException(status_code=401, detail="Missing x-workspace-id")
    
    try:
        result = supabase.table("contacts").select(
            "id, first_name, last_name, company, job_title, enrichment_full_profile, enrichment_last_deep_enriched_at"
        ).eq("id", contact_id).eq("workspace_id", x_workspace_id).execute()
        
        if result.data:
            contact = result.data[0]
            return {
                "success": True,
                "contact_id": contact_id,
                "name": f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
                "company": contact.get("company"),
                "title": contact.get("job_title"),
                "profile": contact.get("enrichment_full_profile"),
                "last_enriched": contact.get("enrichment_last_deep_enriched_at"),
            }
        
        return {"success": False, "error": "Contact not found"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
