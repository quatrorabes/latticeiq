from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import logging
import uuid


from app.core.auth import get_current_user
from app.core.database import get_db
from app.services.enrichment_v3.enricher import EnrichmentV3
from app.services.enrichment_v3.synthesizer import ProfileSynthesizer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v3/enrichment", tags=["enrichment"])

# Initialize services
enricher = EnrichmentV3()
synthesizer = ProfileSynthesizer()


class EnrichRequest(BaseModel):
    contact_id: int


class EnrichBatchRequest(BaseModel):
    contact_ids: list[int]


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "v3_parallel",
        "enricher_ready": True,
        "synthesizer_ready": True,
        "cache_enabled": True
    }

def extract_user_id(user: dict) -> str:
    """Safely extract and validate user_id from JWT"""
    user_id = user.get("sub") or user.get("id") or user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    try:
        return str(uuid.UUID(str(user_id)))
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID format")
        
        
@router.get("/contacts")
async def get_contacts(user: dict = Depends(get_current_user)):
    user_id = extract_user_id(user)
    result = supabase.table("contacts").select("*").eq("user_id", user_id).execute()
    return result.data


@router.post("/contacts")
async def create_contact(contact: ContactCreate, user: dict = Depends(get_current_user)):
    user_id = extract_user_id(user)
    data = contact.dict()
    data["user_id"] = user_id  # Attach validated UUID
    result = supabase.table("contacts").insert(data).execute()
    return result.data[0]


@router.post("/enrich")
async def enrich_contact(
    request: EnrichRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Enrich a single contact with V3 parallel architecture"""
    try:
        contact_id = request.contact_id
        user_id = current_user.get("sub") or current_user.get("id")
        
        # Fetch contact from database
        result = db.table("contacts").select("*").eq("id", contact_id).eq("user_id", user_id).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact = result.data  # This is a dict, not a function!
        
        # Update status to processing
        db.table("contacts").update({"enrichment_status": "processing"}).eq("id", contact_id).execute()
        
        # Run enrichment
        enrichment_result = await enricher.enrich(
            name=f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip(),
            company=contact.get("company", ""),
            title=contact.get("title", ""),
            email=contact.get("email", ""),
            linkedin_url=contact.get("linkedin_url", "")
        )
        
        # Synthesize profile
        profile = await synthesizer.synthesize(enrichment_result)
        
        # Update contact with enrichment data
        update_data = {
            "enrichment_status": "completed",
            "enrichment_data": profile,
            "enriched_at": "now()",
            "apex_score": profile.get("scores", {}).get("apex_score"),
            "mdcp_score": profile.get("scores", {}).get("mdcp_score"),
            "rss_score": profile.get("scores", {}).get("rss_score")
        }
        
        db.table("contacts").update(update_data).eq("id", contact_id).execute()
        
        return {
            "enrichment_id": f"enr_{contact_id}",
            "contact_id": contact_id,
            "status": "completed",
            "message": "Enrichment complete"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enrichment failed: {str(e)}")
        # Update status to failed
        try:
            db.table("contacts").update({"enrichment_status": "failed"}).eq("id", request.contact_id).execute()
        except:
            pass
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enrich/batch")
async def enrich_batch(
    request: EnrichBatchRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Enrich multiple contacts"""
    results = []
    for contact_id in request.contact_ids:
        try:
            result = await enrich_contact(
                EnrichRequest(contact_id=contact_id),
                current_user,
                db
            )
            results.append(result)
        except Exception as e:
            results.append({
                "contact_id": contact_id,
                "status": "failed",
                "error": str(e)
            })
    return results


@router.get("/enrich/{contact_id}/status")
async def get_enrichment_status(
    contact_id: int,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get enrichment status for a contact"""
    user_id = current_user.get("sub") or current_user.get("id")
    
    result = db.table("contacts").select("enrichment_status, enrichment_data").eq("id", contact_id).eq("user_id", user_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact = result.data
    status = contact.get("enrichment_status", "pending")
    
    return {
        "enrichment_id": f"enr_{contact_id}",
        "contact_id": contact_id,
        "status": status,
        "progress": 100 if status == "completed" else 0,
        "domains_completed": ["COMPANY", "PERSON", "INDUSTRY", "NEWS", "OPEN_ENDED"] if status == "completed" else [],
        "domains_pending": [] if status == "completed" else ["COMPANY", "PERSON", "INDUSTRY", "NEWS", "OPEN_ENDED"]
    }


@router.get("/enrich/{contact_id}/profile")
async def get_enrichment_profile(
    contact_id: int,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get enriched profile for a contact"""
    user_id = current_user.get("sub") or current_user.get("id")
    
    result = db.table("contacts").select("*").eq("id", contact_id).eq("user_id", user_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact = result.data
    
    return {
        "contact_id": contact_id,
        "profile": contact.get("enrichment_data", {}),
        "scores": {
            "apex_score": contact.get("apex_score"),
            "mdcp_score": contact.get("mdcp_score"),
            "rss_score": contact.get("rss_score"),
            "bant_score": contact.get("bant_score"),
            "spice_score": contact.get("spice_score")
        },
        "enriched_at": contact.get("enriched_at")
    }


@router.post("/cache/clear")
async def clear_cache(current_user: dict = Depends(get_current_user)):
    """Clear enrichment cache"""
    enricher.clear_cache()
    return {"status": "cache_cleared"}
