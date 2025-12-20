Based on comprehensive analysis of the Apex Sales Intelligence codebase, here is the complete architectural inventory and LatticeIQ transition plan:

***

# LatticeIQ Architecture Analysis & Transition Plan

## 1. Overview / Assumptions

### Current State
- **Product Name**: Apex Sales Intelligence (transitioning to LatticeIQ)
- **Architecture**: Dual-backend pattern with FastAPI, React frontend (Dashboard_v1)
- **Deployment**: Railway/Render with PostgreSQL + local SQLite fallback
- **Core Frameworks**: APEX (MDCP+RSS), BANT, SPICE multi-vertical qualification

### Assumptions
- LatticeIQ will be a **net-new product** reusing Apex's core intelligence engines
- Target personas remain similar (B2B sales reps, SDRs, account executives)
- Multi-vertical support (SaaS, Insurance, Equipment Leasing) is a competitive advantage
- Existing enrichment/scoring modules are production-validated but need refactoring

***

## 2. Backend Logic Module Inventory

### **A. Core Intelligence Engines** (apps/backend/intelligence/)

| Module | Status | Description | Dependencies | External APIs |
|--------|--------|-------------|--------------|---------------|
| **ApexCustomEnrichment** | ✅ ACTIVE | 3-stage enrichment: Perplexity (raw data) → GPT-4 (synthesis) → field extraction | EnrichmentParser, contactservice | Perplexity AI, OpenAI GPT-4 |
| **EnhancedEnrichment** | ⚠️ DEPRECATED | Legacy enrichment engine (pre-ApexCustom) | N/A | Multiple (legacy) |
| **ApexScoringEngine** | ✅ ACTIVE | MDCP (Match/Data/Contact/Profile) + RSS (Readiness/Suitability/Seniority) scoring | Database, contacts | None |
| **IntegratedScoring** | ✅ ACTIVE | Unified APEX+BANT+SPICE scoring with weighted blending | ApexScoringEngine, BANT/SPICE calculators | None |

### **B. Qualification Frameworks** (apps/backend/)

| Module | Status | Description | Dependencies | External APIs |
|--------|--------|-------------|--------------|---------------|
| **BANT Calculator** | ✅ ACTIVE | Budget/Authority/Need/Timeline scoring (0-100, 4 components @ 25pts each) | Contacts database | None |
| **SPICE Calculator** | ✅ ACTIVE | Situation/Problem/Implication/Critical Event/Decision scoring (0-100, 5 @ 20pts) | Contacts database | None |
| **Persona Classifier** | ✅ ACTIVE | Vertical-specific persona mapping (DECISIONMAKER/CHAMPION/INFLUENCER/INITIATOR) | Contacts | None |
| **ICP Match Tier** | ✅ ACTIVE | Tier assignment (HIGH/MEDIUM/LOW/UNQUALIFIED) based on unified scores | IntegratedScoring | None |

### **C. Data Management** (apps/backend/services/, apps/backend/api/routes/)

| Module | Status | Description | Dependencies | External APIs |
|--------|--------|-------------|--------------|---------------|
| **contactservice** | ✅ ACTIVE | CRUD operations for contacts (create/get/update/delete/bulk operations) | PostgreSQL/SQLite | None |
| **enrichmentadapter** | ✅ ACTIVE | Bridges enrichment engines to contact records; handles async enrichment | ApexCustomEnrichment | None |
| **EnrichmentParser** | ✅ ACTIVE | Parses 3-stage enrichment output into structured sections (metadata, char counts) | None | None |
| **HubSpot Sync** | ⚠️ POC | Imports contacts from HubSpot CRM with filters | HubSpot API client | HubSpot REST API |
| **Import Filters** | ✅ ACTIVE | Lead status validation, lifecycle stage validation | None | None |

### **D. API Routes** (apps/backend/api/routes/, root api.py)

| Endpoint Pattern | Status | Description | Backend Module | Frontend Consumer |
|------------------|--------|-------------|----------------|-------------------|
| `/api/v2/contacts` | ✅ ACTIVE | Contact list with pagination, search, filtering | contactservice | ContactsView, TodaysBoard |
| `/api/contacts/{id}/enrich` | ✅ ACTIVE | Single contact enrichment (3-stage ApexCustom) | enrichmentapexcustom | ContactDetail |
| `/api/contacts/bulk-enrich` | ✅ ACTIVE | Batch enrichment up to 100 contacts | enrichmentapexcustom | Admin tools |
| `/api/contacts/{id}/enrichment-status` | ✅ ACTIVE | Polls enrichment progress | contactservice | ContactDetail |
| `/api/todays-board` | ✅ ACTIVE | Dashboard aggregation (top 20 scored contacts + stats) | main.py | TodaysBoard |
| `/api/analytics` | ✅ ACTIVE | System-wide metrics (enrichment rate, avg scores, tier distribution) | main.py | Analytics Dashboard |
| `/api/smart-lists` | ⚠️ POC | Predefined contact segments (hot leads, ready-to-call) | main.py | SmartLists (future) |
| `/api/cold-call-queue` | ⚠️ POC | Phone outreach prioritization | main.py | ColdCallQueue (future) |
| `/api/contacts/{id}/qualify-bant` | ⚠️ POC | Manual BANT field updates | BANT Calculator | Qualification UI (not built) |
| `/api/contacts/{id}/qualify-spice` | ⚠️ POC | Manual SPICE field updates | SPICE Calculator | Qualification UI (not built) |
| `/health` | ✅ ACTIVE | System health check | Database | DevOps monitoring |

