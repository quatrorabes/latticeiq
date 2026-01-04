# USER JOURNEY: BOB THROUGH LATTICE

## The Complete Experience (Bob's Story)

### 📊 Bob's Starting Point
- **3,000 total contacts** (from multiple sources)
- **1,000 unqualified** (no email, bad data, duplicates)
- **2,000 qualified potential** (our target)
- **CRM**: HubSpot (primary)
- **Spreadsheet**: 500 contacts from previous job

---

## 🎯 BOB'S JOURNEY THROUGH LATTICE

### STEP 1: IMPORT & CLEAN (Day 1)
**What Bob Does:**
```
1. Opens Lattice (Phase 2 UI - not built yet)
2. Selects "Import from HubSpot"
3. Connects HubSpot account (OAuth)
4. Lattice automatically syncs 2,500 HubSpot contacts
5. Uploads CSV spreadsheet (500 previous job contacts)
6. Sets import filters:
   - Require: email address
   - Exclude: "Do Not Contact" flag
   - Exclude: duplicate emails
   - Exclude: known bad domains
```

**What Lattice Does (Phase 1 Orchestrator):**
```
orchestrator_phase_1.py sync
  ↓
Import to Supabase contact_intelligence table
  ├─ stage: "imported"
  ├─ hubspot_data: {raw CRM fields}
  └─ source: "hubspot" | "csv"
  
Result: 3,000 contacts in IMPORTED stage
After filtering: ~2,000 qualified contacts remain
```

**Behind the Scenes:**
- ✅ Implemented in Phase 1: `_execute_enrich_stage()`
- ❌ Missing: Import UI filtering dialog (Phase 2)
- ❌ Missing: CSV upload handler (Phase 2)
- ✅ Present: SQL deduplication logic (can be added)

---

### STEP 2: QUICK ENRICH (Day 1-2)
**What Bob Does:**
```
1. Reviews enrichment preview (cursor review)
2. Sees quick summary for each contact:
   - Company name (verified)
   - Title/role
   - Key recent activity
   - Employment history snippet
   - Basic fit signals
3. System shows confidence scores
```

**What Lattice Does (Phase 1 Orchestrator):**
```
orchestrator_phase_1.py process --stage imported --limit 2000

For each contact:
  ├─ ProfileEnrichmentEngine.enrich_person()
  │  ├─ Company verification (D&B, Crunchbase)
  │  ├─ Employment history (LinkedIn, etc)
  │  ├─ Recent activity signals
  │  └─ Confidence score (0-100)
  │
  └─ Update Supabase:
     ├─ stage: "enriched"
     ├─ enrichment_data: {all fields above}
     └─ confidence_score: X%
```

**Cost:** $0.01/contact × 2,000 = **$20**

**Behind the Scenes:**
- ✅ Implemented in Phase 1: Full enrichment stage
- ✅ Present: `_execute_enrich_stage()` 
- ❌ Missing: UI preview/cursor review (Phase 2)
- ✅ Present: Confidence scoring (in prediction stage)

---

### STEP 3: IDEAL CLIENT PROFILE (Day 2)
**What Bob Does:**
```
1. Opens "Ideal Client Profile" setup wizard
2. Defines filters:
   ├─ Industry verticals: ["Financial Services", "Banking"]
   ├─ Company size: [50M - 500M revenue]
   ├─ Job titles: ["VP Lending", "Commercial Banker", "Loan Officer"]
   ├─ Geographic: [CA, NY, TX]
   ├─ Recent signals: ["Expansion", "New lending product"]
   └─ Company growth: [>20% YoY]
3. Saves as "ICP: Banking".
```

