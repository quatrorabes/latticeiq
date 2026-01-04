# PHASE 2B IMPLEMENTATION PLAN - BACKEND CLASSES

**Date Created:** January 1, 2026, 4:30 PM PST  
**Phase:** 2B - Backend Implementation  
**Prerequisites:** ✅ Phase 2A Complete (All database migrations executed)  
**Estimated Time:** 5-6 hours  
**Status:** 🟡 READY TO START

---

## 🎯 OBJECTIVE

**Build 4 core Python classes that power the Variables & Fields system:**

1. **FieldAccessor** - Unified field value retrieval (denormalized + JSONB)
2. **ICPMatcher** - Match contacts to Ideal Client Profiles
3. **VariableSubstitutor** - Replace {{variable}} with actual values
4. **CampaignBuilder** - Orchestrate campaign creation

**Plus:** API endpoints, unit tests, and end-to-end integration test

---

## 📋 CURRENT STATE

### **✅ What's Ready (Phase 2A Complete)**

**Database Schema:**
- ✅ 6 new tables created (users_settings, ideal_client_profiles, contact_field_definitions, campaigns, email_templates, call_templates)
- ✅ 26 denormalized columns on contacts table
- ✅ RLS policies enforced on all tables
- ✅ 20+ performance indexes
- ✅ 482 contacts with workspace_id assigned
- ✅ Default templates + ICP seeded

**Backend Scaffolding:**
- ✅ Directory structure created
- ✅ Empty placeholder files:
  - `backend/app/fields/field_accessor.py`
  - `backend/app/icp/icp_matcher.py`
  - `backend/app/templates/variable_substitutor.py`
  - `backend/app/campaigns/campaign_builder.py`

### **🟡 What Needs Implementation**

**Code:**
- 🟡 All 4 Python classes (empty files)
- 🟡 API router with 5 endpoints
- 🟡 Pydantic models for request/response validation
- 🟡 Unit tests (100% coverage target)
- 🟡 Integration tests (end-to-end)

---

## 🏗️ IMPLEMENTATION ROADMAP

### **Phase 2B Breakdown**

| Step | Component | Time | Dependencies | Priority |
|------|-----------|------|--------------|----------|
| **1** | FieldAccessor class | 45 min | None | **CRITICAL** |
| **2** | ICPMatcher class | 60 min | FieldAccessor | High |
| **3** | VariableSubstitutor class | 45 min | FieldAccessor | High |
| **4** | CampaignBuilder class | 60 min | All 3 above | High |
| **5** | API Router + Pydantic models | 45 min | All 4 classes | Medium |
| **6** | Unit tests | 60 min | All classes | Medium |
| **7** | End-to-end test | 30 min | All complete | Medium |
| **8** | Deploy + verify | 15 min | Tests passing | Low |

**Total:** 5 hours 30 minutes

---

## 🔧 IMPLEMENTATION DETAILS

### **CLASS 1: FieldAccessor**

**File:** `backend/app/fields/field_accessor.py`

**Purpose:** Unified API to get any contact field value

**Architecture:**
```
┌──────────────────────────────────┐
│  FieldAccessor.get_field()       │
└──────────────────────────────────┘
           │
           ├─ Check denormalized column (FAST: 5ms)
           │  └─ enrichment_company_name
           │  └─ kernel_who_persona
           │  └─ email_subject
           │
           ├─ Fallback to enrichment_data JSONB (SLOWER: 50ms)
           │  └─ enrichment_data->>'company_name'
           │  └─ enrichment_data->'quick_enrich'->>'company_name'
           │
           └─ Fallback to hubspot_metadata JSONB (SLOWEST: 100ms)
              └─ hubspot_metadata->>'hs_company_name'
```

