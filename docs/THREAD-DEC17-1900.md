Got it. Here's your **Thread Transfer Document** — copy this into the new thread:

***

```markdown
# 🔄 APEX SALES INTELLIGENCE - THREAD TRANSFER
## Date: December 17, 2025, 7:12 PM PST
## Status: ACTIVE BUILD - Frontend stuck on "Loading contacts..."

---

# EXECUTIVE SUMMARY

We're rebuilding **Apex Sales Intelligence** with new architecture:

| Component | Old Name | NEW Name | Platform | Status |
|-----------|----------|----------|----------|--------|
| Frontend | Dashboard_v1 | **LatticeIQ** | Vercel | 🔄 Deployed, stuck loading |
| Backend | apex-backend | **ArcMetric** | Render | ✅ Running |
| Database | — | PostgreSQL | Railway | ✅ Running |

**CURRENT BLOCKER:** Frontend at `latticeiq-*.vercel.app` shows "Loading contacts..." — API call failing.

---

# ARCHITECTURE (NEW)

```
┌─────────────────────────────────────────────────────────────┐
│                    LATTICEIQ (Frontend)                      │
│      Vercel: latticeiq-*.vercel.app                          │
│      Tech: React 18 + TypeScript + Vite                      │
│      Repo: github.com/quatrorabes/latticeiq                  │
└────────────────────┬────────────────────────────────────────┘
                     │ REST API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              ARCMETRIC (Backend API)                         │
│      Render: https://arcmetric.onrender.com                  │
│      Tech: FastAPI + Python 3.11                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL (Database)                           │
│      Railway: apex-sales-intelligence                        │
└─────────────────────────────────────────────────────────────┘
```

---

# LIVE URLs

| Component | URL |
|-----------|-----|
| **LatticeIQ Frontend** | https://latticeiq-jxzawn8l0-quatrorabes-projects.vercel.app |
| **ArcMetric Backend** | https://arcmetric.onrender.com |
| **API Docs** | https://arcmetric.onrender.com/docs |
| **GitHub (Frontend)** | https://github.com/quatrorabes/latticeiq |

---

# CURRENT FRONTEND CODE

**File:** `~/projects/latticeiq/src/App.tsx`
```
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'

const API_URL = 'https://arcmetric.onrender.com'

interface Contact {
  id: number
  name: string
  email?: string
  company?: string
  title?: string
  enrichmentstatus?: string
}

function Dashboard() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // ... fetch logic
  })
}
```

---

# IMMEDIATE ISSUE TO FIX

**Symptom:** "Loading contacts..." never resolves
**Likely Cause:** 
1. CORS not configured on ArcMetric backend
2. API endpoint path mismatch (e.g., `/api/contacts` vs `/contacts`)
3. Render service sleeping (cold start)

**Debug Steps:**
```
# 1. Test backend directly
curl https://arcmetric.onrender.com/api/contacts

# 2. Check browser console for errors
# Open DevTools → Console → look for CORS or 404 errors

# 3. Verify endpoint exists
curl https://arcmetric.onrender.com/docs
```

---

# CRITICAL RULES (FROM PRIOR THREADS)

### RULE #1: UUID HANDLING
- Contact IDs are **UUID strings** (e.g., `f6e4e0f2-0597-47a2-b4f5-869fa94b6a12`)
- NEVER use `parseInt()` on contact IDs
- TypeScript: `id: string` NOT `id: number`

### RULE #2: PRESERVE ENRICHMENT ENGINES
Do NOT replace these battle-tested files:
- `enrichment_engine.py` (Perplexity 3-stage + GPT-4)
- `enhanced_enrichment.py` (4-stage pipeline)

### RULE #3: NOMENCLATURE
- Backend = **Apex** or **ArcMetric**
- Frontend = **LatticeIQ** (formerly Dashboard_v1)

---

# PRIOR ISSUES (SOLVED)

| Issue | Fix | Date |
|-------|-----|------|
| `react-router-dom` missing | `npm install react-router-dom` | Dec 17 |
| Vercel build failing | Added missing dependency | Dec 17 |

---

# ENVIRONMENT VARIABLES NEEDED

### Backend (Render - ArcMetric)
```
DATABASE_URL=postgresql://...    # Railway PostgreSQL
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
PORT=10000
```

### Frontend (Vercel - LatticeIQ)
```
VITE_API_URL=https://arcmetric.onrender.com
```

---

# DEPLOYMENT WORKFLOW

### Frontend (LatticeIQ)
```
cd ~/projects/latticeiq
npm run build                    # Test locally
git add -A && git commit -m "fix: description"
git push origin main             # Auto-deploys to Vercel
```

### Backend (ArcMetric)
```
cd ~/projects/apex-sales-intelligence
git push origin main             # Auto-deploys to Render
```

---

# NEXT STEPS

1. **Debug API connection** - Check CORS/endpoint paths
2. **Get contacts loading** - Verify `/api/contacts` endpoint
3. **Wire enrichment** - Connect "Enrich" button to `/api/batch/enrich`
4. **Display enrichment data** - Parse into UI sections

---

# ASSISTANT ROLE

You are the **Senior Lead Architect and DevOps Engineer** for **Sales Angel**.
- Focus on shipping features and ROI
- Use **Apex/ArcMetric** for backend, **LatticeIQ** for frontend
- Be proactive: suggest next moves after completing tasks

---

# END OF TRANSFER
Generated: December 17, 2025, 7:12 PM PST
```

