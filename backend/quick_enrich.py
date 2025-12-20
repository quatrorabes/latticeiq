#!/usr/bin/env python3

"""
quick_enrich.py

Quick-and-dirty enrichment endpoint for LatticeIQ.

- Input: contact_id (UUID) of an existing contact
- Loads contact from Supabase for the current Supabase user (RLS-friendly)
- Calls Perplexity (sonar-pro) with a JSON-style prompt
- Writes back:
		- enrichment_status: "completed" | "failed"
		- enrichment_data:   JSONB payload with summary, company_overview, etc.
		- enriched_at:       UTC timestamp
- Returns a compact JSON response for the frontend to consume.

Environment:
- SUPABASE_URL
- SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY
- PERPLEXITY_API_KEY
- Optional: PERPLEXITY_MODEL (defaults to "sonar-pro")
"""

import os
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

import requests
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from supabase import Client, create_client

# ---------------------------------------------------------------------------
# Supabase client (separate from main.py on purpose, quick-and-dirty)
# ---------------------------------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
		raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set for quick_enrich")
	
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# Perplexity configuration (sonar-pro, same as your batch engine)
# ---------------------------------------------------------------------------

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
PERPLEXITY_MODEL = os.getenv("PERPLEXITY_MODEL", "sonar-pro")

if not PERPLEXITY_API_KEY:
		raise RuntimeError("PERPLEXITY_API_KEY must be set for quick_enrich")
	
PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"

# ---------------------------------------------------------------------------
# Auth: duplicate of main.py pattern, kept local to this module
# ---------------------------------------------------------------------------

security = HTTPBearer(auto_error=True)


class CurrentUser(BaseModel):
		id: str
		email: Optional[EmailStr] = None
	
	