**Core Methods:**
```python
class FieldAccessor:
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
    def get_field(self, contact_id: UUID, field_name: str) -> Optional[str]:
        """
        Get single field value for a contact
        Returns: str value or None
        """
        pass
    
    def get_multiple_fields(self, contact_id: UUID, field_names: List[str]) -> Dict[str, str]:
        """
        Batch fetch multiple fields (more efficient)
        Returns: {"field_name": "value", ...}
        """
        pass
    
    def get_all_available_fields(self, contact_id: UUID) -> Dict[str, str]:
        """
        Get all non-null fields for a contact
        Useful for template variable previews
        Returns: Complete field map
        """
        pass
```

**Field Mapping Logic:**

```python
FIELD_MAP = {
    # Direct denormalized columns (FAST)
    "company_name": "enrichment_company_name",
    "company_industry": "enrichment_company_industry",
    "company_revenue": "enrichment_company_revenue",
    "person_title": "enrichment_person_title",
    "persona": "kernel_who_persona",
    "urgency": "kernel_when_urgency",
    "hook": "kernel_what_hook",
    
    # JSONB paths (FALLBACK)
    "company_name_alt": ["enrichment_data", "company_name"],
    "company_name_nested": ["enrichment_data", "quick_enrich", "company_name"],
}
```

**Unit Test Cases:**
1. ✅ Get denormalized field (enrichment_company_name) → Returns value in 5ms
2. ✅ Get JSONB field (flat structure) → Returns value in 50ms
3. ✅ Get JSONB field (nested quick_enrich) → Returns value in 50ms
4. ✅ Get non-existent field → Returns None
5. ✅ Batch get 10 fields → Returns dict with all values
6. ✅ Test with Garrett Golden contact (100% quality)
7. ✅ Test with low-quality contact (no enrichment)

**Implementation Notes:**
- Use Supabase Python client for queries
- Cache contact data in-memory for repeated field accesses
- Log warnings for missing fields (helps debug template issues)
- Handle NULL values gracefully

---

### **CLASS 2: ICPMatcher**

**File:** `backend/app/icp/icp_matcher.py`

**Purpose:** Match contacts to Ideal Client Profiles and calculate scores

**Architecture:**
```
┌──────────────────────────────────┐
│  ICPMatcher.match_contact()      │
└──────────────────────────────────┘
           │
           ├─ Load ICP criteria from DB
           │  └─ industries, personas, company_size
           │  └─ scoring_weights
           │
           ├─ Get contact fields via FieldAccessor
           │  └─ enrichment_company_industry
           │  └─ kernel_who_persona
           │  └─ enrichment_company_employees
           │
           ├─ Calculate weighted score (0-100)
           │  └─ Industry match: 30 points
           │  └─ Persona match: 40 points
           │  └─ Company size match: 30 points
           │
           └─ Update contacts.icp_match_score
              └─ Store in denormalized column
```

**Core Methods:**
```python
class ICPMatcher:
    def __init__(self, supabase_client, field_accessor: FieldAccessor):
        self.supabase = supabase_client
        self.field_accessor = field_accessor
    
    def match_contact_to_icp(self, contact_id: UUID, icp_id: UUID) -> int:
        """
        Calculate ICP match score for single contact
        Returns: Score 0-100
        Updates: contacts.icp_match_score, contacts.icp_id
        """
        pass
    
    def find_matching_contacts(
        self, 
        icp_id: UUID, 
        min_score: int = 60,
        limit: int = 100
    ) -> List[UUID]:
        """
        Get all contacts matching ICP above threshold
        Returns: List of contact_ids sorted by score DESC
        """
        pass
    
    def bulk_match_contacts(
        self, 
        icp_id: UUID, 
        contact_ids: List[UUID]
    ) -> Dict[UUID, int]:
        """
        Batch process multiple contacts (more efficient)
        Returns: {contact_id: score, ...}
        """
        pass
```

**Scoring Algorithm:**

