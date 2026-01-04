# backend/app/enrichment/deep_enrichment.py

"""
Deep Enrichment Service - Two-stage Perplexity + GPT-4 Pipeline

Integrates the Apex enhanced enrichment approach with async job handling,
quota management, and multi-versioning (raw + polished profiles).

Stage 1: Perplexity sonar-pro research with open-ended questions
Stage 2: GPT-4 polishing into sales-ready dossier format
"""

import os
import json
import requests
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from uuid import UUID

import openai
from supabase import Client

logger = logging.getLogger(__name__)


class DeepEnrichmentService:
    """Two-stage enrichment: Perplexity research → GPT-4 polish"""

    def __init__(
        self,
        supabase_client: Client,
        perplexity_key: str = None,
        openai_key: str = None,
    ):
        """Initialize service with API keys and Supabase client."""
        self.supabase = supabase_client
        self.perplexity_key = perplexity_key or os.getenv("PERPLEXITY_API_KEY")
        self.openai_key = openai_key or os.getenv("OPENAI_API_KEY")

        if not self.perplexity_key:
            raise ValueError("PERPLEXITY_API_KEY required")
        if not self.openai_key:
            raise ValueError("OPENAI_API_KEY required for deep enrichment")

        # Initialize OpenAI client
        self.openai_client = openai.OpenAI(api_key=self.openai_key)

        # API endpoints
        self.perplexity_url = "https://api.perplexity.ai/chat/completions"
        self.perplexity_model = "sonar-pro"
        self.gpt_model = "gpt-4-turbo"

    def enrich_contact_async(
        self,
        workspace_id: UUID,
        contact_id: UUID,
        contact_name: str,
        company_name: str,
        title: str,
        email: str = None,
        linkedin_url: str = None,
    ) -> Dict[str, Any]:
        """
        Queue deep enrichment job for async processing.
        Returns job record with status 'pending'.
        """
        try:
            # Create job record in enrichment_deep_jobs table
            job_data = {
                "contact_id": str(contact_id),
                "workspace_id": str(workspace_id),
                "status": "pending",
                "raw_profile": None,
                "polished_profile": None,
                "error_message": None,
                "created_at": datetime.utcnow().isoformat(),
                "completed_at": None,
            }

            response = (
                self.supabase.table("enrichment_deep_jobs")
                .insert(job_data)
                .execute()
            )

            job_id = response.data[0]["id"] if response.data else None
            logger.info(
                f"Deep enrichment job created: {job_id} for contact {contact_id}"
            )

            return {
                "success": True,
                "job_id": job_id,
                "status": "pending",
                "contact_id": str(contact_id),
                "created_at": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Failed to create enrichment job: {e}")
            return {
                "success": False,
                "error": str(e),
                "contact_id": str(contact_id),
            }

    def process_enrichment_job(
        self,
        job_id: UUID,
        contact_id: UUID,
        workspace_id: UUID,
        contact_name: str,
        company_name: str,
        title: str,
        email: str = None,
        linkedin_url: str = None,
    ) -> Dict[str, Any]:
        """
        Execute deep enrichment pipeline for a single contact.
        Called by async worker/background job.
        """
        try:
            # Update job status to 'processing'
            self.supabase.table("enrichment_deep_jobs").update(
                {"status": "processing", "updated_at": datetime.utcnow().isoformat()}
            ).eq("id", str(job_id)).execute()

            logger.info(f"Processing deep enrichment job {job_id}")

            # STAGE 1: Perplexity Research
            logger.info(f"Stage 1: Querying Perplexity for {contact_name} at {company_name}")
            query = self._build_enrichment_query(
                contact_name, company_name, title, email, linkedin_url
            )
            raw_profile = self._call_perplexity(query)

            if not raw_profile:
                raise Exception("No result from Perplexity")

            logger.info(f"Stage 1 complete: {len(raw_profile)} chars from Perplexity")

            # STAGE 2: GPT-4 Polishing
            logger.info("Stage 2: Polishing with GPT-4")
            contact_data = {
                "name": contact_name,
                "title": title,
                "company": company_name,
                "email": email,
            }
            polished_profile = self._polish_profile(raw_profile, contact_data)

            if not polished_profile:
                logger.warning("Polishing failed, using raw profile")
                polished_profile = raw_profile

            logger.info(f"Stage 2 complete: {len(polished_profile)} chars polished")

            # STAGE 3: Store Results
            self.supabase.table("enrichment_deep_jobs").update(
                {
                    "status": "completed",
                    "raw_profile": raw_profile,
                    "polished_profile": polished_profile,
                    "completed_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", str(job_id)).execute()

            # STAGE 4: Update Contact
            self.supabase.table("contacts").update(
                {
                    "enrichment_full_profile": polished_profile,
                    "enrichment_last_deep_enriched_at": datetime.utcnow().isoformat(),
                    "enrichment_deep_quality_score": 95,  # Quality score (0-100)
                }
            ).eq("id", str(contact_id)).execute()

            # STAGE 5: Increment quota usage
            self.supabase.table("users_settings").update(
                {
                    "enrichment_deep_used_this_month": (
                        # Note: actual increment done in SQL trigger
                        # This is placeholder, actual implementation uses SQL
                    )
                }
            ).eq("workspace_id", str(workspace_id)).execute()

            logger.info(f"Deep enrichment completed for contact {contact_id}")

            return {
                "success": True,
                "job_id": str(job_id),
                "contact_id": str(contact_id),
                "status": "completed",
                "raw_length": len(raw_profile),
                "polished_length": len(polished_profile),
                "completed_at": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Deep enrichment failed for job {job_id}: {e}")

            # Update job with error
            self.supabase.table("enrichment_deep_jobs").update(
                {
                    "status": "failed",
                    "error_message": str(e),
                    "completed_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", str(job_id)).execute()

            return {"success": False, "job_id": str(job_id), "error": str(e)}

    def get_job_status(self, job_id: UUID) -> Dict[str, Any]:
        """Get status of a deep enrichment job."""
        try:
            response = (
                self.supabase.table("enrichment_deep_jobs")
                .select("*")
                .eq("id", str(job_id))
                .single()
                .execute()
            )

            job = response.data
            return {
                "success": True,
                "job_id": str(job["id"]),
                "status": job["status"],
                "contact_id": str(job["contact_id"]),
                "created_at": job["created_at"],
                "completed_at": job.get("completed_at"),
                "error": job.get("error_message"),
            }

        except Exception as e:
            logger.error(f"Failed to get job status: {e}")
            return {"success": False, "error": str(e)}

    def _build_enrichment_query(
        self,
        name: str,
        company: str,
        title: str,
        email: str = None,
        linkedin_url: str = None,
    ) -> str:
        """Build comprehensive Perplexity query with open-ended questions."""
        context = f"{name}, {title} at {company}"
        if email:
            context += f"\nEmail: {email}"
        if linkedin_url:
            context += f"\nLinkedIn: {linkedin_url}"

        query = f"""{context}

You are a professional profile-building assistant. Generate an up-to-date profile using public web sources and LinkedIn.

PERSONAL PROFILE FOR {name.upper()}:

Structure your response with these sections:

### 1. Overview – Current Title and Organization
[Professional summary highlighting current role and company]

### 2. Background – Work History and Notable Achievements
[Bullet points with key career milestones]

### 3. Education – Degrees and Institutions
[Educational background]

### 4. Recent Mentions – News, Public Appearances, Online Presence
[Bullet points with recent visibility/mentions]

### 5. Social Profiles
[LinkedIn, Twitter, Instagram, other professional profiles]

### 6. Personality Detail – Inferred Personality Type
[Professional personality assessment based on public data]

COMPANY PROFILE FOR {company.upper()}:

### 1. Overview – Description, Mission, Founding
[Company background and mission]

### 2. Products & Services
[Key offerings and markets served - bullet points]

### 3. Leadership – Key Executives
[Notable leaders and founders]

### 4. Market & Competitors
[Industry position and key competitors]

### 5. Recent News – Major Announcements
[Recent company news and milestones - bullet points]

STRATEGIC SALES INTELLIGENCE:

### Pain Points for {title} at {company}
[5 specific pain points for this role - bullet points]

### Potential Sales Opportunities
[5 specific talking points and opportunities - bullet points]

### Key Non-Obvious Insights
[3 critical business insights useful in a conversation - bullet points]

Important: Find the correct {company} where {name} works as {title}. Focus on practical, sales-ready intelligence."""

        return query

    def _call_perplexity(self, query: str) -> Optional[str]:
        """Call Perplexity API with sonar-pro model."""
        try:
            headers = {
                "Authorization": f"Bearer {self.perplexity_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "model": self.perplexity_model,
                "messages": [{"role": "user", "content": query}],
            }

            logger.info("Calling Perplexity API...")
            response = requests.post(
                self.perplexity_url,
                json=payload,
                headers=headers,
                timeout=120,  # 2-minute timeout for research
            )

            if response.status_code == 200:
                data = response.json()
                result = data["choices"][0]["message"]["content"]
                logger.info("✓ Perplexity API successful")
                return result
            else:
                logger.error(f"Perplexity API error {response.status_code}: {response.text}")
                return None

        except Exception as e:
            logger.error(f"Perplexity request failed: {e}")
            return None

    def _polish_profile(
        self, raw_profile: str, contact_data: Dict[str, str]
    ) -> Optional[str]:
        """Polish raw Perplexity output into sales-ready format with GPT-4."""
        try:
            name = contact_data.get("name", "")
            company = contact_data.get("company", "")
            title = contact_data.get("title", "")

            polish_prompt = f"""You are an AI tasked with converting business profile information into a refined, 
professional dossier for sales representatives. Your goal is to create detailed, flexible business profiles 
that support sales activities.

**Contact:** {name}
**Title:** {title}
**Company:** {company}

**CRITICAL FORMATTING REQUIREMENTS:**

Use this EXACT structure with numbered sections:

## PROFESSIONAL PROFILE: {name.upper()}

### 1. Overview – Current Title and Organization
[Enhanced overview content]

### 2. Background – Work History and Notable Achievements
- [Enhanced bullet points with specific achievements]

### 3. Education
[Educational background]

### 4. Recent Mentions and Online Presence
- [Bullet points with recent activity]

### 5. Social Profiles
[Professional online presence]

---

## COMPANY PROFILE: {company.upper()}

### 1. Overview
[Company description and mission]

### 2. Products & Services
- [Bullet points with key offerings]

### 3. Leadership
[Key executives and founders]

### 4. Market Position
[Industry and competitive position]

### 5. Recent News
- [Bullet points with recent announcements]

---

## STRATEGIC SALES INTELLIGENCE

### Pain Points – {title} at {company}
- [5 specific, relevant pain points with context]

### Sales Opportunities & Talking Points
- [5 specific, contextual sales opportunities]

### Key Business Insights
- [3 non-obvious insights valuable in business conversations]

### Final Note
[One paragraph synthesizing actionable intelligence for sales strategy]

---

**Raw Profile to Polish:**

{raw_profile}

**Remember:** Maintain structure above while enhancing with rich, professional language. 
Make it sales-ready and action-oriented."""

            logger.info("Calling GPT-4 for polishing...")
            response = self.openai_client.chat.completions.create(
                model=self.gpt_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a professional business profile writer. Create polished, sales-ready dossiers that maintain exact section structure.",
                    },
                    {"role": "user", "content": polish_prompt},
                ],
                temperature=0.5,  # Lower temp for consistency
                max_tokens=4000,
            )

            polished = response.choices[0].message.content
            logger.info("✓ GPT-4 polishing successful")
            return polished

        except Exception as e:
            logger.error(f"GPT-4 polishing failed: {e}")
            return None

    def check_quota(self, workspace_id: UUID) -> Dict[str, Any]:
        """Check deep enrichment quota for workspace."""
        try:
            response = (
                self.supabase.table("users_settings")
                .select("enrichment_deep_quota_monthly, enrichment_deep_used_this_month")
                .eq("workspace_id", str(workspace_id))
                .single()
                .execute()
            )

            settings = response.data
            quota = settings.get("enrichment_deep_quota_monthly", 50)
            used = settings.get("enrichment_deep_used_this_month", 0)
            remaining = quota - used

            return {
                "success": True,
                "quota_monthly": quota,
                "used_this_month": used,
                "remaining": remaining,
                "exhausted": remaining <= 0,
            }

        except Exception as e:
            logger.error(f"Failed to check quota: {e}")
            return {"success": False, "error": str(e)}