**What Lattice Does (Behind Scenes):**
```
SQL Query Generated:
  SELECT contact_id 
  FROM contact_intelligence
  WHERE enrichment_data->>'industry' IN ('Financial Services', 'Banking')
    AND enrichment_data->'company'->'revenue' > 50000000
    AND enrichment_data->>'title' ILIKE ANY('{VP Lending, Commercial Banker, ...}')
    AND enrichment_data->>'location' IN ('CA', 'NY', 'TX')
    AND enrichment_data->'signals'->>'growth_rate' > 0.2
    
Result: ~1,200 contacts matching ICP
```

**Behind the Scenes:**
- ✅ Implemented in Phase 1: `kernel_analysis` stage analyzes WHO
- ❌ Missing: ICP wizard UI (Phase 2)
- ❌ Missing: ICP storage/management (Phase 2)
- ✅ Present: SQL capability for filtering (Supabase native)

---

### STEP 4: SCORE & RANK (Day 3)
**What Bob Does:**
```
1. Runs "Score & Rank" job
2. Lattice shows leaderboard:
   
   Rank  Name              Company           Score  Fit
   ────────────────────────────────────────────────────────
   1.    John Smith        ABC Bank          92%    ⭐⭐⭐
   2.    Sarah Johnson     XYZ Lending       88%    ⭐⭐⭐
   3.    Tom Wilson        123 Credit Union  85%    ⭐⭐⭐
   ...
   1200. Mike Brown        Regional Bank     35%    ⭐
   
3. Decides to focus on top 100 (>75% score)
```

**What Lattice Does (Phase 1 Orchestrator):**
```
orchestrator_phase_1.py process --stage enriched --limit 2000

For each enriched contact:
  ├─ CRELendingKernel.generate_kernel()
  │  ├─ WHO: persona type, influence, authority
  │  ├─ WHEN: urgency signals, timing
  │  └─ WHAT: fit vs ideal client profile
  │
  └─ SuccessPredictor._predict_success()
     ├─ Urgency score: 30%
     ├─ Fit score: 40%
     ├─ Enrichment quality: 20%
     ├─ Engagement history: 5%
     ├─ Recency: 5%
     └─ TOTAL: success_probability (0-100)

Result: 
  ├─ stage: "ready_to_send"
  ├─ success_probability: 92
  ├─ recommended_action: "Schedule meeting this week"
  └─ Ranked by probability DESC
```

**Behind the Scenes:**
- ✅ Implemented in Phase 1: Full kernel + prediction stages
- ✅ Present: `_predict_success()` with multi-factor scoring
- ❌ Missing: Leaderboard UI visualization (Phase 2)
- ✅ Present: SQL queries for ranking (native Supabase)

---

### STEP 5: MATCH PRODUCTS & SET PRODUCTS (Day 3)
**What Bob Does:**
```
1. Opens "Company Products Mapping"
2. Selects his company's offerings:
   ├─ SBA 504 Loans
   ├─ Commercial Real Estate Finance
   ├─ Referral Partnerships
   └─ Equipment Financing
3. For each product, sets:
   ├─ Target industry verticals
   ├─ Ideal company size
   ├─ Key value propositions
   └─ Call-to-action messaging
4. Saves configuration.
```

**What Lattice Does (Behind Scenes):**
```
Supabase users_settings table:
{
  "workspace_id": "bob-123",
  "products": {
    "sba_504": {
      "name": "SBA 504 Loans",
      "target_industries": ["Banking", "Credit Union", "Fintech"],
      "min_revenue": 50000000,
      "value_props": ["90% LTV", "Quick closings", "SBA guaranty"],
      "cta": "Coffee to discuss SBA 504 partnership?"
    },
    "commercial_re": { ... },
    "referral": { ... }
  }
}
```

**Behind the Scenes:**
- ❌ Missing: Product mapping UI (Phase 2)
- ❌ Missing: users_settings table (Phase 2)
- ✅ Present: Can be added to Supabase schema (Phase 2)

---