***

**To transfer:** Copy the above markdown into your new thread. First command for the new thread:

```bash
curl -v https://arcmetric.onrender.com/api/contacts
```

This will reveal if it's a CORS issue, cold start, or missing endpoint.

[1](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/e27c19ad-b220-429c-b47e-7fccabd300bb/CleanShot-2025-12-17-at-19.11.09-2x.jpg?AWSAccessKeyId=ASIA2F3EMEYE4VHJLGHW&Signature=cjEP2ULNsTvplU%2FS5CeuozOQGME%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEMP%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCIQCPmbu%2F4T9gTP4vyBnf8kY42C%2BsA%2FFQXE9MQCBbMQsTxgIgO4YLoaxOOEUfsmMgkW%2Bf%2F9%2Bz98dWOQbJ3EGzE%2Fz9ChEq%2FAQIjP%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDJ1bG7RZnlXKQromaCrQBNDhzAywLoQkxjeFl7nViQ3jAC%2BtKXOYmlWQna4SEiaHU5LYnjKFNVoojIunDy3263rb%2FdPuW1XD6bygWxdBQoH3rHOGYQweBeDF5IIbjq4nSFnS%2Bzb2OWKdAEoBnD7%2FnpUfuNqftrEJ70uzc%2BOZ5pq3RWd686FsZet2ZeEIZ8lTZFraaLnWv%2BlycsHAuyQYPPNRZNPzuVQXoAemsetlaP2XIjWH0vIyp1lZSczqm2YAMJdiJ6P0HlrXivkRqg2ltVCqFi4%2Ba%2F15yb0487E44qftDAieg2kEBD33owlUTe2xfY4U59oNrq41xolfyiPEsi5JdQgmJEsikrbf0CbYeJG%2FoiVsK2bbplYOQbSnOFDb4cjOhd8s8T2T31fKeCURf8YJ0OD5g4QJx4oSZ2%2FfWE5p0sUkI2uQjiIZftL%2B8%2FKZc7deO15BWyTdOMl5G9AQofETG12iTuLuz2FmacwiveenWCOj5Fo%2BIVleqCcR9PWAnFH4AAK25DI2uTmICTwX0JW7ykKkHe8S%2BDEK%2FW1TWHNhBy30gOwmIImAZWebm3%2BBGaFyILF2i9bc43M1vr%2BJXmpzCR9u5P5xpxAJK6o7%2F7HqFRvnf9OPaKmppGtPI9iZDYXX3sJpCd4ZGWo%2FE6ZfBY6wSUHyfAfT%2Bjy2NYHOzxXKDreUOp0czxSZmblr3Gp1lRDqHGcCBf%2BMiTzl93o09uT8Mujo39wfFCPLUsu4iZUUziNMhujIvLzxC4JFsmlFiZc%2BF%2BPygNlkGU1N9RIpj%2FPBaDvfn2PY%2BL3LwzwUg0Aw4dmNygY6mAH3v5hLZMKmBKmi13bkBoB5bXBiwgpnOvwgaES96r74Vo7fkIV2gmYmJ7JWHGZa8ioujEyk9Q83deG18aXtWeMwc7jfuaFmmyr66sA8jG%2FY9YjToau83MnEhIVNDIAfnlnFQf85Xn2Rbr%2Byc6ExiScqjWNKmsI7Bw%2Fbs5lvvLFvaQMyw5x6%2FRQ3zojl%2BaGKCKW4kkar0PptzA%3D%3D&Expires=1766028174)
[2](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/556101c6-6363-41ab-af4a-cb0de53e15c7/APEX_SYSTEM_STATE.md)
[3](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/379aacb1-474b-42c1-b298-f926a32eee08/THREAD_TRANSFER_DEC16_2025.md)