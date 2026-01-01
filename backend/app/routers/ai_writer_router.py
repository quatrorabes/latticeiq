# ============================================================================
# FILE: backend/app/routers/ai_writer_router.py
# PURPOSE: AI-powered email and message generation
# ============================================================================

import os
import json
import urllib.request
import urllib.error
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from supabase import create_client
import jwt

router = APIRouter(prefix="/ai-writer", tags=["AI Writer"])

# Supabase
supabase = None
def get_supabase():
    global supabase
    if supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        if url and key:
            supabase = create_client(url, key)
    return supabase

# Perplexity
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")
PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"

# Auth
async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization")
    try:
        token = authorization.split(" ", 1)[1]
        payload = jwt.decode(token, options={"verify_signature": False})
        return {"id": payload.get("sub"), "email": payload.get("email", "")}
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

# Models
class EmailRequest(BaseModel):
    contact_id: str
    template_type: str = "cold_outreach"  # cold_outreach, follow_up, meeting_request, value_prop
    tone: str = "professional"  # professional, casual, friendly, urgent
    custom_context: Optional[str] = None
    include_cta: bool = True

class EmailResponse(BaseModel):
    subject: str
    body: str
    preview_text: str
    contact_id: str
    template_type: str
    generated_at: str

class BulkEmailRequest(BaseModel):
    contact_ids: List[str]
    template_type: str = "cold_outreach"
    tone: str = "professional"

# Email Templates
TEMPLATE_PROMPTS = {
    "cold_outreach": """Write a cold outreach email that:
- Opens with a personalized hook based on their role/company
- Shows you understand their potential pain points
- Briefly introduces value without being salesy
- Ends with a soft CTA (question, not hard ask)""",
    
    "follow_up": """Write a follow-up email that:
- References a previous touchpoint naturally
- Provides additional value or insight
- Keeps it short and respectful of their time
- Suggests a specific next step""",
    
    "meeting_request": """Write a meeting request email that:
- Gets to the point quickly
- Explains the specific value of the meeting
- Offers flexible timing options
- Makes it easy to say yes""",
    
    "value_prop": """Write a value proposition email that:
- Leads with a relevant insight or statistic
- Connects their challenges to your solution
- Includes a brief case study or proof point
- Ends with curiosity-building question""",
    
    "breakup": """Write a professional breakup email that:
- Acknowledges you've tried to connect
- Leaves the door open for future
- Removes pressure completely
- Is memorable but not guilt-tripping"""
}

TONE_MODIFIERS = {
    "professional": "Maintain a professional, business-appropriate tone.",
    "casual": "Use a casual, conversational tone like messaging a colleague.",
    "friendly": "Be warm and personable, like reaching out to a friend of a friend.",
    "urgent": "Convey appropriate urgency without being pushy or alarmist."
}