```python
def calculate_score(contact_fields, icp_criteria, weights):
    score = 0
    max_score = 0
    
    # Industry match (30 points default)
    if icp_criteria.get("industries"):
        max_score += weights.get("industry_weight", 30)
        if contact_fields.get("company_industry") in icp_criteria["industries"]:
            score += weights.get("industry_weight", 30)
    
    # Persona match (40 points default)
    if icp_criteria.get("personas"):
        max_score += weights.get("persona_weight", 40)
        if contact_fields.get("persona") in icp_criteria["personas"]:
            score += weights.get("persona_weight", 40)
    
    # Company size match (30 points default)
    if icp_criteria.get("min_company_size"):
        max_score += weights.get("company_size_weight", 30)
        # Parse "50-200 employees" or "50+" format
        if matches_size_criteria(contact_fields.get("company_employees"), icp_criteria["min_company_size"]):
            score += weights.get("company_size_weight", 30)
    
    # Return percentage score
    return int((score / max_score) * 100) if max_score > 0 else 0
```

**Unit Test Cases:**
1. ✅ Match "Decision-maker" persona → Score 40+
2. ✅ Match "Technology & Software" industry → Score 30+
3. ✅ Match both persona + industry → Score 70+
4. ✅ No matches → Score 0
5. ✅ Test with Garrett Golden (Manager, Technology) → Score ~40
6. ✅ Test with Griselda Cervantes (Decision-maker, Finance) → Score ~70
7. ✅ Bulk match 482 contacts → Returns scores for all
8. ✅ Find top 10 matching contacts → Returns sorted list

