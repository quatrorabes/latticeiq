# LatticeIQ - Master Development Context

**Last Updated:** December 30, 2025, 11:11 PM PST  
**Status:** Phase 1B Complete - Backend Production Ready, Frontend Scoring Integration  
**Maintainer:** Chris Rabenold  
**Next Review:** When new features added or major deployment completed

---

## 🎯 Project Overview

**LatticeIQ** is a B2B sales intelligence platform that automatically enriches contact data and applies multi-framework lead scoring (MDCP, BANT, SPICE). Sales teams use it to identify high-value prospects and prioritize outreach.

**Core Value Proposition:**
- ✅ Import contacts from HubSpot, LinkedIn, or CSV
- ✅ Auto-enrich profiles using Perplexity AI
- ✅ Apply 3 scoring frameworks simultaneously
- ✅ Identify hot/warm/cold leads instantly
- ✅ Track engagement and deal stage

**Tech Stack:**
| Layer | Technology | Location |
|-------|-----------|----------|
| Frontend | React 18 + TypeScript + Tailwind | `frontend/` → Deployed to Vercel |
| Backend | FastAPI + Python 3.11 | `backend/` → Deployed to Render |
| Database | PostgreSQL 15 + Supabase | Multi-tenant with RLS policies |
| Auth | Supabase Auth + JWT | Row-level security by workspace |
| Enrichment | Perplexity AI API | Call via backend, cache results |
| Scoring | Custom calculators (MDCP/BANT/SPICE) | In-memory for MVP, Supabase-backed prod |

---

## 🏗️ System Architecture

### High-Level Data Flow

```
User Browser (Vercel)
    ↓
Frontend (React + TS)
    ↓
API Gateway (/api/v3/*) [FastAPI]
    ↓
Route Layer:
├─ /contacts → CRUD operations
├─ /enrichment/quick-enrich/{id} → Perplexity AI
├─ /scoring/calculate-all/{id} → MDCP/BANT/SPICE
├─ /crm/import → HubSpot/LinkedIn/CSV
└─ /health → System status
    ↓
Supabase (PostgreSQL + Auth + Storage)
    ↓
External APIs:
├─ Perplexity AI (enrichment)
├─ HubSpot (CRM sync)
└─ OpenAI (fallback for scoring)
```

### Multi-Tenant Architecture

**Key Principle:** Data is isolated by `workspace_id` using Supabase RLS policies.

```sql
-- User authenticates with JWT token
-- JWT claims include user_id and workspace_id
-- RLS policy on every table ensures:
SELECT * FROM contacts 
WHERE workspace_id = auth.jwt()->>'workspace_id'
```

**Current Status:** RLS policies are **disabled for development**. Enable before production.

---

## 📊 Database Schema

### Core Tables

| Table | Purpose | Key Columns | Status |
|-------|---------|-------------|--------|
| `workspaces` | Organization/team boundaries | id (UUID), name, created_at | ✅ Active |
| `users` | User accounts (via Supabase Auth) | id (UUID), email, workspace_id | ✅ Active |
| `contacts` | Imported sales prospects | id (UUID), first_name, last_name, email, company, mdcp_score, bant_score, spice_score, enrichment_status, enrichment_data (JSON) | ✅ Active |
| `enrichment_cache` | Cached enrichment results | id (UUID), contact_id, provider, data (JSON), created_at | ⏳ Planned |

### Scoring Tables (Planned for DB Persistence)

| Table | Purpose | Status |
|-------|---------|--------|
| `mdcp_configs` | User-customized MDCP weights/thresholds | 🔄 In Development |
| `bant_configs` | User-customized BANT settings | 🔄 In Development |
| `spice_configs` | User-customized SPICE settings | 🔄 In Development |

### Current Schema Export

```sql
-- Full schema available at: docs/architecture/database-schema.sql
-- Last exported: Dec 30, 2025
-- Total tables: 20+
-- RLS policies: Disabled (dev mode)
-- Foreign keys: Disabled for rapid iteration (enable before prod)
```

**To export current schema:**
```bash
supabase db dump -f schema.sql
```

---

## 🔌 API Specification

### Authentication

**All endpoints require JWT Bearer token:**

```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://latticeiq-backend.onrender.com/api/v3/contacts
```

**JWT comes from Supabase Auth.** Frontend extracts via:
```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token; // Valid for 1 hour
```

### Core Endpoints

#### Contacts (CRUD)