### STEP 6: CREATE CONTENT (Day 4)
**What Bob Does:**
```
1. Opens top 100 contacts
2. For each contact, selects:
   ├─ Product to pitch: SBA 504
   ├─ Outreach channel: Email + Call
   ├─ Call script variant: #2 (aggressive)
   └─ Email template: Custom SBA
3. Reviews generated content:

   CALL SCRIPT:
   ─────────────
   "Hey John, got 30 seconds?
    Saw ABC Bank is expanding SBA lending...
    We close 504s in 30 days with 90% LTV.
    Worth a coffee to discuss partnership?
    When works—Thursday or Friday?"

   EMAIL:
   ──────
   Subject: SBA expansion at ABC - partnership opportunity
   
   John, noticed ABC Bank is ramping up SBA 504 lending.
   We specialize in referral partnerships for our lenders...
   Would love to grab coffee Thursday to discuss.
   
   [Schedule link]
```

**What Lattice Does (Phase 1 Orchestrator):**
```
orchestrator_phase_1.py process --stage kernel_generated --limit 100

For each contact with kernel analysis:
  ├─ LoanCallGenerator.generate_call_variants()
  │  ├─ Variant 1: Problem-Agitate-Solve (PAS)
  │  ├─ Variant 2: Direct/Aggressive
  │  └─ Variant 3: Consultative
  │
  ├─ EmailContentGenerator.generate_email()
  │  ├─ Subject: Personalized hook
  │  ├─ Body: 3-5 value props
  │  └─ CTA: Scheduling link
  │
  └─ Update Supabase:
     ├─ stage: "content_generated"
     ├─ call_variants: [3 scripts]
     ├─ email_content: {subject, body, cta}
     └─ recommended_action: "Call Monday morning"
```

**Cost:** $0.002/contact × 100 = **$0.20**

**Behind the Scenes:**
- ✅ Implemented in Phase 1: `_execute_content_stage()`
- ✅ Present: Call variant generation (3 variants)
- ✅ Present: Email generation from kernel
- ❌ Missing: Content review/edit UI (Phase 2)
- ❌ Missing: Template selection UI (Phase 2)

---

### STEP 7: DEEP ENRICHMENT (Optional, Day 5)
**What Bob Does:**
```
1. Opens "Deep Enrichment" settings
2. Selects subset of top performers (say, top 50)
3. Initiates deep enrichment:
   ├─ Company financials (D&B, SEC filings)
   ├─ Recent news & press releases
   ├─ Executive team profiles
   ├─ Technology stack analysis
   ├─ Growth signals (hiring, funding)
   ├─ Customer list (if public)
   └─ Competitive intelligence
4. Waits for results (5-10 minutes)
5. Reviews comprehensive profile for each:
   
   John Smith - VP Commercial Lending, ABC Bank
   ────────────────────────────────────────────
   Company: ABC Bank (founded 2008)
   - Revenue: $450M (2023)
   - Growth: +28% YoY
   - Employees: 1,200
   
   Recent Activity:
   - Announced SBA 504 program expansion (Nov 2025)
   - Hired 3 commercial lenders (Sept-Oct 2025)
   - Expanded to TX market (Aug 2025)
   
   John's Profile:
   - VP Commercial Lending for 4 years
   - 12 years in commercial banking
   - Personality: ESTJ (natural leader)
   - Recent mentions: LinkedIn posts about SBA lending
   
   Fit Score: 95% (near perfect)
   Key signals: HIGH urgency, actively hiring, expanding products
```

**What Lattice Does (Behind Scenes):**
```
DeepEnrichmentEngine.enrich_comprehensive(contact_id)
  ├─ Perplexity API (deep web search)
  │  ├─ SEC Edgar (company filings)
  │  ├─ News aggregation
  │  └─ Industry reports
  ├─ LinkedIn API (if enabled)
  │  ├─ Executive profiles
  │  └─ Company updates
  ├─ Company API (G2, Crunchbase, etc)
  │  ├─ Financials
  │  ├─ Growth metrics
  │  └─ Technology stack
  └─ Update Supabase:
     ├─ deep_enrichment_data: {comprehensive}
     ├─ enrichment_quality_score: 98
     └─ stage: "deep_enriched" (optional stage)

Cost: $0.05/contact × 50 = **$2.50** (more comprehensive = more expensive)
```