**Implementation Notes:**
- Load ICP criteria once, cache for repeated matching
- Update contacts.icp_match_score in denormalized column (fast queries)
- Support flexible criteria (some fields optional)
- Handle missing data gracefully (don't penalize incomplete profiles)

---

### **CLASS 3: VariableSubstitutor**

**File:** `backend/app/templates/variable_substitutor.py`

**Purpose:** Replace {{variable}} placeholders with actual contact values

**Architecture:**
```
┌──────────────────────────────────┐
│  VariableSubstitutor.substitute()│
└──────────────────────────────────┘
           │
           ├─ Parse template for {{variables}}
           │  └─ Regex: \{\{([a-z_]+)\}\}
           │
           ├─ Get field values via FieldAccessor
           │  └─ {{first_name}} → "Garrett"
           │  └─ {{enrichment_company_name}} → "Wells Fargo"
           │  └─ {{kernel_what_hook}} → "Hi Garrett, I noticed..."
           │
           ├─ Replace placeholders
           │  └─ Handle missing values (fallback to "")
           │  └─ Escape special characters
           │
           └─ Return personalized text
```

**Core Methods:**
```python
class VariableSubstitutor:
    def __init__(self, field_accessor: FieldAccessor):
        self.field_accessor = field_accessor
    
    def substitute(self, template_text: str, contact_id: UUID) -> str:
        """
        Replace all {{variable}} with actual values
        Returns: Fully personalized text
        """
        pass
    
    def preview_substitution(
        self, 
        template_id: UUID, 
        contact_id: UUID
    ) -> Dict[str, str]:
        """
        Preview email with substituted variables
        Returns: {
            "subject": "Personalized subject",
            "body": "Personalized body",
            "variables_used": ["first_name", "company_name"],
            "missing_variables": ["phone"]
        }
        """
        pass
    
    def get_available_variables(self, contact_id: UUID) -> List[str]:
        """
        List all variables available for this contact
        Useful for template editor autocomplete
        Returns: ["first_name", "company_name", ...]
        """
        pass
```

**Variable Parsing:**

```python
import re

VARIABLE_PATTERN = r'\{\{([a-z_]+)\}\}'

def extract_variables(template_text: str) -> List[str]:
    """Find all {{variable}} in template"""
    return re.findall(VARIABLE_PATTERN, template_text)

def replace_variables(template_text: str, values: Dict[str, str]) -> str:
    """Replace {{variable}} with values"""
    def replacer(match):
        var_name = match.group(1)
        return values.get(var_name, "")  # Fallback to empty string
    
    return re.sub(VARIABLE_PATTERN, replacer, template_text)
```

**Unit Test Cases:**
1. ✅ Substitute {{first_name}} → "Garrett"
2. ✅ Substitute {{enrichment_company_name}} → "Wells Fargo"
3. ✅ Substitute {{kernel_what_hook}} → Full text
4. ✅ Handle missing variable {{phone}} → Empty string
5. ✅ Full email template → Personalized email
6. ✅ Test with Garrett Golden → All variables replaced
7. ✅ Preview template → Returns subject + body + metadata
8. ✅ Get available variables → Returns 15+ fields

**Implementation Notes:**
- Support nested variables: {{enrichment_company_name|default:"Your company"}}
- Escape HTML if sending emails (prevent XSS)
- Log warnings for missing required variables
- Cache FieldAccessor results to avoid duplicate queries

---

### **CLASS 4: CampaignBuilder**

**File:** `backend/app/campaigns/campaign_builder.py`

**Purpose:** Orchestrate campaign creation (match ICP → generate emails → store)

**Architecture:**
```
┌──────────────────────────────────┐
│  CampaignBuilder.build_campaign()│
└──────────────────────────────────┘
           │
           ├─ Match contacts to ICP (via ICPMatcher)
           │  └─ Get contacts with score >= 60
           │
           ├─ Load email template
           │  └─ Subject + body templates
           │
           ├─ Generate personalized emails (via VariableSubstitutor)
           │  └─ For each contact:
           │     ├─ Substitute {{variables}}
           │     └─ Store 3 variants (A/B/C testing)
           │
           ├─ Create campaign record
           │  └─ INSERT INTO campaigns (...)
           │  └─ target_count = matched contacts
           │
           └─ Update contacts
              └─ SET campaign_id, email_send_id
```

**Core Methods:**
```python
class CampaignBuilder:
    def __init__(
        self, 
        supabase_client,
        icp_matcher: ICPMatcher,
        variable_substitutor: VariableSubstitutor
    ):
        self.supabase = supabase_client
        self.icp_matcher = icp_matcher
        self.substitutor = variable_substitutor
    
    def build_campaign(
        self,
        workspace_id: UUID,
        icp_id: UUID,
        template_id: UUID,
        campaign_name: str,
        scheduled_at: Optional[datetime] = None
    ) -> UUID:
        """
        Create campaign:
        1. Find contacts matching ICP
        2. Generate personalized emails
        3. Store campaign + link contacts
        Returns: campaign_id
        """
        pass
    
    def get_campaign_preview(
        self, 
        campaign_id: UUID, 
        limit: int = 5
    ) -> List[Dict]:
        """
        Preview first N personalized emails
        Returns: [
            {
                "contact_id": "...",
                "contact_name": "Garrett Golden",
                "email_subject": "Garrett, quick question...",
                "email_body": "Hi Garrett, ...",
                "icp_match_score": 70
            },
            ...
        ]
        """
        pass
    
    def execute_campaign(self, campaign_id: UUID) -> Dict:
        """
        Send campaign emails (placeholder for email service integration)
        Returns: {
            "sent_count": 50,
            "failed_count": 0,
            "status": "completed"
        }
        """
        pass
```

**Campaign Creation Flow:**

```python
def build_campaign(self, workspace_id, icp_id, template_id, campaign_name):
    # Step 1: Match contacts
    matching_contacts = self.icp_matcher.find_matching_contacts(
        icp_id=icp_id,
        min_score=60,
        limit=100
    )
    
    # Step 2: Load template
    template = self.supabase.table("email_templates").select("*").eq("id", template_id).single().execute()
    
    # Step 3: Create campaign record
    campaign = self.supabase.table("campaigns").insert({
        "workspace_id": workspace_id,
        "name": campaign_name,
        "icp_id": icp_id,
        "target_count": len(matching_contacts),
        "status": "draft"
    }).execute()
    
    campaign_id = campaign.data[0]["id"]
    
    # Step 4: Generate personalized emails
    for contact_id in matching_contacts:
        # Substitute variables
        subject = self.substitutor.substitute(template["subject_template"], contact_id)
        body = self.substitutor.substitute(template["body_template"], contact_id)
        
        # Update contact
        self.supabase.table("contacts").update({
            "campaign_id": campaign_id,
            "email_subject": subject,
            "email_body_preview": body[:200]
        }).eq("id", contact_id).execute()
    
    return campaign_id
```

**Unit Test Cases:**
1. ✅ Build campaign with "High-Value Decision Makers" ICP → Returns campaign_id
2. ✅ Match 482 contacts → ~1-2 matches above 60% threshold
3. ✅ Generate emails for matched contacts → All {{variables}} replaced
4. ✅ Preview campaign → Returns first 5 personalized emails
5. ✅ Test with Garrett Golden + Griselda Cervantes → Both emails personalized
6. ✅ Campaign stats → target_count = matched contacts
7. ✅ Contacts updated → campaign_id set, email_subject populated

**Implementation Notes:**
- Wrap in database transaction (all-or-nothing)
- Handle errors gracefully (rollback if email generation fails)
- Store campaign metadata for analytics
- Support scheduled campaigns (send at future date)

---

### **API ENDPOINTS**

**File:** `backend/app/routers/phase2_router.py`

**5 New Endpoints:**

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/v3", tags=["Phase 2 - ICP & Campaigns"])

# Pydantic Models
class ICPCreateRequest(BaseModel):
    name: str
    description: Optional[str]
    criteria: dict  # {"industries": [...], "personas": [...], ...}
    scoring_weights: Optional[dict]

class CampaignCreateRequest(BaseModel):
    name: str
    icp_id: str
    template_id: str
    scheduled_at: Optional[datetime]

class TemplatePreviewRequest(BaseModel):
    template_text: str
    contact_id: str

# Endpoints
@router.post("/icps")
def create_icp(request: ICPCreateRequest, workspace_id: str = Depends(get_workspace_id)):
    """Create new Ideal Client Profile"""
    pass

@router.get("/icps/{icp_id}/matches")
def get_icp_matches(icp_id: str, min_score: int = 60, limit: int = 100):
    """Get contacts matching ICP"""
    pass

@router.post("/campaigns")
def create_campaign(request: CampaignCreateRequest, workspace_id: str = Depends(get_workspace_id)):
    """Create new campaign"""
    pass

@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str):
    """Get campaign details + preview"""
    pass

