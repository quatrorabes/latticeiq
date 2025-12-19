# backend/enrichment_v3/api_routes.py
import os
import json
import traceback
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Callable
from supabase import create_client, Client

router = APIRouter(prefix="/api/v3/enrichment", tags=["enrichment"])

# Auth dependency - will be injected by main.py
_auth_dependency: Optional[Callable] = None

def set_auth_dependency(dep: Callable):
    global _auth_dependency
    _auth_dependency = dep
    print(f"[ENRICHMENT] Auth dependency set: {dep}")

# Lazy Supabase client
_supabase_client: Optional[Client] = None

def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        print(f"[ENRICHMENT] Initializing Supabase - URL exists: {bool(url)}, KEY exists: {bool(key)}")
        if not url or not key:
            raise HTTPException(status_code=500, detail="Supabase not configured")
        _supabase_client = create_client(url, key)
    return _supabase_client

# Output directory
OUTPUT_DIR = os.getenv("ENRICHMENT_OUTPUT_DIR", "/tmp/enrichment_outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)


class EnrichRequest(BaseModel):
    contact_id: int
    synthesize: bool = True


def generate_enrichment_txt(contact: dict, enrichment_data: dict, output_path: str) -> str:
    """Generate a TXT file with enrichment results"""
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    filename = f"enrichment_{contact.get('id')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    filepath = os.path.join(output_path, filename)
    
    lines = [
        "=" * 60,
        "LATTICEIQ ENRICHMENT REPORT",
        "=" * 60,
        f"Generated: {timestamp}",
        "",
        "-" * 60,
        "CONTACT INFORMATION",
        "-" * 60,
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
        f"MDCP Score: {contact.get('mdcp_score', 'N/A')}",
        f"RSS Score: {contact.get('rss_score', 'N/A')}",
        "",
    ]
    
    if enrichment_data:
        synthesized = enrichment_data.get("synthesized", {})
        
        if synthesized:
            lines.extend([
                "-" * 60,
                "EXECUTIVE SUMMARY",
                "-" * 60,
                str(synthesized.get("summary", "No summary available")),
                "",
                "-" * 60,
                "OPENING LINE",
                "-" * 60,
                str(synthesized.get("opening_line", "N/A")),
                "",
                "-" * 60,
                "TALKING POINTS",
                "-" * 60,
            ])
            
            talking_points = synthesized.get("talking_points", [])
            if talking_points:
                for i, point in enumerate(talking_points, 1):
                    lines.append(f"  {i}. {point}")
    
    lines.extend([
        "",
        "=" * 60,
        "END OF REPORT",
        "=" * 60,
    ])
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    
    return filepath


@router.post("/enrich")
async def enrich_contact(request: EnrichRequest, req: Request):
    """Enrich a single contact and generate TXT output file"""
    
    print(f"[ENRICHMENT] Starting enrichment for contact_id: {request.contact_id}")
    
    try:
        # Get user from auth dependency
        if _auth_dependency is None:
            print("[ENRICHMENT] ERROR: Auth dependency not set")
            raise HTTPException(status_code=500, detail="Auth not configured")
        
        # Call the auth dependency manually
        user = await _auth_dependency(req)
        print(f"[ENRICHMENT] User from auth: {user}")
        
        # Extract user_id - try multiple possible keys
        user_id = None
        if isinstance(user, dict):
            user_id = user.get("sub") or user.get("user_id") or user.get("id")
        elif hasattr(user, "sub"):
            user_id = user.sub
        
        print(f"[ENRICHMENT] Extracted user_id: {user_id}")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        # Get Supabase client
        supabase = get_supabase()
        
        # Fetch contact
        print(f"[ENRICHMENT] Fetching contact {request.contact_id} for user {user_id}")
        result = supabase.table("contacts").select("*").eq("id", request.contact_id).eq("user_id", user_id).execute()
        
        if not result.data:
            print(f"[ENRICHMENT] Contact not found")
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact = result.data[0]
        print(f"[ENRICHMENT] Found contact: {contact.get('first_name')} {contact.get('last_name')}")
        
        # Update status to processing
        supabase.table("contacts").update({
            "enrichment_status": "processing"
        }).eq("id", request.contact_id).execute()
        
        # Run enrichment
        print("[ENRICHMENT] Starting enrichment engine...")
        from .routes import EnrichmentEngine
        engine = EnrichmentEngine()
        
        enrichment_result = await engine.enrich(
            name=f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or "Unknown",
            email=contact.get("email"),
            company=contact.get("company"),
            title=contact.get("title"),
            linkedin_url=contact.get("linkedin_url"),
            synthesize=request.synthesize
        )
        
        print("[ENRICHMENT] Enrichment complete, generating TXT file...")
        
        # Generate TXT file
        txt_filepath = generate_enrichment_txt(contact, enrichment_result, OUTPUT_DIR)
        
        # Prepare update data
        update_data = {
            "enrichment_status": "completed",
            "enrichment_data": enrichment_result,
            "enriched_at": datetime.utcnow().isoformat(),
            "enrichment_txt_path": txt_filepath
        }
        
        # Extract scores if synthesized
        if request.synthesize and "synthesized" in enrichment_result:
            scores = enrichment_result["synthesized"].get("scores", {})
            if scores.get("apex"):
                update_data["apex_score"] = scores.get("apex")
            if scores.get("mdcp"):
                update_data["mdcp_score"] = scores.get("mdcp")
            if scores.get("rss"):
                update_data["rss_score"] = scores.get("rss")
        
        print("[ENRICHMENT] Updating contact in database...")
        supabase.table("contacts").update(update_data).eq("id", request.contact_id).execute()
        
        print("[ENRICHMENT] Success!")
        return {
            "success": True,
            "contact_id": request.contact_id,
            "status": "completed",
            "txt_file": txt_filepath,
            "enrichment_data": enrichment_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ENRICHMENT] ERROR: {str(e)}")
        print(f"[ENRICHMENT] Traceback: {traceback.format_exc()}")
        
        # Try to update status to failed
        try:
            supabase = get_supabase()
            supabase.table("contacts").update({
                "enrichment_status": "failed"
            }).eq("id", request.contact_id).execute()
        except:
            pass
        
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/enrich/{contact_id}/status")
async def get_enrichment_status(contact_id: int, req: Request):
    """Get enrichment status for a contact"""
    
    try:
        if _auth_dependency is None:
            raise HTTPException(status_code=500, detail="Auth not configured")
        
        user = await _auth_dependency(req)
        user_id = user.get("sub") or user.get("user_id") or user.get("id") if isinstance(user, dict) else getattr(user, "sub", None)
        
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        supabase = get_supabase()
        result = supabase.table("contacts").select(
            "enrichment_status, enriched_at, apex_score, enrichment_txt_path"
        ).eq("id", contact_id).eq("user_id", user_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact = result.data[0]
        
        return {
            "contact_id": contact_id,
            "status": contact.get("enrichment_status"),
            "enriched_at": contact.get("enriched_at"),
            "apex_score": contact.get("apex_score"),
            "has_txt_file": bool(contact.get("enrichment_txt_path"))
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ENRICHMENT STATUS] ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/enrich/{contact_id}/download")
async def download_enrichment_txt(contact_id: int, req: Request):
    """Download the enrichment TXT file"""
    
    try:
        if _auth_dependency is None:
            raise HTTPException(status_code=500, detail="Auth not configured")
        
        user = await _auth_dependency(req)
        user_id = user.get("sub") or user.get("user_id") or user.get("id") if isinstance(user, dict) else getattr(user, "sub", None)
        
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        supabase = get_supabase()
        result = supabase.table("contacts").select(
            "enrichment_txt_path, first_name, last_name"
        ).eq("id", contact_id).eq("user_id", user_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact = result.data[0]
        txt_path = contact.get("enrichment_txt_path")
        
        if not txt_path or not os.path.exists(txt_path):
            raise HTTPException(status_code=404, detail="Enrichment file not found")
        
        filename = f"enrichment_{contact.get('first_name', '')}_{contact.get('last_name', '')}.txt"
        
        return FileResponse(path=txt_path, filename=filename, media_type="text/plain")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ENRICHMENT DOWNLOAD] ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "enrichment_v3"}
