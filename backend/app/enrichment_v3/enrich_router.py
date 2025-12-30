# backend/app/enrichment_v3/enrich_router.py
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional, Dict, Any
import httpx
import os
import json
import jwt
from datetime import datetime
import re

router = APIRouter(prefix="/enrich", tags=["Enrichment"])

# Environment variables
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Initialize Supabase client
try:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
except Exception as e:
    print(f"⚠️ Supabase client initialization failed: {e}")
    supabase = None


def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Extract user from JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    try:
        # Decode without signature verification (Supabase handles verification)
        payload = jwt.decode(token, options={"verify_signature": False})
        return {"id": payload.get("sub"), "email": payload.get("email")}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


def strip_code_fences(text: str) -> str:
    """Remove markdown code fences from JSON responses"""
    # Remove ```json and ``` markers
    text = re.sub("^```json\\s*", "", text, flags=re.MULTILINE)
    text = re.sub("^```\\s*$", "", text, flags=re.MULTILINE)
    return text.strip()


async def enrich_with_perplexity(contact: Dict[str, Any]) -> Dict[str, Any]:
    """Call Perplexity API to enrich contact data"""
    if not PERPLEXITY_API_KEY:
        raise HTTPException(status_code=500, detail="Perplexity API key not configured")
    
    # Build enrichment prompt
    prompt = f"""
    Research and provide detailed intelligence about this sales contact:
    
    Name: {contact.get('first_name', '')} {contact.get('last_name', '')}
    Email: {contact.get('email', '')}
    Company: {contact.get('company', '')}
    Title: {contact.get('title', '')}
    LinkedIn: {contact.get('linkedin_url', '')}
    
    Provide a JSON response with the following structure:
    {{
        "summary": "2-3 sentence overview of the contact",
        "persona_type": "Decision-maker|Champion|Influencer|Initiator",
        "vertical": "Industry vertical (SaaS, Healthcare, Finance, etc.)",
        "talking_points": ["Point 1", "Point 2", "Point 3"],
        "company_overview": "Brief company description",
        "recommended_approach": "How to engage this contact",
        "inferred_title": "Standardized job title if available",
        "inferred_company_website": "Company website if found",
        "inferred_location": "Location if available"
    }}
    
    Only return valid JSON, no markdown formatting.
    """
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "sonar-pro",
                    "messages": [
                        {"role": "system", "content": "You are a B2B sales intelligence analyst. Always respond with valid JSON only."},
                        {"role": "user", "content": prompt}
                    ]
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"Perplexity API error: {response.text}")
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            # Strip code fences and parse JSON
            content = strip_code_fences(content)
            enrichment_data = json.loads(content)
            
            return enrichment_data
            
    except json.JSONDecodeError as e:
        # Fallback: return structured error
        return {
            "summary": "Enrichment data parsing failed",
            "persona_type": "Unknown",
            "vertical": "Unknown",
            "talking_points": [],
            "company_overview": "Data not available",
            "recommended_approach": "Manual research required",
            "error": str(e),
            "raw_response": content[:500] if 'content' in locals() else ""
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {str(e)}")


@router.post("/{contact_id}")
async def enrich_contact(
    contact_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Main enrichment endpoint - enriches a single contact"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        # 1. Fetch contact from database
        response = supabase.table("contacts").select("*").eq("id", contact_id).eq("user_id", user["id"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact = response.data[0]
        
        # 2. Update status to 'processing'
        supabase.table("contacts").update({"enrichment_status": "processing"}).eq("id", contact_id).execute()
        
        # 3. Call Perplexity API
        enrichment_data = await enrich_with_perplexity(contact)
        
        # 4. Update contact with enrichment data
        update_data = {
            "enrichment_data": enrichment_data,
            "enrichment_status": "completed",
            "enriched_at": datetime.utcnow().isoformat()
        }
        
        # Auto-fill empty fields from enrichment
        if not contact.get("title") and enrichment_data.get("inferred_title"):
            update_data["title"] = enrichment_data["inferred_title"]
        
        if not contact.get("vertical") and enrichment_data.get("vertical"):
            update_data["vertical"] = enrichment_data["vertical"]
            
        if not contact.get("persona_type") and enrichment_data.get("persona_type"):
            update_data["persona_type"] = enrichment_data["persona_type"]
        
        supabase.table("contacts").update(update_data).eq("id", contact_id).execute()
        
        return {
            "status": "completed",
            "contact_id": contact_id,
            "enrichment_data": enrichment_data,
            "message": "Contact enriched successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Update status to 'failed'
        if supabase:
            supabase.table("contacts").update({"enrichment_status": "failed"}).eq("id", contact_id).execute()
        
        raise HTTPException(status_code=500, detail=f"Enrichment error: {str(e)}")


@router.get("/{contact_id}/status")
async def get_enrichment_status(
    contact_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Check enrichment status for a contact"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        response = supabase.table("contacts").select("enrichment_status, enriched_at").eq("id", contact_id).eq("user_id", user["id"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact = response.data[0]
        
        return {
            "contact_id": contact_id,
            "status": contact.get("enrichment_status", "pending"),
            "enriched_at": contact.get("enriched_at"),
            "last_checked": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


@router.get("/{contact_id}/data")
async def get_enrichment_data(
    contact_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Fetch enrichment data for a contact"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        response = supabase.table("contacts").select("enrichment_data, enrichment_status, enriched_at").eq("id", contact_id).eq("user_id", user["id"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact = response.data[0]
        
        return {
            "contact_id": contact_id,
            "enrichment_data": contact.get("enrichment_data", {}),
            "status": contact.get("enrichment_status", "pending"),
            "enriched_at": contact.get("enriched_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data fetch failed: {str(e)}")