@router.post("/templates/preview")
def preview_template(request: TemplatePreviewRequest):
    """Preview template with variable substitution"""
    pass
```

**Authentication:**
- Use existing JWT middleware
- Extract workspace_id from JWT token
- Enforce RLS at database layer

**Error Handling:**
- 400: Invalid request (missing fields, invalid UUIDs)
- 404: Resource not found (ICP, campaign, template)
- 403: Unauthorized (wrong workspace_id)
- 500: Server error (database failure)

---

## 🧪 TESTING STRATEGY

### **Unit Tests (60 minutes)**

**File:** `backend/tests/test_phase2.py`

```python
import pytest
from app.fields.field_accessor import FieldAccessor
from app.icp.icp_matcher import ICPMatcher
from app.templates.variable_substitutor import VariableSubstitutor
from app.campaigns.campaign_builder import CampaignBuilder

# Test contacts (use real data from database)
GARRETT_GOLDEN_ID = "26259e8c-8770-48ef-8fac-a1f50e6a544f"
GRISELDA_CERVANTES_ID = "8676ca80-83b9-47a0-8774-c6cbc0af79d8"

class TestFieldAccessor:
    def test_get_denormalized_field(self):
        accessor = FieldAccessor(supabase_client)
        company = accessor.get_field(GARRETT_GOLDEN_ID, "company_name")
        assert company == "Wells Fargo" or company is not None
    
    def test_get_jsonb_field(self):
        accessor = FieldAccessor(supabase_client)
        persona = accessor.get_field(GARRETT_GOLDEN_ID, "persona")
        assert persona == "Manager"
    
    def test_batch_get_fields(self):
        accessor = FieldAccessor(supabase_client)
        fields = accessor.get_multiple_fields(GARRETT_GOLDEN_ID, ["first_name", "company_name", "persona"])
        assert fields["first_name"] == "Garrett"
        assert len(fields) == 3

