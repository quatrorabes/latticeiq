# backend/enrichment_v3/api_routes.py
import os
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Callable
from supabase import create_client, Client

router = APIRouter(prefix="/api/v3/enrichment", tags=["enrichment"])

# Auth dependency - will be set by main.py
_auth_dependency: Optional[Callable] = None

def set_auth_dependency(dep: Callable):
    global _auth_dependency
    _auth_dependency = dep

def get_current_user_dep():
    if _auth_dependency is None:
        raise HTTPException(status_code=500, detail="Auth not configured")
    return _auth_dependency

# Lazy Supabase client
_supabase_client: Optional[Client] = None

def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
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


class EnrichBatchRequest(BaseModel):
    contact_ids: list[int] = []
    limit: int = 10


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
        f"LinkedIn: {contact.get('linkedin_url', 'N/A')}",
        f"Website: {contact.get('website', 'N/A')}",
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
                "HOOK",
                "-" * 60,
                str(synthesized.get("hook", "N/A")),
                "",
                "-" * 60,
                "WHY NOW",
                "-" * 60,
                str(synthesized.get("why_now", "N/A")),
                "",
                "-" * 60,
                "TALKING POINTS",
                "-" * 60,
            ])
            
            talking_points = synthesized.get("talking_points", [])
            if talking_points:
                for i, point in enumerate(talking_points, 1):
                    lines.append(f"  {i}. {point}")
            else:
                lines.append("  No talking points available")
            
            lines.extend([
                "",
                "-" * 60,
                "BANT ANALYSIS",
                "-" * 60,
            ])
            bant = synthesized.get("bant", {})
            lines.append(f"  Budget: {bant.get('budget', 'N/A')}")
            lines.append(f"  Authority: {bant.get('authority', 'N/A')}")
            lines.append(f"  Need: {bant.get('need', 'N/A')}")
            lines.append(f"  Timeline: {bant.get('timeline', 'N/A')}")
    
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
async def enrich_contact(request: EnrichRequest, user: dict = Depends(get_current_user_dep)):
    """Enrich a single contact and generate TXT output file"""
    
    supabase = get_supabase()
    user_id = user.get("sub") or user.get("user_id") or user.get("id")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    
    # Fetch contact
    result = supabase.table("contacts").select("*").eq("id", request.contact_id).eq("user_id", user_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact = result.data
    
    # Update status to processing
    supabase.table("contacts").update({
        "enrichment_status": "processing"
    }).eq("id", request.contact_id).execute()
    
    try:
        # Run enrichment
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
        
        supabase.table("contacts").update(update_data).eq("id", request.contact_id).execute()
        
        return {
            "success": True,
            "contact_id": request.contact_id,
            "status": "completed",
            "txt_file": txt_filepath,
            "enrichment_data": enrichment_result
        }
        
    except Exception as e:
        # Update status to failed
        supabase.table("contacts").update({
            "enrichment_status": "failed"
        }).eq("id", request.contact_id).execute()
        
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/enrich/{contact_id}/status")
async def get_enrichment_status(contact_id: int, user: dict = Depends(get_current_user_dep)):
    """Get enrichment status for a contact"""
    
    supabase = get_supabase()
    user_id = user.get("sub") or user.get("user_id") or user.get("id")
    
    result = supabase.table("contacts").select(
        "enrichment_status, enriched_at, apex_score, enrichment_txt_path"
    ).eq("id", contact_id).eq("user_id", user_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact = result.data
    
    return {
        "contact_id": contact_id,
        "status": contact.get("enrichment_status"),
        "enriched_at": contact.get("enriched_at"),
        "apex_score": contact.get("apex_score"),
        "has_txt_file": bool(contact.get("enrichment_txt_path"))
    }


@router.get("/enrich/{contact_id}/download")
async def download_enrichment_txt(contact_id: int, user: dict = Depends(get_current_user_dep)):
    """Download the enrichment TXT file"""
    
    supabase = get_supabase()
    user_id = user.get("sub") or user.get("user_id") or user.get("id")
    
    result = supabase.table("contacts").select(
        "enrichment_txt_path, first_name, last_name"
    ).eq("id", contact_id).eq("user_id", user_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact = result.data
    txt_path = contact.get("enrichment_txt_path")
    
    if not txt_path or not os.path.exists(txt_path):
        raise HTTPException(status_code=404, detail="Enrichment file not found")
    
    filename = f"enrichment_{contact.get('first_name', '')}_{contact.get('last_name', '')}.txt"
    
    return FileResponse(path=txt_path, filename=filename, media_type="text/plain")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "enrichment_v3"}