async def get_current_user(
		credentials: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
		"""
		Validate Supabase JWT from Authorization: Bearer and return the Supabase user.
		This mirrors main.py but is duplicated here to avoid circular imports.
		"""
		try:
				user_response = supabase.auth.get_user(credentials.credentials)
				user = user_response.user
				if not user:
						raise HTTPException(status_code=401, detail="Invalid token (no user)")
				return CurrentUser(id=user.id, email=user.email)
		except Exception:
				raise HTTPException(status_code=401, detail="Invalid token")
			
			
# ---------------------------------------------------------------------------
# Pydantic response model
# ---------------------------------------------------------------------------
			
class QuickEnrichPayload(BaseModel):
		summary: Optional[str] = None
		company_overview: Optional[str] = None
		persona: Optional[str] = None
		tone: Optional[str] = None
		opening_line: Optional[str] = None
		talking_points: Optional[List[str]] = None
	
	
class QuickEnrichResponse(BaseModel):
		contact_id: str
		status: str
		payload: QuickEnrichPayload
		raw_text: str
	
	
# ---------------------------------------------------------------------------
# FastAPI router
# ---------------------------------------------------------------------------
	
router = APIRouter(prefix="/api/quick-enrich", tags=["quick-enrich"])


def build_prompt(contact: Dict[str, Any]) -> str:
		"""
		Build a JSON-focused prompt for Perplexity based on a contact row.
		"""
		firstname = contact.get("firstname") or ""
		lastname = contact.get("lastname") or ""
		full_name = f"{firstname} {lastname}".strip()
		company = contact.get("company") or ""
		title = contact.get("title") or ""
		email = contact.get("email") or ""
		linkedin_url = contact.get("linkedin_url") or contact.get("linkedin") or ""
	
		prompt = f"""
You are a senior sales intelligence assistant.

Use only public web information to research this person and company:

- Full name: {full_name}
- First name: {firstname}
- Last name: {lastname}
- Company: {company}
- Title: {title}
- Email: {email}
- LinkedIn: {linkedin_url}

Return a SINGLE valid JSON object with these keys, no markdown, no prose:

{{
	"summary": "2-3 sentence overview of this person in the context of their role and company.",
	"company_overview": "2-3 sentences describing the company, market, and product.",
	"persona": "Short label like 'VP Sales - Economic Buyer' or 'Director Marketing - Champion'.",
	"tone": "Short description of preferred communication style (e.g. 'formal, data-driven').",
	"opening_line": "One personalized opening sentence for cold outreach.",
	"talking_points": [
		"3-5 short bullet-style strings with relevant topics to mention in outreach."
	]
}}

Rules:
- Respond with JSON ONLY.
- Do not include comments, markdown, or extra text.
- Keep strings concise and sales-focused.
"""
		return prompt.strip()
		

def call_perplexity(prompt: str) -> str:
		"""
		Call Perplexity sonar-pro and return the raw message content.
		"""
		try:
				response = requests.post(
						PERPLEXITY_URL,
						headers={
								"Authorization": f"Bearer {PERPLEXITY_API_KEY}",
								"Content-Type": "application/json",
						},
						json={
								"model": PERPLEXITY_MODEL,
								"messages": [
										{
												"role": "system",
												"content": "You generate concise, sales-focused research for B2B contacts.",
										},
										{"role": "user", "content": prompt},
								],
								"max_tokens": 600,
								"temperature": 0.5,
						},
						timeout=45,
				)
				response.raise_for_status()
				data = response.json()
				return data["choices"][0]["message"]["content"]
		except Exception as e:
				raise HTTPException(status_code=502, detail=f"Perplexity enrichment failed: {e}")
			
			
def parse_payload(raw_text: str) -> QuickEnrichPayload:
		"""
		Parse JSON from Perplexity; fall back gracefully if parsing fails.
		"""
		try:
				parsed = json.loads(raw_text)
				if not isinstance(parsed, dict):
						raise ValueError("Top-level JSON is not an object")
					
				return QuickEnrichPayload(
						summary=parsed.get("summary"),
						company_overview=parsed.get("company_overview"),
						persona=parsed.get("persona"),
						tone=parsed.get("tone"),
						opening_line=parsed.get("opening_line"),
						talking_points=parsed.get("talking_points"),
				)
		except Exception:
				# Fallback: treat the entire text as a summary
				return QuickEnrichPayload(
						summary=raw_text.strip(),
						company_overview=None,
						persona=None,
						tone=None,
						opening_line=None,
						talking_points=None,
				)
	
	
@router.post("/{contact_id}", response_model=QuickEnrichResponse)
async def quick_enrich_contact(
		contact_id: UUID,
		user: CurrentUser = Depends(get_current_user),
) -> QuickEnrichResponse:
		"""
		Quick enrichment for a single contact:

		- Loads the contact for the current user from Supabase
		- Calls Perplexity sonar-pro with a JSON prompt
		- Saves enrichment_status/enrichment_data/enriched_at on the contact
		- Returns a compact payload for the frontend
		"""
		# 1. Load contact row, scoped by user_id
		result = (
				supabase.table("contacts")
				.select("*")
				.eq("id", str(contact_id))
				.eq("user_id", user.id)
				.execute()
		)

		if not result.data:
				raise HTTPException(status_code=404, detail="Contact not found")
			
		contact = result.data[0]
		
		# 2. Build prompt and call Perplexity
		prompt = build_prompt(contact)
		raw_text = call_perplexity(prompt)
		payload = parse_payload(raw_text)
		
		# 3. Persist to Supabase
		now_iso = datetime.now(timezone.utc).isoformat()
		
		update_data: Dict[str, Any] = {
				"enrichment_status": "completed",
				"enrichment_data": {
						"quick_enrich": payload.dict(),
						"provider": "perplexity",
						"model": PERPLEXITY_MODEL,
						"generated_at": now_iso,
				},
				"enriched_at": now_iso,
		}

		update_result = (
				supabase.table("contacts")
				.update(update_data)
				.eq("id", str(contact_id))
				.eq("user_id", user.id)
				.execute()
		)

		if not update_result.data:
				# If update failed, still return enrichment but mark as failed in API response
				raise HTTPException(status_code=500, detail="Failed to persist enrichment")
			
		return QuickEnrichResponse(
				contact_id=str(contact_id),
				status="completed",
				payload=payload,
				raw_text=raw_text,
		)