class TestICPMatcher:
    def test_match_decision_maker(self):
        matcher = ICPMatcher(supabase_client, field_accessor)
        score = matcher.match_contact_to_icp(GRISELDA_CERVANTES_ID, default_icp_id)
        assert score >= 60  # Decision-maker should match
    
    def test_find_matching_contacts(self):
        matcher = ICPMatcher(supabase_client, field_accessor)
        matches = matcher.find_matching_contacts(default_icp_id, min_score=60)
        assert len(matches) >= 1  # At least Griselda

class TestVariableSubstitutor:
    def test_substitute_first_name(self):
        substitutor = VariableSubstitutor(field_accessor)
        result = substitutor.substitute("Hi {{first_name}}", GARRETT_GOLDEN_ID)
        assert result == "Hi Garrett"
    
    def test_substitute_full_email(self):
        substitutor = VariableSubstitutor(field_accessor)
        template = "Hi {{first_name}}, noticed you work at {{enrichment_company_name}}"
        result = substitutor.substitute(template, GARRETT_GOLDEN_ID)
        assert "Garrett" in result
        assert "Wells Fargo" in result or "company" in result.lower()

class TestCampaignBuilder:
    def test_build_campaign(self):
        builder = CampaignBuilder(supabase_client, icp_matcher, substitutor)
        campaign_id = builder.build_campaign(
            workspace_id=default_workspace_id,
            icp_id=default_icp_id,
            template_id=default_template_id,
            campaign_name="Test Campaign"
        )
        assert campaign_id is not None
    
    def test_campaign_preview(self):
        builder = CampaignBuilder(supabase_client, icp_matcher, substitutor)
        preview = builder.get_campaign_preview(test_campaign_id, limit=2)
        assert len(preview) <= 2
        assert "email_subject" in preview[0]
```

**Run tests:**
```bash
cd backend
pytest tests/test_phase2.py -v
```

---

### **End-to-End Test (30 minutes)**

**Scenario:** Create ICP → Match Contacts → Generate Campaign → Verify Emails

```python
def test_end_to_end_campaign_workflow():
    """Full workflow test"""
    
    # Step 1: Create ICP
    icp_response = requests.post(f"{API_URL}/api/v3/icps", json={
        "name": "Tech Decision Makers",
        "criteria": {
            "industries": ["Technology & Software", "SaaS"],
            "personas": ["Decision-maker", "Executive"]
        },
        "scoring_weights": {
            "industry_weight": 30,
            "persona_weight": 70
        }
    }, headers=auth_headers)
    
    assert icp_response.status_code == 200
    icp_id = icp_response.json()["id"]
    
    # Step 2: Get matches
    matches_response = requests.get(f"{API_URL}/api/v3/icps/{icp_id}/matches", headers=auth_headers)
    assert matches_response.status_code == 200
    matches = matches_response.json()["matches"]
    assert len(matches) >= 1
    
    # Step 3: Create campaign
    campaign_response = requests.post(f"{API_URL}/api/v3/campaigns", json={
        "name": "Q1 Outreach",
        "icp_id": icp_id,
        "template_id": default_template_id
    }, headers=auth_headers)
    
    assert campaign_response.status_code == 200
    campaign_id = campaign_response.json()["id"]
    
    # Step 4: Preview emails
    preview_response = requests.get(f"{API_URL}/api/v3/campaigns/{campaign_id}", headers=auth_headers)
    assert preview_response.status_code == 200
    preview = preview_response.json()
    
    # Step 5: Verify variable substitution
    first_email = preview["emails"][0]
    assert "{{" not in first_email["email_subject"]  # No unsubstituted variables
    assert "{{" not in first_email["email_body"]
    
    print("✅ End-to-end test passed!")
