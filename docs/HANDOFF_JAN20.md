# LatticeIQ Development Priorities - January 20, 2026
**Status:** Active Development - Ready for Implementation  
**Last Updated:** January 20, 2026, 9:45 PM PST  
**Priority Level:** P0 - Complete This Session  

---

## 📋 OVERVIEW

Two critical features ready for implementation:

1. **Batch Scoring Integration** (Frontend wiring) - 45 minutes
2. **ICP Matcher Implementation** (Backend classes) - 5-6 hours

---

## 🎯 ITEM 1: BATCH SCORING INTEGRATION (P0 - DO NOW)

### Status: Code In Place - Activation Ready

The batch scoring infrastructure is 95% complete. Only frontend wiring remains.

**What exists:**
- ✅ POST /api/v3/scoring/batch-score endpoint (registered)
- ✅ POST /api/v3/scoring/calculate-all/{contact_id} endpoint (registered)
- ✅ POST /api/v3/scoring/score-all endpoint (registered)
- ✅ Scoring calculators (MDCP, BANT, SPICE) fully implemented
- ✅ Supabase client injected into scoring router
- ✅ Frontend "Score All" button exists (ContactsTable.tsx)

**What's needed:** Wire frontend form → backend batch API call + proper error handling/UI feedback

### Implementation (3 Tasks - 45 min total)

#### Task 1.1: Complete Frontend API Integration (15 min)
**File:** `frontend/src/pages/ContactsPage.tsx`

Replace mock scoring with real API:

```tsx
const handleScoreAll = async () => {
  setIsScoring(true);
  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/v3/scoring/score-all`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Scoring failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Refresh contacts list to show new scores
    await fetchContacts();
    
    // Show success toast
    setScoreSuccess(`✅ Scored ${data.scored_count} contacts`);
    
  } catch (error) {
    setScoreError(`Failed to score contacts: ${error.message}`);
  } finally {
    setIsScoring(false);
  }
};
```

#### Task 1.2: Add Progress Feedback UI (10 min)
**File:** `frontend/src/pages/ContactsPage.tsx`

Add state and UI feedback:

```tsx
const [scoreSuccess, setScoreSuccess] = useState<string | null>(null);
const [scoreError, setScoreError] = useState<string | null>(null);
const [isScoring, setIsScoring] = useState(false);

// Clear messages after 5 seconds
useEffect(() => {
  if (scoreSuccess) {
    const timer = setTimeout(() => setScoreSuccess(null), 5000);
    return () => clearTimeout(timer);
  }
}, [scoreSuccess]);

// Render feedback
{scoreSuccess && (
  <div className="text-green-600 text-sm mt-2">
    {scoreSuccess}
  </div>
)}

{scoreError && (
  <div className="text-red-600 text-sm mt-2">
    {scoreError}
  </div>
)}
```

#### Task 1.3: Test End-to-End (20 min)

```bash
# Backend health check
curl https://latticeiq-backend.onrender.com/api/v3/health

# Frontend running
npm run dev  # in frontend/ directory

# Test batch scoring
# 1. Open http://localhost:5173/contacts
# 2. Click "Score All Contacts" button
# 3. Check network tab - POST to /api/v3/scoring/score-all returns 200
# 4. Verify success message appears
# 5. Check ContactsTable for updated scores

# Verify database persistence
SELECT mdcp_score, mdcp_tier, updated_at 
FROM contacts 
LIMIT 5;
```

**Expected outcome:** Click button → all 482 contacts scored → scores update in table within 30 seconds

---

## 🎯 ITEM 2: ICP MATCHER IMPLEMENTATION (P1 - AFTER BATCH SCORING)

### Status: Architecture Designed - Ready to Build

Phase 2B backend implementation. Build 4 core Python classes that power the ICP matching system.

**What exists:**
- ✅ Database schema (6 new tables created)
- ✅ 26 denormalized columns on contacts table
- ✅ RLS policies enforced
- ✅ 482 contacts seeded with workspace_id
- ✅ Empty placeholder Python files (ready to fill)
- ✅ API router with 5 endpoints (skeleton)
- ✅ Pydantic models defined

**What needs building:**
- 4 Python classes (145 min total implementation)
- API endpoint wiring (45 min)
- Unit tests (60 min)
- End-to-end test (30 min)
- Deployment verification (15 min)

### Architecture Overview

```
FieldAccessor (45 min)
    ↓
    Get any contact field value (denormalized, JSONB, HubSpot)
    