### **E. Database Schema** (SQLite/PostgreSQL)

**Active Tables:**
- `contacts` – Core contact records (name, email, company, title, scores, enrichment status)
- `userprofile` – Salesperson ICP preferences (ideal titles, sweet spot deal size, weights)
- `proofpoints` – Sales rep credentials (deals closed, testimonials, certifications)
- `coldcallqueue` – Outreach queue with priority scoring
- `contactmatch` – Contact-to-rep matching (match score, fit score, hooks, talking points)

**Key Fields (contacts table):**
- Scoring: `mdcpscore`, `rssscore`, `apexscore`, `banttotalscore`, `spicetotalscore`, `unifiedqualificationscore`
- Enrichment: `enrichmentstatus`, `enrichmentdata` (JSON), `enrichedat`
- Classification: `personatype`, `vertical`, `matchtier`

***

## 3. Backend–Frontend Mapping

### **Dashboard_v1 Components** (dashboard_v1/src/)

| Component | Route | Backend API(s) | Purpose | Data Flow |
|-----------|-------|----------------|---------|-----------|
| **TodaysBoard.tsx** | `/` (landing) | `GET /api/todays-board` | Shows top 20 scored contacts grouped by tier (HIGH/MED/LOW) | Read-only dashboard aggregation |
| **ContactsView.tsx** | `/contacts` | `GET /api/v2/contacts` (paginated) | Full contact list with search, filter, sort | Read-only table with drill-down to detail |
| **ContactDetail.tsx** | `/contacts/:id` | `GET /api/contacts/{id}`<br>`POST /api/contacts/{id}/enrich`<br>`GET /api/contacts/{id}/enrichment-status` | Single contact deep dive with enrich trigger | Read contact → trigger enrichment → poll status → display results |
| **LandingPage.tsx** | `/` | `GET /health` | Health check and system status | Read-only system monitoring |
| **AppShell.tsx** | N/A (layout) | None | Navigation shell for all pages | Layout wrapper |
| **Analytics** (future) | `/analytics` | `GET /api/analytics` | System-wide metrics dashboard | Read-only KPI visualization |

### **API Client Wiring** (dashboard_v1/src/config/api.ts)