```

---

## 📦 DELIVERABLES CHECKLIST

### **Code Files**

- [ ] `backend/app/fields/__init__.py`
- [ ] `backend/app/fields/field_accessor.py` (complete implementation)
- [ ] `backend/app/icp/__init__.py`
- [ ] `backend/app/icp/icp_matcher.py` (complete implementation)
- [ ] `backend/app/templates/__init__.py`
- [ ] `backend/app/templates/variable_substitutor.py` (complete implementation)
- [ ] `backend/app/campaigns/__init__.py`
- [ ] `backend/app/campaigns/campaign_builder.py` (complete implementation)
- [ ] `backend/app/routers/phase2_router.py` (5 API endpoints)

### **Test Files**

- [ ] `backend/tests/test_field_accessor.py`
- [ ] `backend/tests/test_icp_matcher.py`
- [ ] `backend/tests/test_variable_substitutor.py`
- [ ] `backend/tests/test_campaign_builder.py`
- [ ] `backend/tests/test_phase2_api.py`
- [ ] `backend/tests/test_end_to_end.py`

### **Documentation**

- [ ] Docstrings on all classes/methods
- [ ] Type hints on all functions
- [ ] README update with new API endpoints
- [ ] API documentation (Swagger/OpenAPI auto-generated)

### **Verification**

- [ ] All unit tests passing (100% coverage target)
- [ ] End-to-end test passing
- [ ] API endpoints tested with Postman/curl
- [ ] No console errors/warnings
- [ ] Code follows existing project patterns

---

## 🚀 DEPLOYMENT CHECKLIST

### **Pre-Deploy**

- [ ] All tests passing locally
- [ ] Code committed to GitHub
- [ ] Environment variables set on Render
- [ ] Database migrations verified (already done in Phase 2A)

### **Deploy**

```bash
# Push to GitHub
git add .
git commit -m "Phase 2B: Backend classes + API endpoints complete"
git push origin main

# Render auto-deploys backend
# Wait 2-3 minutes for deployment
```

### **Post-Deploy Verification**

```bash
# Test health endpoint
curl https://latticeiq-backend.onrender.com/api/v3/health

# Test new ICP endpoint
curl -X POST https://latticeiq-backend.onrender.com/api/v3/icps \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test ICP", "criteria": {"industries": ["SaaS"]}}'

# Should return 200 with ICP ID
```

- [ ] Health check passes
- [ ] API endpoints return 200
- [ ] RLS policies enforced (cannot access other workspaces)
- [ ] No 500 errors in Render logs

---

## ⚠️ COMMON PITFALLS TO AVOID

### **1. Circular Dependencies**

❌ **Wrong:**
```python
# field_accessor.py imports icp_matcher.py
# icp_matcher.py imports field_accessor.py
# → Circular import error
```

✅ **Correct:**
```python
# Pass instances via __init__, not imports
class ICPMatcher:
    def __init__(self, field_accessor: FieldAccessor):
        self.field_accessor = field_accessor
```

### **2. Missing RLS Enforcement**

❌ **Wrong:**
```python
# Query without workspace_id filter
contacts = supabase.table("contacts").select("*").execute()
# → Returns ALL contacts across ALL workspaces (security breach)
```

✅ **Correct:**
```python
# Always filter by workspace_id from JWT
workspace_id = get_workspace_id_from_jwt(request)
contacts = supabase.table("contacts").select("*").eq("workspace_id", workspace_id).execute()
```

### **3. Hardcoded Test UUIDs**

❌ **Wrong:**
```python
GARRETT_ID = "26259e8c-8770-48ef-8fac-a1f50e6a544f"  # Hardcoded
```

✅ **Correct:**
```python
# Query by name for flexibility
garrett = supabase.table("contacts").select("id").eq("first_name", "Garrett").eq("last_name", "Golden").single().execute()
GARRETT_ID = garrett.data["id"]
```

### **4. N+1 Query Problem**

❌ **Wrong:**
```python
for contact_id in contact_ids:
    contact = supabase.table("contacts").select("*").eq("id", contact_id).execute()
    # → 100 contacts = 100 queries (SLOW)