ICPMatcher (60 min)
    ↓
    Match contacts to Ideal Client Profiles
    Calculate weighted scores (industry, persona, company size)
    
VariableSubstitutor (45 min)
    ↓
    Replace {{firstname}}, {{companyname}} with actual values
    
CampaignBuilder (60 min)
    ↓
    Orchestrate: Match ICP → Generate emails → Store campaign
```

### Implementation Breakdown

#### 1. FieldAccessor Class (45 min)
**File:** `backend/app/fields/fieldaccessor.py`

**Purpose:** Unified API to get any contact field value

**Methods:**
- `get_field(contact_id, field_name)` - Get single field
- `get_multiple_fields(contact_id, field_names)` - Batch fetch
- `get_all_available_fields(contact_id)` - Get all non-null fields

**Field mapping:** 
- Fast: Denormalized columns (5ms) → enrichmentcompanyname
- Medium: JSONB paths (50ms) → enrichmentdata.quickenrich.companyname
- Slow: HubSpot metadata (100ms) → hubspotmetadata.hscompanyname

#### 2. ICPMatcher Class (60 min)
**File:** `backend/app/icp/icpmatcher.py`

**Purpose:** Match contacts to Ideal Client Profiles

**Methods:**
- `match_contact_to_icp(contact_id, icp_id)` - Score 0-100
- `find_matching_contacts(icp_id, min_score=60, limit=100)` - Get all matches
- `bulk_match_contacts(icp_id, contact_ids)` - Batch process

**Scoring algorithm:**
- Industry match: 30 points
- Persona match: 40 points
- Company size match: 30 points
- Total: 0-100 score

#### 3. VariableSubstitutor Class (45 min)
**File:** `backend/app/templates/variablesubstitutor.py`

**Purpose:** Replace variable placeholders with actual values

**Methods:**
- `substitute(template_text, contact_id)` - Replace all {{var}}
- `preview_substitution(template_id, contact_id)` - Preview email
- `get_available_variables(contact_id)` - List available vars

**Variable pattern:** `{{firstname}}`, `{{companyname}}`, `{{kernelwhathook}}`

#### 4. CampaignBuilder Class (60 min)
**File:** `backend/app/campaigns/campaignbuilder.py`

**Purpose:** Orchestrate campaign creation (match ICP → generate emails → store)

**Methods:**
- `build_campaign(workspace_id, icp_id, template_id, campaign_name)` - Create campaign
- `get_campaign_preview(campaign_id, limit=5)` - Preview emails
- `execute_campaign(campaign_id)` - Send emails (placeholder)

**Workflow:**
1. Match contacts to ICP (score ≥ 60)
2. Load email template
3. Generate personalized emails for each matched contact
4. Store campaign record + link contacts

### API Endpoints (5 total)

```
POST /api/v3/icps
    Create Ideal Client Profile
    
GET /api/v3/icps/{icp_id}/matches
    Get contacts matching ICP (filtered by min_score, limit)
    
POST /api/v3/campaigns
    Create campaign (ICP → email template)
    
GET /api/v3/campaigns/{campaign_id}
    Get campaign details + preview personalized emails
    
POST /api/v3/templates/preview
    Preview template with variable substitution
```

### Testing (90 min)

#### Unit Tests (60 min)
- 20 test cases across 4 classes
- 100% coverage target
- Real test data: Garrett Golden, Griselda Cervantes

#### End-to-End Test (30 min)
- Full workflow: Create ICP → Match contacts → Generate campaign → Preview emails
- Verify all variables replaced correctly
- Verify campaign metadata stored

### Deployment

**Pre-deploy checklist:**
```bash
# Run tests
cd backend
pytest tests/test_phase2.py -v

# Test health
curl https://latticeiq-backend.onrender.com/api/v3/health

