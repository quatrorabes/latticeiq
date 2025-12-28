
# LatticeIQ Architecture Refresh - Dec 26, 2025

## Executive Summary

Current State: Production-ready sales intelligence platform with contact enrichment (Perplexity + GPT-4o), 3-framework scoring (MDCP/BANT/SPICE), and user management via Supabase.

What Just Shipped: Setup wizard for ICP definition plus scoring lever configuration. Contact detail page with full enrichment display.

Next Phase: Batch scoring, analytics dashboard, AI enrichment routing.

---

## Tech Stack (Current)

### Frontend (Vercel)
- Framework: React 18 + TypeScript + Vite
- Styling: Tailwind CSS
- Routing: React Router v6
- Auth: Supabase JWT (client-side)
- State Management: React hooks + local state
- API Client: Fetch with Bearer token auth

### Backend (Render)
- Framework: FastAPI (Python 3.11)
- Database: PostgreSQL via Supabase
- Auth Middleware: JWT verification via Supabase
- Multi-tenancy: Row-level security (RLS) by user_id

### Services
- Auth: Supabase (managed)
- Enrichment: Perplexity API (5-domain research) + GPT-4o (synthesis)
- CRM Integrations: HubSpot, Salesforce, Pipedrive APIs
- Deployment: Vercel (frontend), Render (backend), Supabase (database)

---

## System Architecture Overview

BROWSER USER
    |
    v
