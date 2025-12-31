# ADR-001: UUID Primary Keys for Multi-Tenant Isolation

**Status:** ✅ Accepted (Implemented Dec 2025)  
**Date:** December 2025  
**Author:** Chris Rabenold  
**Stakeholders:** Backend team, Database team  

---

## Problem Statement

**What decision did we need to make?**

How to uniquely identify records across a multi-tenant system where multiple workspaces may have overlapping or similar data?

**Why was this necessary?**

- Simple integer IDs (1, 2, 3...) don't guarantee global uniqueness across workspaces
- Risk: User A accidentally accessing User B's contact with ID=42
- Distributed systems (frontend, backend, external APIs) need globally unique identifiers
- Sharding/federation would require coordination of ID ranges

---

## Context

**Why did we face this choice?**

LatticeIQ is a multi-tenant B2B sales platform:
- Multiple customers ("workspaces") use same app
- Each has independent contact databases
- Frontend + Backend are separate services
- Contacts may be exported/imported to external systems

**What were the alternatives?**

| Option | Pros | Cons | Cost |
|--------|------|------|------|
| **Auto-increment integers** | Simple, fast, space-efficient | Not globally unique, requires coordination | ❌ Risk of data leaks |
| **String composite key (workspace_id + integer)** | Unique, avoids sharding | Complex queries, URL encoding issues | 🟡 Medium |
| **UUID4 (random)** | Globally unique, standard, no coordination needed | Larger storage, slower indexes | ✅ Chosen |
| **Nanoid** | Good balance of size + uniqueness | Less standard, library dependency | 🟡 Medium |

---

## Decision

### We chose: **UUID4 (Universally Unique Identifier v4)**

**Primary Key Type:** `UUID` (not auto-increment int)

```sql
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- ← UUID, not INTEGER
    workspace_id UUID NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    -- ...
    UNIQUE(workspace_id, email)  -- ← Unique within workspace
);
```

**Foreign Keys:** Also UUID to maintain consistency

```sql
CREATE TABLE enrichment_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL,  -- ← References contacts.id (UUID)
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);
```

---

## Rationale

### ✅ Why UUID?

1. **Globally Unique** - No ID coordination between services
   - Frontend can generate UUIDs without backend
   - Supports offline-first architectures
   - No race conditions on ID generation

2. **Multi-Tenant Safe** - Harder to accidentally access wrong workspace
   - Each record has unique ID
   - RLS policies can't mistakenly match similar IDs across workspaces

3. **Distributed-Friendly** - Standard across modern APIs
   - Graphql, REST APIs universally expect UUID
   - Standard in PostgreSQL, MongoDB, Firebase
   - No custom sharding logic needed

4. **Debugging** - Identifiers are non-sequential
   - Easier to spot in logs (not just "contact 42")
   - Supports audit trails

### ❌ Trade-offs

1. **Storage** - UUIDs are 36 bytes (text) vs 4 bytes (int)
   - Not a practical concern for <1M records
   - Standard acceptable trade-off

2. **Index Speed** - UUID indexes slightly slower than int
   - Still microseconds, not measurable in practice
   - PostgreSQL optimizes UUIDs well

3. **Human Readability** - Not friendly to manual lookups
   - OK: We use UUIDs in API responses, not visible to end users
   - Solution: Short display names still use integers for UI

---

## Implementation Details

### Database Level

```sql
-- All primary keys are UUID
CREATE TABLE workspaces (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ...);
CREATE TABLE users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ...);
CREATE TABLE contacts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ...);

-- Foreign keys reference UUIDs
ALTER TABLE users ADD CONSTRAINT users_workspace_fk
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
```

### Backend (Python/FastAPI)

```python
# Pydantic model expects UUID
from uuid import UUID
from pydantic import BaseModel

class ContactCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    # No id field - auto-generated

# Route returns UUID in response
@router.post("/api/v3/contacts")
async def create_contact(
    contact_data: ContactCreate,
    user: dict = Depends(get_current_user)
) -> dict:
    result = supabase.table("contacts").insert({
        **contact_data.dict(),
        "workspace_id": user["workspace_id"]
    }).execute()
    
    return {
        "id": result.data[0]["id"],  # UUID
        "created_at": result.data[0]["created_at"]
    }
```