def _call_perplexity(prompt: str, max_tokens: int = 800) -> str:
    if not PERPLEXITY_API_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    payload = {
        "model": "sonar-pro",
        "messages": [
            {"role": "system", "content": "You are an expert sales copywriter. Write emails that convert."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.7,
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
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body["choices"][0]["message"]["content"]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

def _parse_email_response(raw: str) -> dict:
    """Parse AI response into subject/body."""
    lines = raw.strip().split('\n')
    subject = ""
    body_lines = []
    in_body = False
    
    for line in lines:
        lower = line.lower().strip()
        if lower.startswith("subject:"):
            subject = line.split(":", 1)[1].strip().strip('"')
        elif lower.startswith("body:") or in_body:
            in_body = True
            if lower.startswith("body:"):
                body_lines.append(line.split(":", 1)[1].strip())
            else:
                body_lines.append(line)
    
    # If parsing failed, use heuristics
    if not subject and lines:
        subject = lines[0].replace("Subject:", "").replace("**", "").strip()
        body_lines = lines[1:]
    
    body = '\n'.join(body_lines).strip()
    if not body:
        body = raw
    
    return {"subject": subject, "body": body}

@router.post("/generate-email", response_model=EmailResponse)
async def generate_email(request: EmailRequest, user: dict = Depends(get_current_user)):
    """Generate a personalized email for a contact."""
    
    client = get_supabase()
    if not client:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Load contact
    result = client.table("contacts").select("*").eq("id", request.contact_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact = result.data[0]
    enrichment = contact.get("enrichment_data", {}).get("quick_enrich", {})
    
    # Build context
    context = f"""
CONTACT INFORMATION:
- Name: {contact.get('first_name', '')} {contact.get('last_name', '')}
- Title: {contact.get('title') or enrichment.get('inferred_title', 'Unknown')}
- Company: {contact.get('company', 'Unknown')}
- Email: {contact.get('email', '')}

ENRICHMENT DATA:
- Persona Type: {enrichment.get('persona_type', 'Unknown')}
- Vertical/Industry: {enrichment.get('vertical', 'Unknown')}
- Summary: {enrichment.get('summary', 'No summary available')}
- Talking Points: {', '.join(enrichment.get('talking_points', [])) or 'None'}

SCORES:
- MDCP Score: {contact.get('mdcp_score', 'N/A')} ({contact.get('mdcp_tier', 'N/A')})
- Overall Score: {contact.get('overall_score', 'N/A')}
"""
    
    if request.custom_context:
        context += f"\nADDITIONAL CONTEXT:\n{request.custom_context}\n"
    
    # Build prompt
    template_instruction = TEMPLATE_PROMPTS.get(request.template_type, TEMPLATE_PROMPTS["cold_outreach"])
    tone_instruction = TONE_MODIFIERS.get(request.tone, TONE_MODIFIERS["professional"])
    
    prompt = f"""Using the following contact information, write a personalized sales email.

{context}

EMAIL TYPE: {request.template_type}
{template_instruction}

TONE: {tone_instruction}

{"Include a clear call-to-action." if request.include_cta else "No hard CTA needed."}

Format your response as:
Subject: [subject line]

Body:
[email body]

Keep the email under 150 words. Make it feel personal, not templated."""

    # Generate
    raw_response = _call_perplexity(prompt)
    parsed = _parse_email_response(raw_response)
    
    # Generate preview text (first 100 chars of body)
    preview = parsed["body"][:100].replace('\n', ' ').strip() + "..."
    
    return EmailResponse(
        subject=parsed["subject"],
        body=parsed["body"],
        preview_text=preview,
        contact_id=request.contact_id,
        template_type=request.template_type,
        generated_at=datetime.now(timezone.utc).isoformat()
    )

@router.post("/generate-bulk-emails")
async def generate_bulk_emails(request: BulkEmailRequest, user: dict = Depends(get_current_user)):
    """Generate emails for multiple contacts."""
    
    results = []
    errors = []
    
    for contact_id in request.contact_ids[:10]:  # Limit to 10 at a time
        try:
            email_request = EmailRequest(
                contact_id=contact_id,
                template_type=request.template_type,
                tone=request.tone
            )
            result = await generate_email(email_request, user)
            results.append(result.dict())
        except Exception as e:
            errors.append({"contact_id": contact_id, "error": str(e)})
    
    return {
        "generated": len(results),
        "errors": len(errors),
        "emails": results,
        "error_details": errors
    }

@router.get("/templates")
async def get_email_templates():
    """Get available email templates."""
    return {
        "templates": [
            {"id": "cold_outreach", "name": "Cold Outreach", "description": "Initial contact with a new prospect"},
            {"id": "follow_up", "name": "Follow Up", "description": "Following up on previous contact"},
            {"id": "meeting_request", "name": "Meeting Request", "description": "Request a call or meeting"},
            {"id": "value_prop", "name": "Value Proposition", "description": "Lead with value and insights"},
            {"id": "breakup", "name": "Breakup Email", "description": "Final attempt before moving on"},
        ],
        "tones": [
            {"id": "professional", "name": "Professional"},
            {"id": "casual", "name": "Casual"},
            {"id": "friendly", "name": "Friendly"},
            {"id": "urgent", "name": "Urgent"},
        ]
    }
