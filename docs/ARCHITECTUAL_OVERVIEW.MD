┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                               │
│  • Multi-user isolation via Supabase Auth (JWT tokens)          │
│  • Row-Level Security (RLS) on all tables                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND - React + TypeScript (Vercel)              │
├─────────────────────────────────────────────────────────────────┤
│  AUTH LAYER                                                      │
│  • Login/Signup (Supabase Auth)                                  │
│  • Session management                                            │
│  • JWT token storage                                             │
├─────────────────────────────────────────────────────────────────┤
│  CONTACT MANAGEMENT                                              │
│  • Contact list (table view)                                     │
│  • Contact detail (modal/page)                                   │
│  • Add contact form                                              │
│  • Delete contact                                                │
├─────────────────────────────────────────────────────────────────┤
│  ENRICHMENT UI                                                   │
│  • "Enrich" button (triggers POST /api/contacts/{id}/enrich)    │
│  • Polling status (GET /api/contacts/{id}/enrichment-status)    │
│  • Progress indicator (pending → enriching → completed)          │
│  • Display enrichment sections                                   │
├─────────────────────────────────────────────────────────────────┤
│  SCORING DISPLAY                                                 │
│  • APEX score widget                                             │
│  • MDCP/RSS breakdown                                            │
│  • BANT score card                                               │
│  • SPICE score card                                              │
├─────────────────────────────────────────────────────────────────┤
│  DASHBOARD VIEWS                                                 │
│  • Today's Board (segmented by score tier)                       │
│  • Smart Lists (Hot Leads, Ready to Call, etc.)                 │
│  • Cold Call Queue                                               │
│  • Analytics dashboard                                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │ REST API calls (JWT in Authorization header)
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND - FastAPI + Python (Render)                 │
├─────────────────────────────────────────────────────────────────┤
│  MIDDLEWARE                                                      │
│  • JWT verification (Supabase Auth)                              │
│  • User extraction from token                                    │
│  • CORS handling                                                 │
├─────────────────────────────────────────────────────────────────┤
│  CONTACT CRUD ENDPOINTS                                          │
│  • GET /api/contacts (filtered by user_id)                       │
│  • GET /api/contacts/{id}                                        │
│  • POST /api/contacts (adds user_id)                             │
│  • PUT /api/contacts/{id}                                        │
│  • DELETE /api/contacts/{id}                                     │
│                                                                  │
│  WHY: Basic contact management with automatic user isolation     │
├─────────────────────────────────────────────────────────────────┤
│  ENRICHMENT ENDPOINTS                                            │
│  • POST /api/contacts/{id}/enrich                                │
│    └─> Triggers enrichment_engine.py (background task)          │
│  • GET /api/contacts/{id}/enrichment-status                      │
│    └─> Returns enrichment_status + data preview                 │
│                                                                  │
│  WHY: Trigger 3-stage enrichment & poll progress                 │
├─────────────────────────────────────────────────────────────────┤
│  SCORING ENDPOINTS                                               │
│  • POST /api/contacts/{id}/calculate-scores                      │
│    └─> Runs scoring_engine.py (APEX/BANT/SPICE)                │
│  • POST /api/contacts/batch-score                                │
│    └─> Bulk score calculation                                   │
│                                                                  │
│  WHY: Calculate multi-framework scores on demand or after enrich │
├─────────────────────────────────────────────────────────────────┤
│  DASHBOARD ENDPOINTS                                             │
│  • GET /api/today's-board                                        │
│    └─> Aggregates contacts by APEX score tiers                  │
│  • GET /api/smart-lists                                          │
│    └─> Pre-filtered views (Hot Leads, etc.)                     │
│  • GET /api/analytics                                            │
│    └─> Stats: total contacts, enriched %, avg scores            │
│                                                                  │
│  WHY: Power dashboard UI with aggregated data                    │
├─────────────────────────────────────────────────────────────────┤
│  COLD CALL QUEUE ENDPOINTS                                       │
│  • GET /api/cold-call-queue                                      │
│  • POST /api/cold-call-queue (add contact to queue)             │
│  • PUT /api/cold-call-queue/{id} (update attempt status)        │
│                                                                  │
│  WHY: Sales workflow - track call attempts                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│              AI ENGINES - Python Modules                         │
├─────────────────────────────────────────────────────────────────┤
│  enrichment_engine.py (PROVEN APEX LOGIC)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ STAGE 1: Perplexity Research                                │ │
│  │  • Query: "{name} at {company}, {title}"                    │ │
│  │  • Model: sonar-pro                                         │ │
│  │  • Output: 500-2000 word intelligence report                │ │
│  │  • WHY: Gather raw data from web                            │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ STAGE 2: GPT-4 Synthesis                                    │ │
│  │  • Input: Perplexity raw text + contact metadata            │ │
│  │  • Model: gpt-4                                             │ │
│  │  • Prompt: "Generate structured sales profile with 6        │ │
│  │    sections: Executive Summary, Role & Responsibilities,    │ │
│  │    Company Intelligence, Deal Triggers, Objection Handlers, │ │
│  │    Connection Angles"                                       │ │
│  │  • Output: Markdown-formatted intelligence (1500-2500 chars)│ │
│  │  • WHY: Structure raw data into actionable sales intel      │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ STAGE 3: Section Parser                                     │ │
│  │  • Input: GPT-4 markdown text                               │ │
│  │  • Logic: Extract sections by ## headers                    │ │
│  │  • Output: JSON array of {title, content} objects           │ │
│  │  • WHY: Make sections displayable in UI                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  scoring_engine.py (PROVEN APEX LOGIC)                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ MDCP Score (Match, Data, Contact, Profile) - 0-100          │ │
│  │  • Match: ICP alignment (25 pts)                            │ │
│  │  • Data: Enrichment completeness (25 pts)                   │ │
│  │  • Contact: Persona tier scoring (25 pts)                   │ │
│  │  • Profile: Field completeness (25 pts)                     │ │
│  │  • WHY: Measure data quality & fit                          │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ RSS Score (Readiness, Suitability, Seniority) - 0-100       │ │
│  │  • Readiness: Buying signals (40 pts)                       │ │
│  │  • Suitability: Vertical fit (30 pts)                       │ │
│  │  • Seniority: Title analysis (30 pts)                       │ │
│  │  • WHY: Measure sales-readiness                             │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ APEX Score - Average of MDCP + RSS                          │ │
│  │  • Formula: (MDCP + RSS) / 2                                │ │
│  │  • Tiers: HIGH (75+), MEDIUM (50-74), LOW (20-49)           │ │
│  │  • WHY: Single unified score for prioritization             │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ BANT Score (Budget, Authority, Need, Timeline) - 0-100      │ │
│  │  • Budget: Inferred from enrichment (25 pts)                │ │
│  │  • Authority: Title-based (25 pts)                          │ │
│  │  • Need: Pain points identified (25 pts)                    │ │
│  │  • Timeline: Urgency signals (25 pts)                       │ │
│  │  • WHY: Traditional sales qualification                     │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ SPICE Score (Situation, Problem, Implication, Critical      │ │
│  │               Event, Decision) - 0-100                       │ │
│  │  • Each component: 20 pts                                   │ │
│  │  • WHY: Enterprise sales qualification                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  persona_classifier.py                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Title-to-Persona Mapping                                    │ │
│  │  • SaaS: CEO→DECISION_MAKER, VP→CHAMPION, etc.             │ │
│  │  • Insurance: Agent→BROKER, Owner→DECISION_MAKER            │ │
│  │  • Equipment: CFO→DECISION_MAKER, Fleet Mgr→FLEET_MANAGER   │ │
│  │  • WHY: Auto-classify contact by role                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│         DATABASE - PostgreSQL (Supabase) + RLS                   │
├─────────────────────────────────────────────────────────────────┤
│  TABLE: profiles                                                 │
│  • id (UUID, FK to auth.users)                                   │
│  • email, full_name, created_at                                  │
│  • WHY: User metadata linked to auth                             │
├─────────────────────────────────────────────────────────────────┤
│  TABLE: contacts (PRIMARY DATA MODEL)                            │
│  • id (SERIAL PK)                                                │
│  • user_id (UUID, FK to profiles) ← ISOLATION KEY                │
│  • Core: first_name, last_name, email, phone, company, title    │
│  • Enrichment: enrichment_status, enrichment_data (JSONB),       │
│    enriched_at                                                   │
│  • APEX Scores: apex_score, mdcp_score, rss_score, match_tier   │
│  • BANT: bant_total_score, bant_budget_score, bant_authority_   │
│    score, bant_need_score, bant_timeline_score, ...              │
│  • SPICE: spice_total_score, spice_situation_score, ...          │
│  • Persona: persona_type, persona_confidence                     │
│  • RLS: WHERE user_id = auth.uid()                               │
│  • WHY: Store all contact data + enrichment + scores             │
├─────────────────────────────────────────────────────────────────┤
│  TABLE: cold_call_queue                                          │
│  • id, user_id, contact_id, name, phone, company, title         │
│  • quick_fit_score, priority, status, attempts, outcome         │
│  • RLS: WHERE user_id = auth.uid()                               │
│  • WHY: Track sales call workflow per user                       │
└─────────────────────────────────────────────────────────────────┘