FRONTEND (React/Vite at https://latticeiq.vercel.app)
    - SetupPage (ICP + Scoring Config) [NEW]
    - ContactsPage (List + Table)
    - ContactDetailPage (Enrichment + Scores)
    - Dashboard (Stats + Segments)
    - Supabase Auth (JWT validation)
    |
    | Authorization: Bearer {JWT}
    v
BACKEND (FastAPI at https://latticeiq-backend.onrender.com)
    - JWT Middleware (getcurrentuser)
    - CORS + Request/Response logging
    |
    â”œ-- Contact CRUD Endpoints
    â”œ-- Enrichment V3 Endpoints
    â”œ-- Scoring Endpoints
    â”œ-- CRM Import Endpoints
    â””-- Health Check Endpoints
    |
    â”œ-- ContactService (CRUD operations)
    â”œ-- EnrichmentV3 (Perplexity + GPT-4o pipeline)
    â”œ-- Scoring (MDCP, BANT, SPICE calculators)
    â””-- CRM Importers (Data normalization)
    |
    v
DATABASE (PostgreSQL via Supabase)
    - auth.users (Managed by Supabase)
    - profiles (user_id FK)
    - contacts (user_id FK, enrichment_data JSONB)
    - contact_enrichment_history
    - scoring_configs (user_id FK, framework)
    - icp_configs (user_id FK, industry, pain_points)
    
    Row-Level Security (RLS):
    All queries filtered by WHERE auth.uid = user_id
    Users cannot access other users' data
    |
    v
EXTERNAL SERVICES (Async)
    
    Enrichment Pipeline:
    1. Perplexity API (5 parallel queries)
       - COMPANY research
       - PERSON profile
       - INDUSTRY analysis
       - NEWS coverage
       - OPEN-ENDED synthesis
    
    2. GPT-4o (Structured synthesis)
       - Merge Perplexity results
       - Extract: Summary, talking points, objections
       - Auto-score BANT & SPICE
    
    3. CRM APIs (Optional sync)
       - HubSpot (Import contacts, sync scores)
       - Salesforce (Import accounts, contacts)
       - Pipedrive (Import deals)
    
    Scoring Calculators (Synchronous):
    - MDCP: Money, Decision-maker, Champion, Process
    - BANT: Budget, Authority, Need, Timeline
    - SPICE: Situation, Problem, Implication, Consequence, Econ

---

## Data Models

### Contact (Core)
```
Contact {
  id: string (UUID PK)
  user_id: string (UUID FK to profiles)
  first_name: string
  last_name: string
  email: string
  phone: string (optional)
  company: string
  title: string
  linkedin_url: string (optional)
  
  // Enrichment
  enrichment_status: pending | enriching | completed | failed
  enrichment_data: {
    summary: string
    company_overview: string
    talking_points: string[]
    persona_type: string
    vertical: string
    recent_news: string (optional)
    recommended_approach: string (optional)
  }
  enriched_at: timestamp (optional)
  
  // Scoring
  mdcp_score: number (0-100, optional)
  bant_score: number (0-100, optional)
  spice_score: number (0-100, optional)
  apex_score: number (Average of above, optional)
  
  created_at: timestamp
  updated_at: timestamp
}
```

### ICP Config (User Profile)
```
ICPConfig {
  id: string (UUID)
  user_id: string (UUID FK to profiles)
  industry: string (e.g., "SaaS", "Finance")
  company_size: string (startup | small | mid-market | enterprise)
  primary_use_case: string
  typical_budget: string
  pain_points: string[] (Array of top 3 pain points)
  created_at: timestamp
  updated_at: timestamp
}
```

### Scoring Config (Framework Weights)
```
ScoringConfig {
  id: string (UUID)
  user_id: string (UUID FK to profiles)
  framework: mdcp | bant | spice
  
  weights: {
    // MDCP
    money_weight: number (0-100, optional)
    decision_maker_weight: number (optional)
    champion_weight: number (optional)
    process_weight: number (optional)
    
    // BANT
    budget_weight: number (optional)
    authority_weight: number (optional)
    need_weight: number (optional)
    timeline_weight: number (optional)
    
    // SPICE
    situation_weight: number (optional)
    problem_weight: number (optional)
    implication_weight: number (optional)
    consequence_weight: number (optional)
    economic_weight: number (optional)
  }
  
  thresholds: {
    hot: number (e.g., 75)
    warm: number (e.g., 50)
  }
  
  created_at: timestamp
  updated_at: timestamp
}
```

---

## API Endpoints

### Contacts
GET    /api/v3/contacts               List all user's contacts
GET    /api/v3/contacts/{id}          Get single contact detail
POST   /api/v3/contacts               Create new contact
PUT    /api/v3/contacts/{id}          Update contact
DELETE /api/v3/contacts/{id}          Delete contact

### Enrichment
POST   /api/v3/enrichment/{id}        Trigger enrichment (async)
GET    /api/v3/enrichment/{id}/status Poll enrichment status
GET    /api/v3/enrichment/{id}/data   Get enrichment results

### Scoring
POST   /api/v3/scoring/mdcp-config    Save MDCP weights
GET    /api/v3/scoring/mdcp-config    Load MDCP weights
POST   /api/v3/scoring/bant-config    Save BANT weights
GET    /api/v3/scoring/bant-config    Load BANT weights
POST   /api/v3/scoring/spice-config   Save SPICE weights
GET    /api/v3/scoring/spice-config   Load SPICE weights
POST   /api/v3/scoring/calculate      Calculate scores for contact
POST   /api/v3/scoring/calculate-all  Batch score all contacts

### ICP Config
POST   /api/v3/icp-config             Save ICP definition
GET    /api/v3/icp-config             Load ICP definition

### CRM Import
POST   /api/v3/crm/import/csv         Import from CSV
POST   /api/v3/crm/import/hubspot     Sync from HubSpot
POST   /api/v3/crm/import/salesforce  Sync from Salesforce
POST   /api/v3/crm/import/pipedrive   Sync from Pipedrive
GET    /api/v3/crm/import/{jobId}     Check import status

### Health
GET    /health                        Backend health check
GET    /api/health                    Full system health

---

## User Flow (Today's Workflow)

### 1. First-Time Setup (New User)

Login -> Dashboard -> Setup Page
  
Step 1: ICP Definition
  Define industry, company size, use case, budget, pain points

Step 2: Scoring Configuration
  MDCP: Adjust weights (Money, Decision-maker, Champion, Process)
  BANT: Adjust weights (Budget, Authority, Need, Timeline)
  SPICE: Adjust weights (Situation, Problem, Implication, etc.)

Step 3: Pain Points & Deal Triggers
  List top 3-5 buyer pain points (drives enrichment focus)

Step 4: Save & Review
  [Save] -> POST /api/v3/icp-config + POST /api/v3/scoring/*-config

Result: User profile configured, ready for contacts

### 2. Import Contacts

Contacts -> [Import CSV / Connect HubSpot]
  
CSV: Upload file -> POST /api/v3/crm/import/csv
HubSpot: Connect -> POST /api/v3/crm/import/hubspot

Data normalized, deduplicated, stored in contacts table
enrichment_status = 'pending'

Result: Contacts loaded, ready for enrichment

### 3. Enrich Individual Contact

Contact Detail -> [Enrich] button
  
Click -> POST /api/v3/enrichment/{id}

Backend queues async enrichment:
  Stage 1: Parallel Perplexity queries (5 domains)
  Stage 2: GPT-4o synthesis -> JSON
  Stage 3: Save enrichment_data, set status = 'completed'

Frontend polls GET /api/v3/enrichment/{id}/status every 2s

When completed, refetch contact -> Display enrichment tabs

Result: Enrichment data visible, auto-scored

### 4. View Scoring Results

Contact Detail -> Scoring tabs

MDCP Score Card
  85/100 | Breakdown: Money (23/25), Decision-maker (22/25), ...

BANT Score Card
  78/100 | Budget (19/25), Authority (20/25), ...

SPICE Score Card
  82/100 | Situation (18/20), Problem (17/20), ...

Color coding:
  Red badge (<=50): COLD - Not a priority
  Yellow badge (50-74): WARM - Worth follow-up
  Green badge (>=75): HOT - Engage immediately

### 5. Batch Score All Contacts

Contacts -> [Score All] button

POST /api/v3/scoring/calculate-all

Backend calculates MDCP/BANT/SPICE for all contacts
Uses thresholds from scoring config

Update contacts.mdcp_score, bant_score, spice_score
Set apex_score = average

Result: All contacts scored, filterable by tier

---

## File Structure (Current)

### Frontend
frontend/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ App.tsx                    Main router, auth guard
â”‚   â”œâ”€â”€ pages/
â”‚   â”‚   â”œâ”€â”€ Login.tsx
â”‚   â”‚   â”œâ”€â”€ Signup.tsx
â”‚   â”‚   â”œâ”€â”€ SetupPage.tsx          (ICP + Scoring Config) [NEW]
â”‚   â”‚   â”œâ”€â”€ ContactsPage.tsx       List table view
â”‚   â”‚   â”œâ”€â”€ ContactDetailPage.tsx  Single contact + enrichment
â”‚   â”‚   â””â”€â”€ Dashboard.tsx          Stats & segments
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ Sidebar.tsx            Navigation
â”‚   â”‚   â”œâ”€â”€ ContactsTable.tsx      Sortable contact list
â”‚   â”‚   â”œâ”€â”€ ContactDetailModal.tsx (deprecated, use ContactDetailPage)
â”‚   â”‚   â””â”€â”€ EnrichButton.tsx       Enrich trigger
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”œâ”€â”€ supabase.ts            Supabase client
â”‚   â”‚   â””â”€â”€ api.ts                 Fetch wrapper with JWT
â”‚   â”œâ”€â”€ types/
â”‚   â”‚   â”œâ”€â”€ contact.ts
â”‚   â”‚   â”œâ”€â”€ scoring.ts
â”‚   â”‚   â””â”€â”€ api.ts
â”‚   â””â”€â”€ App.css
â”œâ”€â”€ vite.config.ts
â”œâ”€â”€ tailwind.config.ts
â”œâ”€â”€ tsconfig.json
â””â”€â”€ package.json

### Backend
backend/
â”œâ”€â”€ main.py                        FastAPI app + route registration
â”œâ”€â”€ domains/
â”‚   â”œâ”€â”€ contacts/
â”‚   â”‚   â”œâ”€â”€ router.py              Contact CRUD endpoints
â”‚   â”‚   â””â”€â”€ service.py             ContactService logic
â”‚   â”œâ”€â”€ enrichment/
â”‚   â”‚   â”œâ”€â”€ router.py              Enrichment endpoints
â”‚   â”‚   â”œâ”€â”€ service.py             EnrichmentV3 logic
â”‚   â”‚   â””â”€â”€ v3/
â”‚   â”‚       â”œâ”€â”€ perplexity.py      Perplexity API calls
â”‚   â”‚       â”œâ”€â”€ gpt4.py            GPT-4o synthesis
â”‚   â”‚       â””â”€â”€ parser.py          Extract structured JSON
â”‚   â”œâ”€â”€ scoring/
â”‚   â”‚   â”œâ”€â”€ router.py              Scoring endpoints
â”‚   â”‚   â”œâ”€â”€ models.py              Pydantic models
â”‚   â”‚   â”œâ”€â”€ calculators.py         MDCP/BANT/SPICE logic
â”‚   â”‚   â””â”€â”€ service.py             Scoring service
â”‚   â””â”€â”€ crm/
â”‚       â”œâ”€â”€ router.py              CRM import endpoints
â”‚       â””â”€â”€ importers/
â”‚           â”œâ”€â”€ hubspot.py
â”‚           â”œâ”€â”€ salesforce.py
â”‚           â”œâ”€â”€ pipedrive.py
â”‚           â””â”€â”€ csv.py
â”œâ”€â”€ middleware/
â”‚   â””â”€â”€ auth.py                    JWT validation (getcurrentuser)
â”œâ”€â”€ models/
â”‚   â”œâ”€â”€ contact.py                 SQLAlchemy models
â”‚   â”œâ”€â”€ scoring.py
â”‚   â””â”€â”€ icp.py
â”œâ”€â”€ requirements.txt
â””â”€â”€ .env (dev only, use Render env vars for prod)

---

## Known Constraints & Gotchas

### Frontend
No localStorage: Render sandbox blocks it. Use React state for temp data.
JWT Storage: Supabase client stores token in memory. Refresh on page load.
API URL: Must match VITE_API_URL env var. Check Vercel settings.
CORS: Backend allows http://localhost:3000 and https://latticeiq.vercel.app

### Backend
User Isolation: ALL queries must filter by user_id from JWT. No exceptions.
Async Enrichment: Long operations (30-90s) use background tasks. Frontend polls status.
Rate Limiting: Perplexity has 10-req/min limit. Queue large batches.
Error Handling: Graceful degradation if enrichment fails. Contact still usable with partial data.

### Database (Supabase)
RLS Enabled: Even if SQL is wrong, RLS blocks unauthorized access.
UUID Strings: All IDs are UUIDs, NOT integers. Use id: str in Python, id: string in TypeScript.
JSONB Columns: enrichment_data stored as JSON. Query with -> operators if needed.

---

## Next Priorities (Roadmap)

### Phase 2a (This Week)
[ ] Batch enrichment UI (select multiple, enrich all)
[ ] Score All button on Contacts page
[ ] Filter contacts by score tier (Hot/Warm/Cold)
[ ] Analytics dashboard (avg scores by vertical, top pain points)

### Phase 2b (Next Week)
[ ] Deal routing rules (auto-assign Hot leads to sales team)
[ ] Slack/Email notifications (send Hot leads to channel)
[ ] CRM sync back (push scores to HubSpot/Salesforce)
[ ] Win/Loss tracking (which score tiers convert)

### Phase 3 (Weeks 3-4)
[ ] Custom framework builder (let users define their own scoring)
[ ] Playbook/outreach templates (talk tracks for each persona)
[ ] Team collaboration (notes, assignments, activity log)
[ ] Advanced analytics (ML-powered pattern detection)

---

## Dependencies & Versions

### Frontend
React 18.2+
TypeScript 5.0+
Vite 4.0+
Tailwind CSS 3.0+
React Router 6.0+
Supabase JS 2.30+

### Backend
FastAPI 0.104+
Python 3.11+
SQLAlchemy 2.0+
Pydantic 2.0+
python-dotenv
Perplexity API
OpenAI API

### Infrastructure
Vercel (Frontend)
Render (Backend)
Supabase (Database + Auth)

---

## Critical Rules (Do NOT Break)

1. All IDs are UUIDs (strings) -> No parseInt() on contact.id
2. User isolation via RLS -> Every SELECT/UPDATE includes WHERE user_id = auth.uid
3. JWT auth on every API call -> Authorization: Bearer {token}
4. No localStorage -> Use React state or Supabase
5. Type-only imports -> import type { Contact } (for Render build compatibility)
6. Async enrichment -> Frontend polls, doesn't block
7. Error handling -> Graceful degradation, don't crash on enrichment failure

---

## Questions? Next Steps?

Setup page not showing? Check that SetupPage is in /pages and route is in App.tsx
Scoring not calculating? Verify backend endpoints exist at /api/v3/scoring/calculate
Enrichment stuck? Check Perplexity API key in Render env vars
Contacts not loading? Verify user_id filter in SQL and RLS policy

Deploy with confidence. Architecture is solid. This is production-ready code.

---

Document Version: 1.0
Last Updated: Dec 26, 2025
Next Review: Jan 2, 2026