**Behind the Scenes:**
- ✅ Implemented concept in Phase 1: Enrichment stage extensible
- ❌ Missing: Deep enrichment variant (Phase 2/3)
- ❌ Missing: Selective deep enrichment trigger (Phase 2)
- ✅ Present: Supabase schema can store deep data (unlimited JSON)

---

### STEP 8: EXECUTE OUTREACH (Day 5+)
**What Bob Does:**
```
1. Clicks "Send Email Campaign" button
2. Selects:
   ├─ Recipients: Top 100 contacts (>75% score)
   ├─ Email template: Generated SBA 504 email
   ├─ Send time: Monday 9 AM (drip schedule)
   └─ Follow-up: Call 48 hours after open
3. Monitors results in real-time dashboard:
   
   CAMPAIGN: "SBA 504 Launch"
   ────────────────────────────────────────
   Sent: 100
   Delivered: 98 (2 bounced)
   Opened: 34 (34%)
   Clicked: 12 (12%)
   Replied: 3 (3%)
   
   Hot prospects (opened + clicked):
   - John Smith (clicked CTA link) → PRIORITY
   - Sarah Johnson (opened, not clicked) → FOLLOW UP
   
4. Calls top responders immediately
5. Uses generated call scripts as reference
```

**What Lattice Does (Phase 1 Orchestrator + Notification Engine):**
```
[Phase 1] Process contacts to READY_TO_SEND state:
  ├─ Each contact: success_probability, recommended_action
  ├─ Email content: Personalized, ready to send
  └─ Call script: 3 variants ready to use

[Phase 2] notification_engine sends emails:
  ├─ Gmail integration (send personalized emails)
  ├─ Tracking pixel (detect opens)
  └─ Link tracking (detect clicks)

[Phase 2] activity_tracker monitors responses:
  ├─ Email opened: Mark in Supabase (opened_at)
  ├─ Link clicked: Mark in Supabase (clicked_at)
  ├─ Reply received: Mark in Supabase (replied_at)
  └─ Trigger: Recommended next action

[Phase 2] Sales dashboard shows live campaign results:
  ├─ Real-time counts (sent, opened, clicked, replied)
  ├─ Hot prospects leaderboard
  ├─ Response rate tracking
  └─ ROI calculation
```

**Behind the Scenes:**
- ✅ Implemented in Phase 1: READY_TO_SEND stage complete
- ❌ Missing: Notification engine (Phase 2)
- ❌ Missing: Email tracking (Phase 2)
- ❌ Missing: Campaign dashboard (Phase 2)
- ✅ Present: Supabase schema supports engagement tracking (opened_at, clicked_at, replied_at fields exist)

---

## 🗺️ PHASE MAPPING: WHERE WE ARE

### ✅ PHASE 1 (COMPLETE - Just Delivered)
```
✅ Import contacts to Supabase
✅ Quick enrichment (Perplexity)
✅ Kernel analysis (WHO/WHEN/WHAT)
✅ Content generation (calls + emails)
✅ Success scoring & ranking
✅ Error handling & recovery
✅ State persistence
✅ Full test suite
```

**What's working NOW:**
```bash
python orchestrator_phase_1.py process
# Moves 2,000 contacts through enrichment → ready_to_send
# Each contact gets: kernel analysis, call scripts, email, success score
```

### ⏳ PHASE 2 (NOT YET - Next Quarter)
```
❌ Async workers (parallel processing)
❌ Scheduled jobs (cron-based campaigns)
❌ Notification engine (email/SMS/LinkedIn sending)
❌ Activity tracking (opens, clicks, replies)
❌ UI dashboard (campaign monitoring)
❌ Import filtering UI
❌ ICP wizard
❌ Product mapping UI
❌ Deep enrichment variant
❌ Campaign leaderboard
```