# Push to GitHub (auto-deploys to Render)
git add .
git commit -m "Phase 2B: Backend classes + API endpoints"
git push origin main
```

**Post-deploy verification:**
- All unit tests passing
- End-to-end test passing
- Health endpoint returns 200
- No 500 errors in Render logs
- RLS policies enforced (no cross-workspace access)

---

## 📊 TIMELINE & ESTIMATES

### Session 1 (TODAY - ~45 min)
1. **Batch Scoring Integration** (P0)
   - Task 1.1: Frontend API wiring (15 min)
   - Task 1.2: UI feedback (10 min)
   - Task 1.3: E2E testing (20 min)
   - **Total: 45 minutes**

### Session 2 (TOMORROW - ~5-6 hours)
2. **ICP Matcher Implementation** (P1)
   - FieldAccessor class (45 min)
   - ICPMatcher class (60 min)
   - VariableSubstitutor class (45 min)
   - CampaignBuilder class (60 min)
   - API router + Pydantic models (45 min)
   - Unit tests (60 min)
   - End-to-end test (30 min)
   - Deploy + verify (15 min)
   - **Total: 5 hours 30 minutes**

---

## 🔄 WORKFLOW

### Batch Scoring (Item 1)
```
User clicks "Score All Contacts"
    ↓
Frontend calls POST /api/v3/scoring/score-all
    ↓
Backend loads all 482 contacts
    ↓
For each contact:
    - Calculate MDCP score
    - Calculate BANT score
    - Calculate SPICE score
    ↓
Update contacts table with scores
    ↓
Return { success: true, scored_count: 482 }
    ↓
Frontend shows "✅ Scored 482 contacts"
    ↓
ContactsTable refreshes with new scores
```

### ICP Matching (Item 2)
```
Admin creates ICP ("High-Value Decision Makers")
    ↓
    Criteria: Tech industry, Decision-maker persona, $50M+ revenue
    
Frontend calls POST /api/v3/campaigns
    ↓
    ICP ID, Email template ID, Campaign name
    
Backend:
    1. FieldAccessor gets fields for all 482 contacts
    2. ICPMatcher scores each contact against ICP criteria
    3. Finds matches (score ≥ 60)
    4. VariableSubstitutor personalizes emails for each match
    5. CampaignBuilder stores campaign + links contacts
    ↓
Frontend calls GET /api/v3/campaigns/{campaign_id}
    ↓
    Returns: Campaign metadata + preview of personalized emails
    ↓
Admin reviews emails, clicks "Send"
    ↓
Emails sent to matched contacts
```

---

## 📚 REFERENCE DOCUMENTS

**Batch Scoring:**
- SESSION_LOG_DEC30.md - Original scoring feature integration
- ARCHITECTURE_JAN8_UPDATE.md - Complete system architecture

**ICP Matching:**
- PHASE2B_IMPLEMENTATION_PLAN.md - Complete Phase 2B specification
- SESSIONLOGJAN1MIGRATIONS.md - Database schema (Phase 2A)
- SQLMIGRATIONS.md - All 10 migrations documented

**Deployment:**
- Frontend: https://latticeiq.vercel.app
- Backend: https://latticeiq-backend.onrender.com
- API Docs: https://latticeiq-backend.onrender.com/api/docs

---

## ✅ SUCCESS CRITERIA

### Batch Scoring Complete When:
- [ ] Frontend calls real API (not mock)
- [ ] Success/error messages display
- [ ] Contacts table updates with scores
- [ ] All 482 contacts have MDCP/BANT/SPICE scores
- [ ] Database persists scores
- [ ] End-to-end test passes

### ICP Matching Complete When:
- [ ] All 4 Python classes implemented
- [ ] 5 API endpoints working
- [ ] 20 unit tests passing (100% coverage)
- [ ] End-to-end test passing
- [ ] Campaign creation works
- [ ] Email personalization works
- [ ] Deployed to production
- [ ] No 500 errors in logs

---

## 👤 NEXT DEVELOPER HANDOFF

**Current state:** Batch scoring code exists, frontend wiring incomplete. ICP matcher architecture designed, code not yet written.

**Your task (Session 1):** Complete batch scoring frontend integration (45 min). Then context-switch to ICP matcher.

**Your task (Session 2):** Implement 4 Python classes + API endpoints + tests (5-6 hours).

**Expected outcome:** Click "Score All" → 482 contacts scored. Create campaign → matches found → emails personalized.

**No blockers. High confidence. All pieces exist.** 🚀

---

**Status:** Ready for implementation  
**Last Updated:** January 20, 2026, 9:45 PM PST  
**Author:** Dev Session - Priority Planning
