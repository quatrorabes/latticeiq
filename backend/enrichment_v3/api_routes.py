"""
LatticeIQ Enrichment V3 - API Routes
FastAPI endpoints with Supabase integration
"""
import json
import logging
import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from pydantic import BaseModel
from jose import jwt, JWTError
from supabase import create_client

from .parallel_enricher import ParallelEnricher, EnrichmentResult
from .synthesizer import EnrichmentSynthesizer, profile_to_dict
from .query_templates import QueryDomain

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v3/enrichment", tags=["Enrichment V3"])

# Supabase client
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# ═══════════════════════════════════════════════════════════════════════════════
# AUTH & UUID HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _get_bearer_token(request: Request) -> str:
    auth = request.headers.get("Authorization") or ""
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    return auth.split(" ", 1)[1].strip()

async def get_current_user(request: Request) -> dict:
    """
    Extract and validate JWT from Authorization header.
    Returns the full decoded JWT payload as a dict.
    """
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
    """
    Safely extract and validate user_id (UUID) from JWT payload.
    
    Supabase JWT structure:
    - 'sub': The user's UUID (primary)
    - 'id': Sometimes present
    - 'user_id': Custom claims
    
    Returns validated UUID as string for Supabase queries.
    """
    user_id = user.get("sub") or user.get("id") or user.get("user_id")
    
    if not user_id:
        logger.error(f"No user_id found in token. Keys: {list(user.keys())}")
        raise HTTPException(status_code=401, detail="User ID not found in token")
    
    # Validate UUID format
    try:
        validated = uuid.UUID(str(user_id))
        return str(validated)  # Return lowercase, properly formatted UUID string
    except (ValueError, TypeError) as e:
        logger.error(f"Invalid UUID format: {user_id}, error: {e}")
        raise HTTPException(status_code=401, detail="Invalid user ID format")


# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class EnrichRequest(BaseModel):
    contact_id: int
    domains: Optional[List[str]] = None
    skip_cache: bool = False
    synthesize: bool = True

class BatchEnrichRequest(BaseModel):
    contact_ids: Optional[List[int]] = None
    limit: int = 10
    domains: Optional[List[str]] = None
    synthesize: bool = True

# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON INSTANCES
# ═══════════════════════════════════════════════════════════════════════════════

_enricher: Optional[ParallelEnricher] = None
_synthesizer: Optional[EnrichmentSynthesizer] = None

def get_enricher() -> ParallelEnricher:
    global _enricher
    if _enricher is None:
        _enricher = ParallelEnricher(max_concurrent=3, enable_cache=True)
    return _enricher