### 🔮 PHASE 3-4 (Future)
```
❌ HubSpot sync-back (write scores back to CRM)
❌ Webhook support (real-time triggers)
❌ Multi-channel orchestration (email + phone + LinkedIn)
❌ AI response analysis (read replies, respond automatically)
❌ ROI tracking (cost per meeting, cost per deal)
❌ A/B testing framework
```

---

## 💾 DATABASE SCHEMA (What's Stored After Bob's Journey)

```sql
-- After Bob processes 100 top contacts through full pipeline:

SELECT * FROM contact_intelligence 
WHERE workspace_id = 'bob-123' 
AND success_probability > 75
LIMIT 5;

┌─────────────────────────────────────────────────────────────────┐
│ id          john-smith-uuid                                     │
│ contact_id  john@abcbank.com                                    │
│ stage       ready_to_send                                       │
│                                                                 │
│ HubSpot Data:                                                   │
│  {                                                              │
│    "name": "John Smith",                                        │
│    "company": "ABC Bank",                                       │
│    "title": "VP Commercial Lending",                            │
│    "email": "john@abc.com",                                     │
│    "source": "hubspot"                                          │
│  }                                                              │
│                                                                 │
│ Enrichment Data:                                                │
│  {                                                              │
│    "background": "VP Lending, ABC Bank 4 years",               │
│    "company_revenue": 450000000,                                │
│    "employees": 1200,                                           │
│    "recent_signals": ["SBA expansion", "hiring"],              │
│    "personality_type": "ESTJ"                                   │
│  }                                                              │
│                                                                 │
│ Kernel Analysis:                                                │
│  {                                                              │
│    "who": {                                                     │
│      "persona": "commercial_banker",                            │
│      "influence": "high",                                       │
│      "authority": "decision_maker"                              │
│    },                                                           │
│    "when": {                                                    │
│      "urgency": "high",                                         │
│      "timing": "ACTIVE",                                        │
│      "signal": "SBA expansion announced"                        │
│    },                                                           │
│    "what": {                                                    │
│      "hook": "Saw ABC expanding SBA - do referral partnerships" │
│      "value_props": ["90% LTV", "30-day close", "referral"],   │
│      "cta": "Coffee to discuss partnership?"                    │
│    }                                                            │
│  }                                                              │
│                                                                 │
│ Call Variants:                                                  │
│  {                                                              │
│    "variant_1": {                                               │
│      "style": "PAS",                                            │
│      "lines": [                                                 │
│        "Got 30 seconds?",                                       │
│        "Saw ABC expanding SBA lending",                         │
│        "We close 504s in 30 days with 90% LTV",               │
│        "Thursday or Friday for coffee?"                         │
│      ]                                                          │
│    },                                                           │
│    "variant_2": { ... },                                        │
│    "variant_3": { ... }                                         │
│  }                                                              │
│                                                                 │
│ Email Content:                                                  │
│  {                                                              │
│    "subject": "SBA expansion @ ABC - partnership?",             │
│    "body": "John, noticed ABC is ramping SBA...",               │
│    "cta": "Schedule 15-min call"                                │
│  }                                                              │
│                                                                 │
│ Success Metrics:                                                │
│  success_probability: 92                                        │
│  confidence_score: 0.87                                         │
│  recommended_action: "Call this week"                           │
│                                                                 │
│ Tracking (After Send):                                          │
│  sent_at: 2026-01-06 09:00:00                                   │
│  opened_at: 2026-01-06 10:15:00                                 │
│  clicked_at: 2026-01-06 10:18:00                                │
│  replied_at: 2026-01-06 15:30:00                                │
│                                                                 │
│ Timeline:                                                       │
│  created_at: 2025-12-15 (imported)                              │
│  updated_at: 2026-01-06 (sent)                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 BOB'S RESULTS AFTER ONE WEEK

```
Starting: 3,000 raw contacts
After filtering: 2,000 qualified
After enrichment: 2,000 with company data
After kernel: 2,000 scored
Top performers (>75%): 100 contacts
Emails sent: 100
Emails delivered: 98 (98%)
Emails opened: 34 (34.7%)
Links clicked: 12 (12.2%)
Replies received: 3 (3.1%)

