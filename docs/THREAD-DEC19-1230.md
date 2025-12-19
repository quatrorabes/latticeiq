You have a full multi-service sales-enrichment stack wired together; the friction is mostly around the new Enrich UX and Tailwind v4 build quirks, not core architecture.[1][2]

## System overview

- **Frontend:** React + Vite + Tailwind, deployed to Vercel from `latticeiq/frontend`.[2][1]
- **Backend:** FastAPI (`main.py`) in `latticeiq/backend`, deployed to Render as `latticeiq-backend`.[3][1]
- **Database:** Supabase Postgres with RLS; `contacts` table carries enrichment status and JSON payloads.[1]
- **Auth:** Supabase Auth; frontend uses Supabase JS client, backend verifies JWT via `SUPABASE_JWT_SECRET`.[4][3]

Traffic flow:

1. User logs in on frontend → Supabase returns JWT.[4]
2. Frontend calls backend endpoints with `Authorization: Bearer <JWT>`.[1]
3. Backend decodes JWT in `get_current_user`, injects user context into routes.[3]
4. Contacts and enrichment rows are scoped by `user_id` (RLS).[1]

## Backend code and connections

### main.py (core API + wiring)

- Creates FastAPI app, adds CORS (`allow_origins=['*']`) for simplicity.[3]
- Defines `get_current_user(request)` which:
  - Extracts the `Authorization` header.
  - Decodes with `SUPABASE_JWT_SECRET` via `python-jose` (`HS256`, audience `authenticated`).[3]
  - Raises 401 on missing/invalid token.

- Wires enrichment subsystem:

```python
from enrichment_v3.api_routes import router as enrichment_router, set_auth_dependency
set_auth_dependency(get_current_user)
app.include_router(enrichment_router)
```

- Implements CRM importers:
  - `ContactValidator` to filter DNC, invalid emails, inactive records.[3]
  - `HubSpotImporter`, `SalesforceImporter`, `PipedriveImporter` with `normalize()` methods mapping API payloads into contact rows, all defaulting `enrichment_status = 'pending'`.[3]
  - `CSVImportRequest` and `/api/import/csv` to ingest arbitrary CSVs into `contacts`, applying the same validator and duplicate checks.[3]

- Implements contact CRUD endpoints:
  - `GET /api/contacts` → returns all contacts for `user_id = auth.uid()`.[3]
  - `GET /api/contacts/{id}`, `POST /api/contacts`, `DELETE /api/contacts/{id}`.[3]

These all use Supabase Python client (`create_client`) and filter by `userid` from JWT.[3]

### enrichment_v3 (parallel enrichment engine)

- Exposed via `api_routes.py` router; endpoints include:[1]
  - `POST /api/v3/enrichment/enrich` → single contact.
  - `POST /api/v3/enrichment/enrich/batch` → batch of pending contacts.
  - `GET /api/v3/enrichment/enrich/{id}/status`.
  - `GET /api/v3/enrichment/enrich/{id}/profile`.
  - `POST /api/v3/enrichment/cache/clear`.
  - `GET /api/v3/enrichment/health`.

- Architecture: 5 parallel Perplexity queries (COMPANY, PERSON, INDUSTRY, NEWS, OPEN_ENDED) with TTLs per domain (1–14 days) and a final GPT‑4o synthesis into a sales profile (summary, hooks, objections, BANT, APEX, etc.).[1]

- Enrichment results are persisted into Supabase:
  - `enrichment_data` JSONB – raw domain results + synthesized profile.
  - `enrichment_status` – `'pending' | 'processing' | 'completed' | 'failed'`.
  - `apex_score` and other score fields.[2][1]

## Frontend code and connections

### App shell (routing + auth)

There are two App variants across threads; current version (from earlier message) is:

```tsx
// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Contacts from './pages/Contacts';
import Dashboard from './pages/Dashboard';
import Sidebar from './components/Sidebar';
import Loader from './components/Loader';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, currentSession: Session | null) => {
        setSession(currentSession);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!session) {
    return (
      <Router>
        <div className="min-h-screen bg-gray-950">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-950">
        <Sidebar onLogout={handleLogout} />
        <main className="ml-64 min-h-screen p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/contacts" replace />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/contacts" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
```