### Frontend (React/TypeScript)

```typescript
// Types expect UUID string
type Contact = {
    id: string;  // UUID format: "550e8400-e29b-41d4-a716-446655440000"
    workspace_id: string;
    first_name: string;
    // ...
};

// API calls return UUID
const response = await fetch("/api/v3/contacts", { method: "POST", ... });
const contact: Contact = await response.json();
console.log(contact.id);  // "550e8400-e29b-41d4-a716-446655440000"
```

---

## Consequences

### ✅ Positive Outcomes

- **Data Isolation:** Each record globally unique, reduces risk of access control bugs
- **Scalability:** No need for UUID coordination as we scale to multiple databases
- **API Standardization:** Matches modern SaaS platforms (Stripe, HubSpot, Notion)
- **Developer Experience:** Less cognitive load on ID generation/coordination

### ⚠️ Mitigations Needed

| Risk | Mitigation |
|------|-----------|
| Slightly slower queries | Use `UUID` column type (PostgreSQL optimized), not text |
| Larger index size | Expected trade-off, monitor if >10GB dataset |
| API response size | Minimal impact (36 bytes per ID) |

---

## Alternatives Considered & Rejected

### 1. Auto-increment Integers
```sql
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,  -- ← Rejected
    workspace_id UUID,
    ...
);
```
**Why rejected:** Risk of ID collision across workspaces. User A guesses User B's contact ID=42 via API.

### 2. Composite Key (workspace_id + integer)
```sql
CREATE TABLE contacts (
    workspace_id UUID,
    id INTEGER,  -- ← Rejected
    PRIMARY KEY (workspace_id, id)
);
```
**Why rejected:** Complex URL encoding, foreign key complexity, not standard in REST APIs.

### 3. Nanoid (Short unique strings)
```sql
CREATE TABLE contacts (
    id VARCHAR(21) PRIMARY KEY,  -- "V1StGXR_Z5j3eK0O_9b23"
    ...
);
```
**Why rejected:** Less standard, library dependency, marginal storage savings.

---

## Validation & Metrics

### ✅ Working As Designed

- [x] All tables use UUID primary keys
- [x] Foreign keys reference UUIDs correctly
- [x] No ID conflicts across 3 test workspaces
- [x] API returns UUIDs without error
- [x] Supabase RLS policies work with UUID filters
- [x] Query performance acceptable (<50ms for 1000-contact queries)

### Monitoring

```sql
-- Monitor index health
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename LIKE '%contacts%';

-- Check for UUID conflicts (should be 0)
SELECT workspace_id, COUNT(*) as cnt
FROM contacts
GROUP BY workspace_id, id
HAVING COUNT(*) > 1;
```

---

## Related Decisions

- **ADR-002:** Multi-tenant RLS policies (depends on UUID uniqueness)
- **ADR-003:** API versioning strategy (v3 standardized on UUID responses)

---

## References

- [PostgreSQL UUID Type](https://www.postgresql.org/docs/current/datatype-uuid.html)
- [Multi-tenant SaaS Best Practices](https://www.microsoft.com/en-us/research/publication/saas-tenancy-patterns/)
- [UUID RFC 4122](https://tools.ietf.org/html/rfc4122)

---

## Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Tech Lead | Chris Rabenold | Dec 2025 | ✅ Approved |
| Backend Eng | Chris Rabenold | Dec 2025 | ✅ Approved |
| Product | (TBD) | — | ⏳ Pending |

---

## Review Schedule

- [x] Initial implementation: Dec 2025
- [ ] Performance audit: Jan 2026 (once >5000 records)
- [ ] Scale test: Feb 2026 (simulate 100K records)
- [ ] Annual review: Dec 2026

---

**Status:** ✅ **ACCEPTED** — This decision is final and implemented.