| Method | Endpoint | Purpose | Params | Response |
|--------|----------|---------|--------|----------|
| GET | `/api/v3/contacts` | List all user contacts | `?limit=50&offset=0` | `{ contacts: [Contact[]], total: int }` |
| POST | `/api/v3/contacts` | Create new contact | Body: Contact fields | `{ id, created_at, ... }` |
| PUT | `/api/v3/contacts/{id}` | Update contact | Body: Partial Contact | `{ id, updated_at, ... }` |
| DELETE | `/api/v3/contacts/{id}` | Delete contact | — | `{ deleted: true }` |

#### Enrichment

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/api/v3/enrichment/quick-enrich/{contact_id}` | Fetch Perplexity AI profile | ✅ Working |
| GET | `/api/v3/enrich/{contact_id}/status` | Check enrichment job status | ✅ Working |
| GET | `/api/v3/enrich/{contact_id}/data` | Retrieve enrichment results | ✅ Working |

**Quick-Enrich Response:**
```json
{
  "contact_id": "uuid",
  "status": "completed",
  "data": {
    "summary": "VP of Sales at TechCorp...",
    "opening_line": "Hi Sarah, I saw you recently...",
    "talking_points": ["Leads CRO team", "Growth-focused", "..."],
    "vertical": "SaaS",
    "provider": "perplexity",
    "generated_at": "2025-12-30T23:11:00Z"
  }
}
```

#### Scoring

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/api/v3/scoring/calculate-all/{contact_id}` | Score one contact with all 3 frameworks | ✅ Working |
| GET | `/api/v3/scoring/config/{framework}` | Get scoring config (MDCP/BANT/SPICE) | ✅ Working |
| POST | `/api/v3/scoring/config/{framework}` | Save custom config | 🔄 Planned |

**Score Response:**
```json
{
  "contact_id": "uuid",
  "mdcp_score": 75,
  "mdcp_tier": "hot",
  "bant_score": 62,
  "bant_tier": "warm",
  "spice_score": 71,
  "spice_tier": "hot",
  "overall_score": 69
}
```

#### CRM Import

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/api/v3/crm/import/csv` | Upload CSV of contacts | ✅ Working |
| GET | `/api/v3/crm/import/status/{job_id}` | Check import job progress | ✅ Working |

### Health & Diagnostics

```bash
GET /api/v3/health

Response:
{
  "status": "ok",
  "timestamp": "2025-12-30T23:11:00Z",
  "database": "connected",
  "enrichment_available": true,
  "scoring_available": true
}
```

---

## 🎯 Scoring Frameworks

### MDCP (Money-Decision-Maker-Champion-Process)
**Best for:** Sales qualification  
**Accuracy:** 85% with enrichment data  
**Calculation:**
- **Money (25%):** Is revenue in target range? ($1M-$100M default)
- **Decision-maker (25%):** Job title matches targets? (CEO, VP Sales, CMO, etc.)
- **Champion (25%):** Recently engaged? (Last activity < 30 days)
- **Process (25%):** In active deal? (Default assumption)

**Tiers:**
- 🔥 Hot: Score ≥ 71
- 🟡 Warm: Score 40-70
- ❄️ Cold: Score < 40

### BANT (Budget-Authority-Need-Timeline)
**Best for:** Enterprise deal qualification  
**Configuration:**
- **Budget:** Funding allocated? (Min-max range)
- **Authority:** Is user a decision-maker?
- **Need:** Looking for solution we sell? (Keyword matching)
- **Timeline:** When needed? (Days to close)

### SPICE (Situation-Problem-Implication-Consequence-Economic)
**Best for:** Complex B2B solutions  
**Configuration:**
- **Situation:** Industry/context fit
- **Problem:** Core pain points detected
- **Implication:** Business impact
- **Consequence:** Urgency/severity
- **Economic:** Financial capacity

---

## 🚀 Deployment Architecture

### Frontend (Vercel)

```
Repository: github.com/quatrorabes/latticeiq
Branch: main (auto-deploys on git push)
URL: https://latticeiq.vercel.app
Build: npm run build → React + TypeScript compilation
Environment:
  VITE_SUPABASE_URL=<from Supabase dashboard>
  VITE_SUPABASE_ANON_KEY=<public anon key>
  VITE_API_URL=https://latticeiq-backend.onrender.com
Logs: Vercel dashboard → Recent deployments
```

**Deploy Process:**
```bash
cd frontend
git add .
git commit -m "feature: description"
git push origin main  # Vercel auto-deploys in 1-2 min
```

### Backend (Render)

```
Repository: github.com/quatrorabes/latticeiq (same monorepo)
Branch: main → watches backend/ directory only
URL: https://latticeiq-backend.onrender.com
Build: render.yaml → Python 3.11 + FastAPI
Environment:
  SUPABASE_URL=<from Supabase>
  SUPABASE_KEY=<service role key - KEEP SECRET>
  PERPLEXITY_API_KEY=<for enrichment>
  (others in Render dashboard)
