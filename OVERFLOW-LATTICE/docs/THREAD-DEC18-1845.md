```markdown
# LATTICEIQ SALES INTELLIGENCE - THREAD TRANSFER
**Date:** December 18, 2025, 6:12 PM PST  
**Status:** ✅ V3 ENRICHMENT LIVE & HEALTHY

---

## EXECUTIVE SUMMARY

| Component | Name | Platform | URL | Status |
|-----------|------|----------|-----|--------|
| Frontend | LatticeIQ | Vercel | https://latticeiq.vercel.app | ✅ Running |
| Backend | latticeiq-backend | Render | https://latticeiq-backend.onrender.com | ✅ V3 Healthy |
| Database | PostgreSQL | Supabase | (via SUPABASE_URL) | ✅ Running |
| Auth | Supabase Auth | Supabase | JWT + RLS | ✅ Working |

---

## JUST COMPLETED ✅

- Created fresh `latticeiq-backend` service on Render (clean URL)
- Deployed Enrichment V3 parallel architecture
- Fixed `PERPLEXITY_API_KEY` typo (`PEPLEXITY` → `PERPLEXITY`)
- V3 health check passing

---

## LIVE ENDPOINTS

### Backend: https://latticeiq-backend.onrender.com

```
# Health checks
curl https://latticeiq-backend.onrender.com/health
curl https://latticeiq-backend.onrender.com/api/v3/enrichment/health

# V3 Enrichment
POST /api/v3/enrichment/enrich          # Single contact
POST /api/v3/enrichment/enrich/batch    # Batch contacts
GET  /api/v3/enrichment/enrich/{id}/status
GET  /api/v3/enrichment/enrich/{id}/profile
POST /api/v3/enrichment/cache/clear
GET  /api/v3/enrichment/health

# Core API
GET    /api/contacts
POST   /api/contacts
GET    /api/contacts/{id}
DELETE /api/contacts/{id}
POST   /api/import/hubspot
POST   /api/import/salesforce
POST   /api/import/pipedrive
POST   /api/import/csv
```

---

## ENRICHMENT V3 ARCHITECTURE

```
Contact → 5 Parallel Perplexity Queries → GPT-4o Synthesis → Sales Profile
              ↓
    ┌─────────┼─────────┐
COMPANY   PERSON   INDUSTRY   NEWS   OPEN_ENDED
(7d TTL)  (14d)    (3d)      (1d)   (2d TTL)
```

| Domain | Purpose | TTL | Timeout |
|--------|---------|-----|---------|
| COMPANY | Revenue, funding, tech stack | 7 days | 25s |
| PERSON | Career history, education | 14 days | 25s |
| INDUSTRY | Trends, challenges | 3 days | 20s |
| NEWS | Recent announcements, triggers | 1 day | 25s |
| OPEN_ENDED | Sales angles, objections | 2 days | 35s |

---

## ENVIRONMENT VARIABLES

### Backend (Render - latticeiq-backend)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...  ← MUST be spelled correctly!
HUBSPOT_API_KEY=...
HUBSPOT_TOKEN_ACCESS=...
ALLOWED_ORIGINS=*
```

### Frontend (Vercel - latticeiq)
```
VITE_API_URL=https://latticeiq-backend.onrender.com  ← UPDATE THIS
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## GITHUB REPOS

| Repo | Purpose | Branch |
|------|---------|--------|
| github.com/quatrorabes/latticeiq | Monorepo (frontend + backend) | main |

**Structure:**
```
latticeiq/
├── frontend/     → Vercel (React/Vite)
└── backend/      → Render (FastAPI/Python)
```

---

## DEPLOYMENT WORKFLOW

### Frontend (Vercel - auto-deploy)
```
cd ~/projects/latticeiq/frontend
git add -A && git commit -m "message" && git push origin main
```

### Backend (Render - auto-deploy)
```
cd ~/projects/latticeiq/backend
git add -A && git commit -m "message" && git push origin main
```

---

## DATABASE SCHEMA (Supabase)

```
-- profiles (linked to auth.users)
id UUID PRIMARY KEY
email, full_name, created_at

-- contacts (with RLS)
id SERIAL PRIMARY KEY
user_id UUID (FK) -- ISOLATION KEY
firstname, lastname, email, phone
company, title, linkedin_url, website
vertical, persona_type
enrichment_status, enrichment_data JSONB, enriched_at
apex_score, mdcp_score, rss_score
created_at, updated_at

-- RLS: WHERE user_id = auth.uid()
```

---

## FRONTEND FEATURES

### Implemented ✅
- Supabase Auth (login/signup)
- Contact list with table view
- Add Contact modal
- Import modal (HubSpot, Salesforce, Pipedrive, CSV)
- DNC/unsubscribed filtering on import

### Next to Wire ⏳
- Enrich button → V3 endpoint
- Enrichment status polling
- Display synthesized profile
- APEX/BANT/SPICE score display

---

## CRITICAL RULES

### RULE 1: SPELLING MATTERS
- `PERPLEXITY_API_KEY` not `PEPLEXITY_API_KEY`

### RULE 2: PRESERVE ENGINES
Do NOT replace:
- `enrichment_v3/*` (parallel architecture)
- `crm_import.py` (CRM importers)

### RULE 3: AUTH FLOW
```
User Login → Supabase JWT → Frontend stores token
→ API calls with: Authorization: Bearer {token}
→ Backend validates → Filters by user_id
```

---

## TEST COMMANDS

```
# Health checks
curl https://latticeiq-backend.onrender.com/health
curl https://latticeiq-backend.onrender.com/api/v3/enrichment/health

# Enrich a contact (with auth)
curl -X POST https://latticeiq-backend.onrender.com/api/v3/enrichment/enrich \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"contact_id": 1}'
```

---

## NEXT STEPS (Priority Order)

1. ✅ ~~V3 Health check passing~~
2. **Update Vercel** `VITE_API_URL` to `https://latticeiq-backend.onrender.com`
3. **Wire Enrich button** in frontend to call V3 endpoint
4. **Display profile** — show synthesized sales intelligence
5. **Test full flow** — import → enrich → view profile

---

## ASSISTANT ROLE

Senior Lead Architect for LatticeIQ Sales Intelligence.
- Backend: `latticeiq-backend` on Render
- Frontend: `latticeiq` on Vercel
- Monorepo: `quatrorabes/latticeiq`
- User prefers copy-paste solutions
- Focus on shipping features

---

## SERVICES TO IGNORE/DELETE

| Service | URL | Status |
|---------|-----|--------|
| arcmetric | arcmetric.onrender.com | OLD - can delete |
| apex-backend-i7b0 | apex-backend-i7b0.onrender.com | OLD - deleted |

---

**START HERE:** Update Vercel env var `VITE_API_URL` to `https://latticeiq-backend.onrender.com`, then redeploy frontend.
```

***

Copy this to your new thread. **First action:** Update Vercel's `VITE_API_URL` and redeploy.