```

✅ **Correct:**
```python
contacts = supabase.table("contacts").select("*").in_("id", contact_ids).execute()
# → 1 query for all contacts (FAST)
```

### **5. Unescaped {{variables}} in Error Messages**

❌ **Wrong:**
```python
raise ValueError(f"Variable {var_name} not found")
# If var_name = "{{first_name}}", error message will show {{first_name}}
```

✅ **Correct:**
```python
raise ValueError(f"Variable '{var_name}' (without brackets) not found")
```

---

## 📊 SUCCESS METRICS

### **Phase 2B Complete When:**

✅ **All 4 classes implemented**
- [ ] FieldAccessor (45 min)
- [ ] ICPMatcher (60 min)
- [ ] VariableSubstitutor (45 min)
- [ ] CampaignBuilder (60 min)

✅ **API functional**
- [ ] 5 endpoints working
- [ ] Pydantic validation passing
- [ ] RLS enforced

✅ **Tests passing**
- [ ] 20+ unit tests (100% passing)
- [ ] 1 end-to-end test (passing)
- [ ] No console errors

✅ **End-to-End Workflow Works**
- [ ] Create ICP via API → Returns ICP ID
- [ ] Match 482 contacts → Returns 1-2 matches
- [ ] Create campaign → Returns campaign ID
- [ ] Preview emails → All {{variables}} replaced
- [ ] Garrett Golden email: "Hi Garrett, noticed you work at Wells Fargo..."

---

## 🎯 NEXT SESSION STARTUP CHECKLIST

**When starting Phase 2B implementation:**

1. ✅ Read SESSION_LOG_JAN1_MIGRATIONS.md (this file's companion)
2. ✅ Verify database state:
   ```sql
   SELECT COUNT(*) FROM contacts;  -- Should be 482
   SELECT COUNT(*) FROM ideal_client_profiles;  -- Should be 1
   SELECT COUNT(*) FROM email_templates;  -- Should be 1
   ```
3. ✅ Pull latest code from GitHub
4. ✅ Check existing backend patterns:
   - Look at `backend/app/contacts/router.py` for FastAPI patterns
   - Look at `backend/app/enrichment/` for Supabase client usage
   - Look at `backend/app/scoring/` for calculation logic patterns
5. ✅ Create branch: `git checkout -b phase-2b-backend`
6. ✅ Start with FieldAccessor (simplest class, no dependencies)

---

## 📝 NOTES FOR NEXT DEVELOPER

### **Context Needed Before Starting**

Please provide in your first message:

1. **Backend structure:** Show `backend/app/` directory tree
2. **Existing router:** Share one existing router file (e.g., `contacts/router.py`) so I match your patterns exactly
3. **Supabase client setup:** How do you initialize the Supabase client? (e.g., `from app.database import get_supabase`)
4. **Auth middleware:** How do you extract workspace_id from JWT?
5. **Test setup:** Do you use pytest? What's your test file naming convention?

### **What I'll Provide**

Once I have those 5 items, I'll give you:

✅ **Complete, production-ready Python files** for all 4 classes  
✅ **Full API router** with Pydantic models  
✅ **Complete unit tests** (20+ tests)  
✅ **End-to-end test script**  
✅ **Deployment instructions**  

**No placeholders. No "implement this yourself." Entire, error-free scripts that match your exact codebase patterns.**

---

## 🔗 REFERENCES

- Previous session: SESSION_LOG_JAN1_MIGRATIONS.md
- Database schema: All 10 migrations documented in SQL_MIGRATIONS.md
- Architecture: EXECUTIVE_SUMMARY_PHASE2.md
- Master context: LATTICEIQ_MASTER_CONTEXT_FINAL.md
- GitHub: https://github.com/quatrorabes/latticeiq
- Live API: https://latticeiq-backend.onrender.com

---

**Status:** 🟡 READY TO START  
**Blocker:** None (Phase 2A complete)  
**Estimated Time:** 5-6 hours  
**Next Step:** Implement FieldAccessor class

---

**✅ Database ready. Classes planned. Start coding when you're ready.**