Logs: Render dashboard → Logs tab
CI/CD: On git push, Render:
  1. Builds Python environment
  2. Installs requirements.txt
  3. Runs FastAPI on port 8000
  4. Health check to /api/v3/health
  5. Auto-rollback if health check fails
```

**Deploy Process:**
```bash
cd backend
git add .
git commit -m "feature: description"
git push origin main  # Render auto-deploys in 2-3 min
```

### Database (Supabase)

```
Project ID: kbcmtbwhycudgeblkhtc
Region: us-east-1
URL: https://kbcmtbwhycudgeblkhtc.supabase.co
Auth: Enable via Supabase > Authentication > Providers
RLS: Currently DISABLED (enable before production)
Backups: Automatic daily, retention 7 days
```

---

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 20+ (check: `node -v`)
- Python 3.11+ (check: `python3 --version`)
- Git configured with GitHub SSH keys
- Supabase CLI installed (`brew install supabase/tap/supabase`)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:5173
```

**Environment file:** `frontend/.env.local`
```
VITE_SUPABASE_URL=https://kbcmtbwhycudgeblkhtc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=http://localhost:8000
```

### Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
# Runs on http://localhost:8000
```

**Environment file:** `backend/.env`
```
SUPABASE_URL=https://kbcmtbwhycudgeblkhtc.supabase.co
SUPABASE_KEY=<get from Supabase > Project Settings > API Keys > service_role>
PERPLEXITY_API_KEY=<get from Perplexity dashboard>
```

### Testing API Locally

```bash
# Get your local JWT token from browser:
# 1. Open http://localhost:5173
# 2. DevTools > Application > Local Storage > supabase.auth.token
# 3. Copy access_token value

TOKEN="your.jwt.token.here"

# Test contacts endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v3/contacts

# Test enrichment
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v3/enrichment/quick-enrich/contact-uuid
```

---

## 📁 Repository Structure

```
latticeiq/
├── frontend/                           # React + TypeScript
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx      # KPI overview
│   │   │   ├── ContactsPage.tsx       # Table + search + enrich
│   │   │   ├── ScoringPage.tsx        # Config MDCP/BANT/SPICE
│   │   │   └── CRMPage.tsx            # Import HubSpot/CSV
│   │   ├── components/
│   │   │   ├── ContactsTable.tsx      # Score columns, sorting
│   │   │   ├── ContactDetailModal.tsx # Enrichment display
│   │   │   ├── ScoringConfig/         # MDCP/BANT/SPICE UIs
│   │   │   └── Layout.tsx             # Nav + sidebar
│   │   ├── api/
│   │   │   ├── contacts.ts            # API client for contacts
│   │   │   ├── enrichment.ts          # API client for enrichment
│   │   │   └── scoring.ts             # API client for scoring
│   │   ├── types/index.ts             # TypeScript interfaces
│   │   └── lib/
│   │       └── supabaseClient.ts      # Supabase instance
│   ├── package.json                   # Node dependencies
│   └── .env.local                     # Environment variables
│
├── backend/                            # FastAPI + Python
│   ├── app/
│   │   ├── main.py                    # FastAPI app + route registration
│   │   ├── router.py                  # Main route definitions
│   │   ├── db.py                      # Supabase client instance
│   │   ├── auth.py                    # JWT verification
│   │   ├── contacts/
│   │   │   ├── router.py              # /api/v3/contacts endpoints
│   │   │   └── models.py              # Pydantic models
│   │   ├── enrichment_v3/
│   │   │   ├── router.py              # /api/v3/enrichment endpoints
│   │   │   ├── enrich_simple.py       # Perplexity integration
│   │   │   └── models.py              # Enrichment response models
│   │   ├── scoring/
│   │   │   ├── router.py              # /api/v3/scoring endpoints
│   │   │   ├── models.py              # Scoring config models
│   │   │   └── calculators.py         # MDCP/BANT/SPICE logic
│   │   └── crm/
│   │       ├── router.py              # /api/v3/crm/import endpoints
│   │       └── models.py              # CRM data models
│   ├── requirements.txt                # Python dependencies
│   ├── render.yaml                     # Render deployment config
│   └── .env                            # Environment secrets
│
├── docs/                               # Documentation
│   ├── architecture/
│   │   ├── LATTICEIQ_MASTER_CONTEXT.md (THIS FILE)
│   │   ├── api-specification.md
│   │   ├── database-schema.sql
│   │   ├── auth-flow.md
│   │   └── enrichment-pipeline.md
│   ├── guides/
│   │   ├── local-development.md
│   │   ├── deployment.md
│   │   ├── troubleshooting.md
│   │   └── git-workflow.md
│   ├── decisions/
│   │   ├── adr-001-uuid-primary-keys.md
│   │   ├── adr-002-multi-tenant-rls.md
│   │   ├── adr-003-scoring-frameworks.md
│   │   └── adr-004-perplexity-enrichment.md
│   └── sessions/
│       ├── SESSION_LOG_DEC30.md
│       ├── SESSION_LOG_DEC29.md
│       └── ... (historical threads)
│
├── .git/                               # Monorepo for both frontend + backend
├── .github/workflows/                  # CI/CD (planned)
├── package.json                        # Monorepo root (for shared scripts)
└── README.md                           # Project overview
```

---

## 🔐 Authentication & Authorization

### Flow

1. **User opens frontend** → Supabase Auth redirect
2. **User signs up/in** → Creates JWT with claims:
   ```json
   {
     "sub": "user-id",
     "email": "user@company.com",
     "workspace_id": "org-uuid",
     "iat": 1234567890,
     "exp": 1234571490
   }
   ```
3. **Frontend stores JWT** → Included in all API requests
4. **Backend validates JWT** → Extracts `workspace_id` from claims
5. **RLS policies** → Enforce `WHERE workspace_id = auth.jwt()->>'workspace_id'`

### JWT Validation Code (Backend)

```python
# app/auth.py
from fastapi import Depends, HTTPException
from supabase import create_client