Key points:

- Auth conditionally renders either auth routes or the main app.[5]
- `Contacts` page is the primary surface where enrichment UI lives.[2]

An older, simpler `App.tsx` in attachments uses a direct `ContactsTable` and inline `Auth` component; that version is not the one with router and sidebar, but it documents how Supabase auth and contacts table interconnect.[4]

### ContactsTable (current table + modal)

`ContactsTable.tsx` (canvas version) is a React component that:

- Loads contacts via `contactsService.getContacts()` on mount. [system-reminder][2]
- Maintains:
  - `contacts`, `filteredContacts`, `loading`, `error`.
  - `searchQuery`, `selectedContact`, `isModalOpen`. [system-reminder]
- Provides:
  - `handleSearch(query)` – client-side filtering by first/last/email/company. [system-reminder]
  - `handleRowClick(contact)` – sets `selectedContact` and opens `ContactDetailModal`. [system-reminder]
  - `handleDeleteContact(id, e)` – calls `contactsService.deleteContact(id)` and updates state. [system-reminder]
  - `getInitials`, `getDisplayName`, `getScoreBadge`, `getStatusBadge` – display helpers. [system-reminder]

It renders:

- A search input.
- Table headers: CONTACT, COMPANY, TITLE, APEX, STATUS, ACTIONS.
- For each row:
  - Avatar, name, email.
  - Company, title.
  - APEX score (colored).
  - Status badge (Pending/Completed/Processing/Failed).
  - Delete button (`✕`). [system-reminder]

At the bottom it renders:

```tsx
<ContactDetailModal
  contact={selectedContact}
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onEnrichComplete={() => {
    setIsModalOpen(false);
    loadContacts();
  }}
/>
```

So the modal is designed to re-trigger a contacts reload after enrichment.

### ContactDetailModal

Earlier in the thread, a richer `ContactDetailModal` was drafted:

- Props: `contact`, `isOpen`, `onClose`, optional `onEnrichComplete`.[5]
- Tabs: “Profile” vs “Raw Data”.
  - Profile: quick stats (APEX, status, title, company), summary, opening line, hook, why now, talking points, BANT, company info, objection handlers.
  - Raw Data: `JSON.stringify(contact.enrichment_data, null, 2)` with copy-to-clipboard.[5]

The deployed version (per Dec 18 thread) already supports showing synthesized enrichment when populated.[2]

Currently, in your latest canvas, `ContactDetailModal` for ContactsTable still uses a simpler design (summary + basic info), but it reads `contact.enrichment_data` from Supabase; the missing piece is a wired “Enrich” action.

### contactsService

Although the full file isn’t in the snippet, the Dec 18 status doc describes:

- `contactsService.getContacts()` – Fetches `/api/contacts` from backend, maps results into `Contact` type used by `ContactsTable`.[2]
- `contactsService.deleteContact(id)` – Calls `DELETE /api/contacts/{id}`.[2]

In this thread, a new method was specified conceptually:

- `contactsService.enrichContact(contactId)` – Should call `POST /api/v3/enrichment/enrich` with Supabase session token and `{ contact_id, synthesize: true }`, then let the frontend reload contacts.[1][2]

That method is **not yet present in your repo**, which is why you hit “this does not exist” when trying to wire an EnrichButton.[5]

## Data schema and enrichment lifecycle

### Supabase contacts table

Fields as documented:[1]

- Identity: `id SERIAL`, `user_id UUID`.
- Person/company: `firstname`, `lastname`, `email`, `phone`, `company`, `title`, `linkedin_url`, `website`, `vertical`, `persona_type`.
- Enrichment:
  - `enrichment_status` (`pending`, `processing`, `completed`, `failed`).
  - `enrichment_data` JSONB (raw+synthetic).
  - `enriched_at` timestamp.
  - `apex_score`, `mdcp_score`, `rss_score`.[2][1]