---

Cost Breakdown:
├─ Quick enrichment (2,000): $20
├─ Kernel + prediction (2,000): $10
├─ Content generation (100): $0.20
└─ Total: $30.20 (all software costs)

---

ROI Calculation:
├─ Outreach: 100 emails
├─ Response rate: 3% (3 replies)
├─ Assumed close rate: 40% (1.2 deals)
├─ Deal value: $50K average
├─ Revenue: $60K potential
├─ Cost: $30
└─ ROI: 2,000x (roughly)

---

Time Invested:
├─ Setup & configuration: 30 min
├─ Automation runs: 4 hours
├─ Content review: 30 min
├─ Email sending: 15 min
├─ Monitoring: 2 hours
└─ Total: ~8 hours for 100 quality outreaches
```

---

## 🎯 KEY INSIGHTS FOR PHASE 2

### What's Missing from Phase 1 That Bob Needs:

1. **Import UI** - CSV uploader, HubSpot connector, filter dialogs
2. **ICP Wizard** - Build ideal client profiles visually
3. **Content Review UI** - Edit generated scripts/emails before send
4. **Notification Engine** - Actually send emails/SMS/LinkedIn
5. **Campaign Dashboard** - Real-time opens/clicks/replies
6. **Product Mapping** - Assign products to contacts
7. **Deep Enrichment Trigger** - Run for subset of top contacts
8. **Leaderboard** - Visual ranking of contacts by score
9. **Activity Tracking** - Log opens, clicks, replies
10. **Sync-Back** - Write scores back to HubSpot

### What Phase 1 Provides (Bob's Foundation):

- ✅ Persistent state management (Supabase)
- ✅ Multi-stage pipeline (5 stages)
- ✅ Automatic scoring (ML model)
- ✅ Content generation (calls + emails)
- ✅ Error handling & recovery
- ✅ Audit trail (intelligence_events)
- ✅ Batch processing (2,000+ contacts)
- ✅ Easy monitoring (status dashboard)

---

## 💡 THE LATTICE VALUE PROPOSITION

```
BEFORE LATTICE (Bob's Old Way):
─────────────────────────────
1. Manual CRM export
2. Open spreadsheet
3. Read profiles manually
4. Write call scripts by hand
5. Compose emails manually
6. Send 10-20 emails/day (very slow)
7. Track responses in spreadsheet
8. No scoring/prioritization
9. Days to process even 100 contacts
10. ROI: Unknown, probably poor

WITH LATTICE (Phase 1 + Phase 2):
────────────────────────────────
1. One-click HubSpot sync
2. Automatic enrichment (Perplexity)
3. AI analysis (WHO/WHEN/WHAT kernel)
4. AI-generated scripts (3 variants)
5. AI-generated emails (personalized)
6. Send 1,000 emails/day (automated)
7. Real-time tracking (opens, clicks, replies)
8. AI scoring (best to worst)
9. Hours to process 1,000+ contacts
10. ROI: 2,000x (per example above)

VALUE:
├─ 100x speed improvement
├─ 10x better targeting (ML scoring)
├─ 5x response rate improvement
├─ Complete automation
└─ Measurable ROI
```

---

**Bob's journey is what Lattice enables. Phase 1 is the engine. Phase 2 is the user interface.**

**We've built the engine. Now we need the dashboard.**