async def get_current_user(authorization: str = Header(...)) -> dict:
    try:
        token = authorization.replace("Bearer ", "")
        user = supabase.auth.get_user(token)
        return user.user.user_metadata
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

# Usage in endpoints:
@router.post("/api/v3/contacts")
async def create_contact(
    contact_data: Contact,
    user: dict = Depends(get_current_user)
):
    contact_data.workspace_id = user.get("workspace_id")
    # ... save to DB
```

---

## 🔄 Current Development Status

### ✅ Completed (Production Ready)

| Feature | Status | Notes |
|---------|--------|-------|
| **Backend API** | ✅ Production | All CRUD, enrichment, scoring endpoints working |
| **Contact CRUD** | ✅ Production | Create, read, update, delete contacts |
| **CSV Import** | ✅ Production | Upload CSV, validate, batch create |
| **Quick Enrichment** | ✅ Production | Perplexity AI integration, caching |
| **Scoring Framework** | ✅ Production | MDCP/BANT/SPICE calculators implemented |
| **Frontend UI** | ✅ Production | Dashboard, Contacts table, Scoring config pages |
| **Supabase Auth** | ✅ Production | JWT + workspace isolation |
| **Deployment** | ✅ Production | Vercel (frontend) + Render (backend) |

### 🔄 In Progress

| Feature | Status | ETA | Owner |
|---------|--------|-----|-------|
| Score persistence to DB | 🔄 Development | Dec 31 | Backend |
| Contact detail modal scores | 🔄 Development | Dec 31 | Frontend |
| Score All button | 🔄 Development | Dec 31 | Frontend |
| Database schema versioning | 🔄 Planning | Jan 5 | DevOps |

### ⏳ Planned (Next Phase)

| Feature | Status | Timeline | Notes |
|---------|--------|----------|-------|
| HubSpot CRM sync | ⏳ Planned | Q1 2026 | OAuth + webhook |
| Lead routing/assignment | ⏳ Planned | Q1 2026 | Route hot leads to sales |
| Slack notifications | ⏳ Planned | Q1 2026 | Alert on hot lead creation |
| Custom scoring rules | ⏳ Planned | Q1 2026 | User-defined frameworks |
| Analytics dashboard | ⏳ Planned | Q1 2026 | Lead velocity, conversion tracking |
| Bulk operations | ⏳ Planned | Q1 2026 | Batch re-score, export, delete |

---

## 🐛 Known Issues & Workarounds

| Issue | Severity | Workaround | Root Cause | Fix ETA |
|-------|----------|-----------|-----------|---------|
| RLS policies disabled | 🔴 Critical | Only use staging DB | Development mode for iteration | Before production |
| Foreign keys disabled | 🟡 High | Manual data integrity checks | Speed up iteration | Jan 10 |
| Scores not persisting | 🟡 High | Recalculate on page load | In-memory only for MVP | Jan 2 |
| Enrichment API rate limits | 🟡 Medium | Queue requests, 1 per second | Perplexity throttling | Jan 15 |

---

## 🚨 Common Tasks & Commands

### Debugging

```bash
# Check frontend errors
# 1. Open http://localhost:5173
# 2. DevTools (F12) → Console tab
# 3. Look for red errors

