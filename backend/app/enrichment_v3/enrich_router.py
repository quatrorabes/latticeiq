# ============================================================================
# FILE: backend/app/enrichment_v3/enrich_router.py
# PURPOSE: Contact Enrichment API - Perplexity AI enrichment
# ============================================================================

import os
import json
import logging
from typing import Any, Dict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header
import httpx
from supabase import create_client

logger = logging.getLogger("latticeiq")

# ============================================================================
# LAZY LOAD SUPABASE CLIENT
# ============================================================================

supabase = None

def get_supabase():
    """Lazy initialize Supabase client"""
    global supabase
    if supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        if url and key:
            supabase = create_client(url, key)
    return supabase

# ============================================================================
# PERPLEXITY CONFIG
# ============================================================================

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
PERPLEXITY_MODEL = os.getenv("PERPLEXITY_MODEL", "sonar-pro")

# ============================================================================
# AUTH DEPENDENCY
# ============================================================================

async def get_current_user(authorization: str = Header(None)) -> dict:
    """Validate Supabase JWT"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")

        client = get_supabase()
        if not client:
            raise HTTPException(status_code=503, detail="Database not configured")

        user_resp = client.auth.get_user(token)
        user = getattr(user_resp, "user", None) or user_resp.get("user") if isinstance(user_resp, dict) else None

        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = getattr(user, "id", None) or user.get("id")
        email = getattr(user, "email", None) or user.get("email") or ""

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user id")

        return {"id": str(user_id), "email": str(email)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(prefix="/enrich", tags=["Enrichment"])

def strip_code_fences(content: str) -> str:
    """Remove markdown code fences from AI response"""
    content = content.strip()
    backtick = chr(96)
    fence = backtick * 3
    fence_json = f"{fence}json"
    
    if content.startswith(fence_json):
        content = content[len(fence_json):].lstrip()
    elif content.startswith(fence):
        content = content[len(fence):].lstrip()
    
    if content.endswith(fence):
        content = content[:-len(fence)].rstrip()
    
    return content.strip()

# POST /api/v3/enrich/{contact_id} - Enrich single contact
@router.post("/{contact_id}")
async def enrich_contact(contact_id: str, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Enrich a contact using Perplexity AI"""
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not configured")

    if not PERPLEXITY_API_KEY:
        raise HTTPException(status_code=503, detail="Perplexity API key not configured")

    try:
        user_id = user["id"]
        
        # Fetch contact
        result = client.table("contacts").select("*").eq("id", contact_id).eq("userid", user_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact = result.data
        
        # Mark as processing
        client.table("contacts").update({"enrichmentstatus": "processing"}).eq("id", contact_id).execute()
        
        # Build prompt
        name = f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip()
        company = contact.get("company") or "Unknown Company"
        title = contact.get("jobtitle") or contact.get("title") or ""
        email = contact.get("email") or ""
        linkedin = contact.get("linkedinurl") or ""
        
        prompt = f"""Research this business contact and provide sales intelligence

Name: {name}
Company: {company}
Title: {title}
Email: {email}
LinkedIn: {linkedin}

Provide a JSON response with these fields:
- summary: 2-3 sentence professional summary
- company_overview: Brief description of company
- talking_points: 3-5 conversation starters
- inferred_title: Their likely job title
- inferred_seniority: Executive/Director/Manager/Individual Contributor
- persona_type: Decision-maker/Champion/Influencer/Blocker
- vertical: Industry vertical
- company_size: Startup/SMB/Mid-Market/Enterprise
- recent_news: Any recent company news
- recommended_approach: Best way to engage

Return ONLY valid JSON, no markdown."""
        
        # Call Perplexity API
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            response = await http_client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": PERPLEXITY_MODEL,
                    "messages": [
                        {"role": "system", "content": "You are a sales intelligence researcher. Return only valid JSON."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 1500,
                },
            )
            
            if response.status_code != 200:
                logger.error(f"Perplexity API error {response.status_code}: {response.text}")
                raise HTTPException(status_code=502, detail="Enrichment service error")
            
            data = response.json()
            raw_content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        # Parse response
        content = strip_code_fences(raw_content)
        try:
            enrichment_data = json.loads(content)
        except json.JSONDecodeError:
            enrichment_data = {"raw_response": raw_content, "parse_error": True}
        
        # Update contact
        update_data = {
            "enrichmentstatus": "completed",
            "enrichmentdata": enrichment_data,
            "enrichedat": datetime.utcnow().isoformat(),
        }
        
        if not contact.get("jobtitle") and enrichment_data.get("inferred_title"):
            update_data["jobtitle"] = enrichment_data["inferred_title"]
        
        if enrichment_data.get("persona_type"):
            update_data["personatype"] = enrichment_data["persona_type"]
        
        if enrichment_data.get("vertical"):
            update_data["vertical"] = enrichment_data["vertical"]
        
        client.table("contacts").update(update_data).eq("id", contact_id).execute()
        logger.info(f"Enriched contact {contact_id}", extra={"userid": user_id})
        
        return {
            "success": True,
            "contact_id": contact_id,
            "status": "completed",
            "enrichmentdata": enrichment_data,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enrichment failed for {contact_id}: {str(e)}")
        client.table("contacts").update({"enrichmentstatus": "failed"}).eq("id", contact_id).execute()
        raise HTTPException(status_code=500, detail=str(e))

# GET /api/v3/enrich/{contact_id}/status - Check enrichment status
@router.get("/{contact_id}/status")
async def get_enrichment_status(contact_id: str, user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Get enrichment status for a contact"""
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        user_id = user["id"]
        result = client.table("contacts").select("id, enrichmentstatus, enrichmentdata, enrichedat").eq("id", contact_id).eq("userid", user_id).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        return {
            "contact_id": contact_id,
            "status": result.data.get("enrichmentstatus", "pending"),
            "enrichmentdata": result.data.get("enrichmentdata"),
            "enrichedat": result.data.get("enrichedat"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting enrichment status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