def get_synthesizer() -> EnrichmentSynthesizer:
    global _synthesizer
    if _synthesizer is None:
        _synthesizer = EnrichmentSynthesizer()
    return _synthesizer

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/enrich")
async def enrich_contact_v3(request: EnrichRequest, user: dict = Depends(get_current_user)):
    """
    V3 Parallel Enrichment - Single Contact
    Executes 5 parallel Perplexity queries + GPT-4 synthesis
    """
    try:
        user_id = extract_user_id(user)
        
        # Get contact (with user_id filter for security)
        result = supabase.table("contacts").select("*").eq("id", request.contact_id).eq("user_id", user_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")

        contact = result.data[0]

        # Update status
        supabase.table("contacts").update({
            "enrichment_status": "enriching"
        }).eq("id", request.contact_id).execute()

        # Parse domains
        domains = None
        if request.domains:
            domains = [QueryDomain(d) for d in request.domains]

        # Execute parallel enrichment
        enricher = get_enricher()
        if request.skip_cache:
            enricher.cache.clear()

        enrichment_result = await enricher.enrich_contact(
            contact=contact,
            contact_id=request.contact_id,
            domains=domains
        )

        # Synthesize
        synthesized = None
        if request.synthesize and enrichment_result.success:
            synthesizer = get_synthesizer()
            profile = await synthesizer.synthesize(enrichment_result, contact)
            synthesized = profile_to_dict(profile)

        # Save to database
        enrichment_data = {
            "v3_parallel": True,
            "queries_executed": enrichment_result.queries_executed,
            "queries_cached": enrichment_result.queries_cached,
            "latency_ms": enrichment_result.total_latency_ms,
            "raw_results": {
                k: {"success": v.success, "latency_ms": v.latency_ms, "content": v.content[:500] if v.content else ""}
                for k, v in enrichment_result.query_results.items()
            },
            "synthesized": synthesized
        }

        update_data = {
            "enrichment_status": "enriched",
            "enrichment_data": enrichment_data,
            "enriched_at": datetime.now().isoformat()
        }

        # Add scores if synthesized
        if synthesized:
            update_data["apex_score"] = synthesized.get("apex_score")
            update_data["bant_budget"] = synthesized.get("bant_budget")
            update_data["bant_authority"] = synthesized.get("bant_authority")
            update_data["bant_need"] = synthesized.get("bant_need")
            update_data["bant_timing"] = synthesized.get("bant_timing")

        supabase.table("contacts").update(update_data).eq("id", request.contact_id).execute()

        return {
            "success": True,
            "contact_id": request.contact_id,
            "enrichment_id": f"enr_{request.contact_id}",
            "status": "completed",
            "message": "Enrichment complete",
            "version": "v3_parallel",
            "metrics": {
                "total_latency_ms": enrichment_result.total_latency_ms,
                "queries_executed": enrichment_result.queries_executed,
                "queries_cached": enrichment_result.queries_cached,
                "queries_succeeded": sum(1 for r in enrichment_result.query_results.values() if r.success)
            },
            "synthesized_profile": synthesized
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"V3 Enrichment error: {e}")
        supabase.table("contacts").update({
            "enrichment_status": "failed"
        }).eq("id", request.contact_id).execute()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enrich/batch")
async def batch_enrich_v3(request: BatchEnrichRequest, user: dict = Depends(get_current_user)):
    """Batch V3 Enrichment - Multiple Contacts"""
    try:
        user_id = extract_user_id(user)
        
        # Get contacts to enrich
        if request.contact_ids:
            result = supabase.table("contacts").select("*").eq("user_id", user_id).in_("id", request.contact_ids).execute()
        else:
            result = supabase.table("contacts").select("*").eq("user_id", user_id).eq("enrichment_status", "pending").limit(request.limit).execute()

        if not result.data:
            return {"success": True, "message": "No contacts to enrich", "enriched": 0}

        contacts = result.data
        enricher = get_enricher()
        synthesizer = get_synthesizer()

        domains = [QueryDomain(d) for d in request.domains] if request.domains else None

        enriched_count = 0
        failed_count = 0
        results = []

        for contact in contacts:
            try:
                # Update status
                supabase.table("contacts").update({
                    "enrichment_status": "enriching"
                }).eq("id", contact["id"]).execute()

                # Enrich
                enrichment_result = await enricher.enrich_contact(
                    contact=contact,
                    contact_id=contact["id"],
                    domains=domains
                )

                # Synthesize
                synthesized = None
                if request.synthesize and enrichment_result.success:
                    profile = await synthesizer.synthesize(enrichment_result, contact)
                    synthesized = profile_to_dict(profile)

                # Save
                enrichment_data = {
                    "v3_parallel": True,
                    "queries_executed": enrichment_result.queries_executed,
                    "latency_ms": enrichment_result.total_latency_ms,
                    "synthesized": synthesized
                }

                update_data = {
                    "enrichment_status": "enriched",
                    "enrichment_data": enrichment_data,
                    "enriched_at": datetime.now().isoformat()
                }

                if synthesized:
                    update_data["apex_score"] = synthesized.get("apex_score")
                    update_data["bant_budget"] = synthesized.get("bant_budget")
                    update_data["bant_authority"] = synthesized.get("bant_authority")
                    update_data["bant_need"] = synthesized.get("bant_need")
                    update_data["bant_timing"] = synthesized.get("bant_timing")

                supabase.table("contacts").update(update_data).eq("id", contact["id"]).execute()

                enriched_count += 1
                results.append({
                    "contact_id": contact["id"],
                    "success": True,
                    "apex_score": synthesized.get("apex_score") if synthesized else None
                })

            except Exception as e:
                logger.error(f"Failed to enrich contact {contact['id']}: {e}")
                supabase.table("contacts").update({
                    "enrichment_status": "failed"
                }).eq("id", contact["id"]).execute()
                failed_count += 1
                results.append({
                    "contact_id": contact["id"],
                    "success": False,
                    "error": str(e)
                })

        return {
            "success": True,
            "enriched": enriched_count,
            "failed": failed_count,
            "total": len(contacts),
            "results": results
        }

    except Exception as e:
        logger.error(f"Batch enrichment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/enrich/{contact_id}/status")
async def get_enrichment_status(contact_id: int, user: dict = Depends(get_current_user)):
    """Get enrichment status for a contact"""
    user_id = extract_user_id(user)
    result = supabase.table("contacts").select("enrichment_status, enrichment_data").eq("id", contact_id).eq("user_id", user_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact = result.data[0]
    status = contact.get("enrichment_status", "pending")
    
    # Map internal status to frontend expected status
    status_map = {"enriched": "completed", "enriching": "processing"}
    mapped_status = status_map.get(status, status)
    
    return {
        "enrichment_id": f"enr_{contact_id}",
        "contact_id": contact_id,
        "status": mapped_status,
        "progress": 100 if mapped_status == "completed" else 0,
        "domains_completed": ["COMPANY", "PERSON", "INDUSTRY", "NEWS", "OPEN_ENDED"] if mapped_status == "completed" else [],
        "domains_pending": [] if mapped_status == "completed" else ["COMPANY", "PERSON", "INDUSTRY", "NEWS", "OPEN_ENDED"]
    }


@router.get("/enrich/{contact_id}/profile")
async def get_contact_profile(contact_id: int, user: dict = Depends(get_current_user)):
    """Get enriched profile for a contact"""
    user_id = extract_user_id(user)
    result = supabase.table("contacts").select("*").eq("id", contact_id).eq("user_id", user_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact = result.data[0]
    enrichment_data = contact.get("enrichment_data", {})

    if not enrichment_data:
        raise HTTPException(status_code=404, detail="Contact not enriched yet")

    return {
        "contact_id": contact_id,
        "name": f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip(),
        "company": contact.get("company"),
        "title": contact.get("title"),
        "apex_score": contact.get("apex_score"),
        "enrichment_status": contact.get("enrichment_status"),
        "profile": enrichment_data.get("synthesized", {}),
        "enriched_at": contact.get("enriched_at")
    }

from .profile_parser import ProfileParser

@router.post('/parse-profile/{contact_id}')
async def parse_contact_profile(
    contact_id: int,
    user: dict = Depends(get_current_user),
    db = Depends(get_db)
) -> dict:
    """Parse enrichment data into structured contact profile."""
    userid = extract_user_id(user)
    
    result = supabase.table('contacts').select(
        'enrichment_data'
    ).eq('id', contact_id).eq('user_id', userid).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail='Contact not found')
        
    enrichment_data = result.data[0].get('enrichment_data', {})
    
    parser = ProfileParser(enrichment_data)
    profile = parser.to_profile()
    
    # Save parsed profile back to contact
    supabase.table('contacts').update({
        'parsed_profile': profile
    }).eq('id', contact_id).execute()

    return {
        'success': True,
        'contact_id': contact_id,
        'profile': profile,
    }


@router.post("/cache/clear")
async def clear_enrichment_cache(user: dict = Depends(get_current_user)):
    """Clear the enrichment cache"""
    _ = extract_user_id(user)  # Validate auth
    enricher = get_enricher()
    enricher.cache.clear()
    return {"success": True, "message": "Cache cleared"}


@router.get("/health")
async def enrichment_health():
    """Health check - no auth required"""
    try:
        enricher = get_enricher()
        synthesizer = get_synthesizer()
        return {
            "status": "healthy",
            "version": "v3_parallel",
            "enricher_ready": enricher is not None,
            "synthesizer_ready": synthesizer is not None,
            "cache_enabled": enricher.cache is not None
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
    