### Enrichment flow

1. A contact row exists with `enrichment_status = 'pending'`.[1][3]
2. Frontend (eventually via `EnrichButton`) calls `POST /api/v3/enrichment/enrich` with `contact_id`.[1]
3. Backend:
   - Loads the contact from Supabase.
   - Runs 5 domain-specific queries against Perplexity, merges them.
   - Calls GPT‑4o to synthesize a profile: summary, hooks, talking points, objections, BANT, scores.
   - Stores `enrichment_data`, sets `enrichment_status = 'completed'`, fills `apex_score`.[1]
4. Frontend refreshes list (`loadContacts()`), and:
   - Status column shows “completed”.
   - APEX column shows numeric score.
   - Modal can render summary and raw data if wired. [system-reminder][2]

## Tailwind / build configuration

- Frontend uses Tailwind CSS; earlier Vercel deploy errors came from Tailwind v4 requiring `@tailwindcss/postcss` rather than `tailwindcss` in `postcss.config.js`.[5]
- Fix pattern:
  - `npm install -D @tailwindcss/postcss tailwindcss autoprefixer postcss`.[5]
  - `postcss.config.js`:

    ```js
    export default {
      plugins: {
        '@tailwindcss/postcss': {},
        autoprefixer: {},
      },
    };
    ```

This unblocks Vite build so React side can deploy.

## Where enrichment UX currently stands

From Dec 18 status:[2]

- Contacts page + modal are live and wired.
- Enrichment V3 backend is deployed and healthy.
- Known gaps:
  - Enrich button wiring (frontend → `/api/v3/enrichment/enrich`) is partially done in older `Dashboard` code, not in the new `ContactsTable` stack.
  - Modal displays enrichment when present but lacks an obvious “Enrich” action.
  - Batch enrichment endpoints exist but no UI.

So the system is:

- **Technically capable** of full enrichment (back to Supabase JSONB, APEX scores).
- **Missing a clean, visible Enrich button** in your current `/contacts` UI, which is why you feel like the data is trapped.

## How everything ties together

| Layer | File(s) | Role |
|-------|---------|------|
| Auth | `frontend/lib/supabaseClient.ts`, `App.tsx` | Manages session, gates routes. [4][5] |
| Contacts UI | `frontend/components/ContactsTable.tsx`, `ContactDetailModal.tsx` | Displays contacts, opens modal, shows enrichment summary/raw. [system-reminder][2] |
| API client | `frontend/services/contactsService.ts` | Wraps `/api/contacts` and should add `/api/v3/enrichment/enrich`. [2] |
| Router | `frontend/pages/Contacts.tsx`, `App.tsx` | Renders contacts page under `/contacts` with sidebar. [5][2] |
| Backend core | `backend/main.py` | JWT validation, contacts CRUD, import endpoints, wiring enrichment_v3. [3] |
| Enrichment engine | `backend/enrichment_v3/api_routes.py`, `routes.py` | Parallel Perplexity + GPT‑4o enrichment, status+profile endpoints. [1] |
| Data store | Supabase `contacts` | Stores raw and synthesized enrichment, RLS by user_id. [1] |

If helpful, next step can be a **single, copy-paste EnrichButton + contactsService snippet** wired exactly to current `ContactsTable.tsx`, so you get a working button without additional surgery.

[1](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/af9e97d1-368f-4f25-8690-0dab8ff6351e/THREAD-DEC18-1845.md)
[2](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/bf4c5cbb-52a5-409f-a0ef-599b386f7ada/THREAD-DEC18-2300.md)
[3](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/29b6c71b-65f6-4a6d-ad68-62e10bd72503/main.py)
[4](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/77bb08ae-1286-441a-aaf7-cf8590bc8579/App.tsx)
[5](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/a5a0cf87-e881-407e-9c68-d446cab19276/CleanShot-2025-12-19-at-00.18.36-2x.jpg)
[6](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/a9abc118-15fa-401f-8df5-edf9c0653ebf/ContactsTable.tsx)Z