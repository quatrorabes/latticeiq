from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
import os
import json
from datetime import datetime, timezone
import urllib.request
import urllib.error

router = APIRouter(prefix="/enrichment", tags=["enrichment"])
security = HTTPBearer(auto_error=True)

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
PERPLEXITY_MODEL = os.getenv("PERPLEXITY_MODEL", "sonar-pro")
PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"

class QuickEnrichResult(BaseModel):
    summary: Optional[str] = None
    opening_line: Optional[str] = None
    persona_type: Optional[str] = None
    vertical: Optional[str] = None
    inferred_title: Optional[str] = None
    inferred_company_website: Optional[str] = None
    inferred_location: Optional[str] = None
    talking_points: Optional[list] = None

class QuickEnrichResponse(BaseModel):
    contact_id: str
    status: str
    result: QuickEnrichResult
    raw_text: str
    model: str

def build_prompt(contact: dict) -> str:
    first_name = contact.get("first_name", "")
    last_name = contact.get("last_name", "")
    company = contact.get("company", "")
    email = contact.get("email", "")
    linkedin_url = contact.get("linkedin_url", "")
    title = contact.get("title", "")
    
    return f"""You are a sales intelligence assistant. Research this person using public web sources:
- Name: {first_name} {last_name}
- Company: {company}
- Email: {email}
- LinkedIn: {linkedin_url}
- Title: {title}

Return ONE valid JSON object only (no markdown):
{{
  "summary": "2-3 sentence sales-relevant summary.",
  "opening_line": "One personalized outreach opener.",
  "persona_type": "Decision-maker|Champion|Influencer|Initiator|Unknown",
  "vertical": "SaaS|Insurance|Equipment Leasing|Finance|Healthcare|Other|Unknown",
  "inferred_title": "Best guess job title if missing.",
  "inferred_company_website": "Company website or null.",
  "inferred_location": "City/Region or null.",
  "talking_points": ["Point 1", "Point 2", "Point 3"]
}}

JSON only, no extra text."""

def call_perplexity(prompt: str) -> str:
    if not PERPLEXITY_API_KEY:
        raise HTTPException(status_code=500, detail="PERPLEXITY_API_KEY not set")
    
    payload = {
        "model": PERPLEXITY_MODEL,
        "messages": [
            {"role": "system", "content": "Return concise sales intelligence in strict JSON."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 700,
        "temperature": 0.3,
    }
    
    req = urllib.request.Request(
        PERPLEXITY_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
            "Content-Type": "application/json",
        },
    )
    
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8") if hasattr(e, "read") else str(e)
        raise HTTPException(status_code=502, detail=f"Perplexity error: {detail}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Perplexity failed: {str(e)}")

def parse_json(raw: str) -> dict:
    try:
        return json.loads(raw)
    except:
        pass
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(raw[start:end+1])
        except:
            pass
    return {"summary": raw.strip()}

@router.post("/quick-enrich/{contact_id}", response_model=QuickEnrichResponse)
async def quick_enrich(contact_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        # Get contact (mock for now)
        contact = {"id": contact_id, "first_name": "Test", "last_name": "User", "email": "test@example.com"}
        
        prompt = build_prompt(contact)
        raw_text = call_perplexity(prompt)
        parsed = parse_json(raw_text)
        
        enrichment = QuickEnrichResult(
            summary=parsed.get("summary"),
            opening_line=parsed.get("opening_line"),
            persona_type=parsed.get("persona_type"),
            vertical=parsed.get("vertical"),
            inferred_title=parsed.get("inferred_title"),
            inferred_company_website=parsed.get("inferred_company_website"),
            inferred_location=parsed.get("inferred_location"),
            talking_points=parsed.get("talking_points"),
        )
        
        return QuickEnrichResponse(
            contact_id=contact_id,
            status="completed",
            result=enrichment,
            raw_text=raw_text,
            model=PERPLEXITY_MODEL,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