- **Base URL Config**: `VITE_APEX_API_URL` or fallback to `VITE_API_URL` (https://apex-backend-i7b0.onrender.com)
- **TypeScript API Layer**: Typed `ContactV1` interface with `apexscore`, `enrichmentstatus`, `matchtier`, etc.
- **Key Functions**: `getContactsV2()`, `enrichContact()`, `getTodaysBoard()`, `getAnalytics()`, `batchEnrich()`

***

## 4. Frontend Design Artifacts

### **Existing UI Patterns** (inferred from code)

| Screen | Layout | Key Elements | Backend Data |
|--------|--------|--------------|--------------|
| **TodaysBoard** | 3-column tier grid (HIGH/MED/LOW) | Contact cards with scores, company, title | `/api/todays-board` → 20 contacts grouped by `unifiedqualificationscore` |
| **ContactsView** | Data table (paginated) | Name, Company, Title, Score, Enrich Status, Actions | `/api/v2/contacts` → paginated list with search |
| **ContactDetail** | Single-column detail view | Contact fields, enrichment sections, score breakdown, enrich button | `/api/contacts/{id}` → full contact object + enrichment JSON |
| **Analytics** | KPI grid + charts | Total contacts, enrichment rate, avg scores, tier distribution | `/api/analytics` → system metrics |

### **Design Notes** (no Figma files found)
- No wireframes or mockups located in repository
- UI follows standard CRM pattern: list → detail → action
- Material-UI or similar component library inferred from `.tsx` patterns
- **For LatticeIQ**: Recommend Figma/Sketch audit of existing Dashboard_v1 before redesign

***

## 5. Suitability for LatticeIQ (Reuse vs. Redesign)

### **✅ REUSE AS-IS**

| Module | Rationale | LatticeIQ Role |
|--------|-----------|----------------|
| **ApexCustomEnrichment** | Production-validated 3-stage enrichment; clean separation of concerns | Core enrichment service (expose via API or internal library) |
| **IntegratedScoring** | Multi-framework scoring (APEX/BANT/SPICE) with proven weighting | Scoring engine for all verticals |
| **contactservice** | Battle-tested CRUD with proper error handling | Base data access layer |
| **EnrichmentParser** | Stateless parser with clear input/output contract | Reuse for any LLM-based enrichment |

### **🔄 EXTEND/REFACTOR**

| Module | Current Issues | LatticeIQ Changes |
|--------|----------------|-------------------|
| **Database Schema** | Mixed SQLite/PostgreSQL; no migrations framework | Standardize on Postgres; add Alembic migrations; normalize `contactmatch` table |
| **API Routes** | Dual-backend pattern (root `api.py` + `apps/backend/main.py`) causes confusion | Consolidate into single FastAPI app; versioned routes (`/api/v3`) |
| **HubSpot Sync** | POC-quality; hardcoded filters | Extract to pluggable CRM connector pattern (HubSpot/Salesforce/Pipedrive) |
| **Smart Lists & Cold Call Queue** | Backend endpoints exist but frontend not implemented | Build full feature or remove to reduce tech debt |

### **❌ RETIRE**

| Module | Rationale | Replacement |
|--------|-----------|-------------|
| **EnhancedEnrichment** | Legacy pre-ApexCustom engine; superseded | Remove; ApexCustomEnrichment is canonical |
| **Import Filters** (root `filters/importfilters.py`) | Standalone Flask-style routing; doesn't fit FastAPI pattern | Merge into main FastAPI app |
| **SQLite Fallback** | Development-only; causes schema drift | Postgres-only; Docker Compose for local dev |

***

## 6. Risks / Known Issues from Previous Builds

### **Technical Debt**
1. **Dual Backend Confusion**: Root `api.py` (minimal FastAPI + Import Filters) vs. `apps/backend/main.py` (full v2.0 app) — unclear which is canonical
2. **No Migration Framework**: Schema changes done via raw SQL in `start.sh` — brittle and error-prone
3. **Inconsistent Field Naming**: `name` vs. `firstname`/`lastname`, `apexscore` vs. `unifiedqualificationscore` — frontend must handle both
4. **Hardcoded API URLs**: Some frontend configs have fallback logic that masks deployment issues

### **Operational Risks**
1. **Async Enrichment Gaps**: `/api/contacts/{id}/enrich` is synchronous (30s timeout risk); no job queue (Redis/Celery) for long-running tasks
2. **API Key Exposure**: Perplexity/OpenAI keys in `.env` without rotation strategy
3. **No Rate Limiting**: Enrichment APIs could be abused; no throttling on `/bulk-enrich`
4. **Monitoring Blind Spots**: `/health` endpoint exists but no APM (DataDog/Sentry) integration

### **Data Quality**
1. **Enrichment Parsing Fragility**: EnrichmentParser assumes specific GPT-4 output format; breaks if prompt changes
2. **Stale Scores**: No automatic re-scoring when contact data changes (manual `/api/contacts/{id}/score` call required)
3. **No Duplicate Detection**: Email-based deduplication in create endpoint but not batch import

***

## 7. Questions & Recommendations for LatticeIQ

### **Domain Boundaries & Ownership**
1. **Q1: Should LatticeIQ be multi-tenant from day one?**  
   *Current Apex is single-tenant (one `userprofile`). If LatticeIQ targets teams/orgs, add `organization_id` to all tables and row-level security.*

2. **Q2: Which intelligence engines are "core platform" vs. "product features"?**  
   *Recommendation: Extract enrichment/scoring into standalone Python libraries (published to private PyPI) so they can be versioned independently of the API.*

3. **Q3: How to handle vertical-specific logic (SaaS vs. Insurance personas)?**  
   *Recommendation: Plugin architecture — load vertical config from YAML/JSON, avoid hardcoding in `classify_persona()`. Allows customers to define custom verticals.*

### **Service Decomposition**
4. **Q4: Should enrichment be a separate microservice?**  
   *YES if LatticeIQ scales to >10K contacts/day. Enrichment is I/O-bound (external APIs) and should scale independently. Use FastAPI + Celery + Redis.*

5. **Q5: Where to draw the line between "backend logic" and "LLM prompts"?**  
   *Recommendation: Store prompts in database (`enrichment_templates` table) or config files, not Python strings. Enables A/B testing and non-eng edits.*

### **API Style & Data Contracts**
6. **Q6: REST vs. GraphQL for LatticeIQ API?**  
   *Recommendation: Stick with REST for v1 (proven pattern), but design resources around **workflows** not just CRUD (e.g., `/contacts/{id}/workflows/enrich-and-score` instead of separate endpoints).*

7. **Q7: How to version the API when scoring formulas change?**  
   *Recommendation: Add `score_version` field to contacts table. Keep old scoring functions for backward compatibility. API returns `{"apex_score": 85, "score_version": "2.1"}`.*

8. **Q8: Should frontend depend on backend data formats or have a transformation layer?**  
   *Recommendation: Introduce BFF (Backend-for-Frontend) pattern — thin API layer that maps backend domain models to frontend view models. Decouples evolution.*

### **Authentication, Authorization, Logging**
9. **Q9: What auth pattern for LatticeIQ (JWT, OAuth2, API keys)?**  
   *Recommendation: OAuth2 + JWT for user auth, API keys for system-to-system (e.g., CRM connectors). Use FastAPI's `OAuth2PasswordBearer` dependency.*

10. **Q10: How to audit enrichment costs (Perplexity/OpenAI API usage)?**  
    *Recommendation: Add `enrichment_logs` table with `contact_id`, `engine`, `tokens_used`, `cost_usd`, `timestamp`. Dashboard for spend tracking.*

### **Performance, Scalability, Security**
11. **Q11: What's the target SLA for enrichment (latency, throughput)?**  
    *Current: ~30s per contact (synchronous). Recommendation: Target <5s for fast path (cached/partial enrichment), queue full enrichment for <5min async completion.*

12. **Q12: How to prevent enrichment re-runs for unchanged contacts?**  
    *Recommendation: Content-addressable caching — hash `(name, company, title)` and check if enrichment exists for that hash. Saves API costs.*

13. **Q13: Should LatticeIQ expose webhooks for enrichment completion?**  
    *YES if customers integrate with external systems (e.g., trigger Slack notification when high-score contact enriched). Use event-driven architecture (EventBridge/Pub-Sub).*

14. **Q14: How to handle PII (email, phone) in logs and observability?**  
    *Recommendation: Redact PII in logs (use `structlog` with PII filters). Encrypt PII at rest (SQLAlchemy `TypeDecorator` with Fernet). Add GDPR delete endpoint.*

15. **Q15: What's the disaster recovery plan if enrichment data is corrupted?**  
    *Recommendation: Immutable enrichment history — never UPDATE `enrichmentdata`, always INSERT new version with `enrichment_version` field. Allows rollback.*

***

## Next Steps: LatticeIQ v1.0 Roadmap

### **Phase 1: Foundation (Weeks 1-2)**
- [ ] Consolidate backends: Merge `api.py` and `apps/backend/main.py` into single FastAPI app
- [ ] Add Alembic migrations: Replace raw SQL in `start.sh`
- [ ] Docker Compose dev environment: PostgreSQL + Redis + FastAPI
- [ ] Extract enrichment/scoring into libraries: `latticeiq-intelligence==0.1.0`

### **Phase 2: API Stabilization (Weeks 3-4)**
- [ ] Design `/api/v3` routes: RESTful workflows (`/contacts/{id}/actions/enrich`)
- [ ] Add OpenAPI spec: Document all endpoints with examples
- [ ] Implement auth: OAuth2 + JWT with role-based access control (RBAC)
- [ ] Rate limiting: 100 requests/min per user, 10 enrichments/min

### **Phase 3: Feature Parity (Weeks 5-6)**
- [ ] Migrate TodaysBoard: Backend aggregation + React component
- [ ] Migrate ContactsView: Paginated table with filters
- [ ] Migrate ContactDetail: Full enrichment UI with status polling
- [ ] Add Analytics Dashboard: Charts for KPIs (Chart.js or Recharts)

### **Phase 4: LatticeIQ Differentiation (Weeks 7-8)**
- [ ] Multi-tenant support: Add `org_id` foreign key to all tables
- [ ] CRM connectors: HubSpot/Salesforce OAuth flows + incremental sync
- [ ] Async enrichment: Celery workers + Redis queue
- [ ] Webhooks: Event subscriptions for `contact.enriched`, `contact.scored`

### **Phase 5: Production Readiness (Weeks 9-10)**
- [ ] Monitoring: Sentry error tracking + DataDog APM
- [ ] Cost tracking: Enrichment logs + usage dashboard
- [ ] Security audit: OWASP Top 10 + PII encryption
- [ ] Load testing: 1000 concurrent users, 10K enrichments/day

***

**Final Recommendation**: Start with **Phase 1** (consolidate backends, add migrations) to establish technical foundation. Then prioritize **Phase 3** (feature parity) to ship LatticeIQ v1.0 quickly using proven Apex modules. **Phase 4** (differentiation) and **Phase 5** (production readiness) can be iterative releases post-launch.

[1](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_747aeb83-8e6a-4566-b2b1-733b8db8bda4/9c031784-5364-447d-8305-ec160d110728/paste.txt)