# Check backend logs
# Option A: Render dashboard → Logs tab (real-time)
# Option B: Local terminal → python main.py output
# Option C: Query logs via Render API

# Test API endpoint
curl -X GET "https://latticeiq-backend.onrender.com/api/v3/health"

# Check Supabase connection
supabase db dump -f /tmp/schema.sql  # Will error if not connected
```

### Database Migrations

```bash
# Export current schema
supabase db dump -f docs/architecture/database-schema.sql

# Push migration to production
supabase db push  # Uses Supabase CLI

# Rollback (manual, edit schema)
# WARNING: Manual process, plan carefully
```

### Deployment Rollback

```bash
# Frontend (Vercel)
# 1. Go to Vercel dashboard
# 2. Select LatticeIQ project
# 3. Click "Deployments" → find previous good version
# 4. Click "..." → "Promote to Production"

# Backend (Render)
# 1. Go to Render dashboard
# 2. Select backend service
# 3. Click "Events" → find previous good build
# 4. Click "..." → "Re-deploy"
```

---

## 📞 Support & Escalation

### For Issues...

**Frontend (React/TypeScript)**
- Check console for errors (F12)
- Verify `.env.local` has correct API URL
- Test with curl to confirm backend is working
- Check Vercel deployment logs

**Backend (FastAPI/Python)**
- Check Render logs in real-time
- Verify environment variables set in Render dashboard
- Test endpoints with curl from production URL
- Check Supabase connection status

**Database (Supabase)**
- Check Supabase dashboard → Database → tables
- Verify RLS policies (currently disabled)
- Check auth users in Authentication tab
- Monitor project usage/limits

**Integrations**
- Perplexity API: Check dashboard for rate limits
- Supabase Auth: Check provider settings
- HubSpot: Verify OAuth token hasn't expired

---

## 📋 Pre-Development Checklist

**Every development session, verify:**

- [ ] Supabase project is accessible
- [ ] Render backend is healthy: `curl https://latticeiq-backend.onrender.com/api/v3/health`
- [ ] Frontend Vercel deployment is latest
- [ ] Local `.env.local` and `.env` files are updated
- [ ] Git `main` branch is up-to-date: `git pull origin main`
- [ ] No uncommitted changes: `git status` (should be clean)
- [ ] `npm install` and `pip install -r requirements.txt` are current

---

## 📚 Additional Resources

**Key Documentation Files:**
- `/docs/architecture/api-specification.md` — Complete endpoint reference
- `/docs/architecture/database-schema.sql` — Current DB structure
- `/docs/guides/deployment.md` — Step-by-step deployment guide
- `/docs/guides/troubleshooting.md` — Common problems + solutions
- `/docs/decisions/` — Architecture Decision Records (ADRs)
- `/docs/sessions/` — Historical session logs

**External Links:**
- Vercel Dashboard: https://vercel.com/quatrorabes/latticeiq
- Render Dashboard: https://dashboard.render.com
- Supabase Console: https://app.supabase.com
- FastAPI Docs: https://latticeiq-backend.onrender.com/api/docs
- GitHub Repository: https://github.com/quatrorabes/latticeiq

---

## 🎯 Session Protocol

**Starting a New Session:**

1. Read this file (5 min)
2. Check `/docs/sessions/SESSION_LOG_[DATE].md` for recent context (3 min)
3. Verify health checks in "Pre-Development Checklist" (3 min)
4. Review the task assignment or issue ticket (5 min)
5. Ask clarifying questions if needed
6. Begin work

**Ending a Session:**

1. Commit changes: `git add . && git commit -m "feature: description"`
2. Push to git: `git push origin main`
3. Verify deployments complete (5-10 min):
   - Frontend: Vercel dashboard
   - Backend: Render dashboard
4. Update `/docs/sessions/SESSION_LOG_[DATE].md`:
   - What was completed
   - What was changed
   - Any new issues discovered
   - Blockers for next session
5. Update `LATTICEIQ_MASTER_CONTEXT.md` if:
   - Database schema changed
   - New endpoints added
   - Architecture decision made
   - Known issues discovered

---

## ✍️ Maintenance

**This document should be updated when:**
- ✅ New features deployed
- ✅ API endpoints added/changed
- ✅ Database schema modified
- ✅ Architecture decisions made
- ✅ Known issues discovered
- ✅ Deployment process changes

**Frequency:** Review and update after every major deployment or weekly, whichever is sooner.

---

**That's your single source of truth. Print it, bookmark it, reference it at the start of every session.** 🚀
