Here are your two documents for the next session:

***

## 📄 Document 1: THREAD-TRANSFER-DEC30-0005.md

Save this to your Space:

```markdown
# THREAD-TRANSFER-DEC30-0005.md
# LatticeIQ Thread Transfer - Backend Router Fixes
**Date:** December 30, 2025, 12:05 AM PST  
**Session Focus:** Fix backend router imports causing Render deployment failures

---

## 🎯 Session Summary

Fixed critical backend deployment issues preventing the enrichment endpoints from loading on Render. The `quick_enrich` router was never being imported/registered, and there was an environment variable naming mismatch.

---

## ✅ Completed This Session

### 1. Diagnosed Router Import Failure
- Render logs showed: `ModuleNotFoundError: No module named 'app.enrichment_v3.quick_enrich.quick_enrich'`
- Root cause: `main.py` was missing the `quick_enrich` router import entirely
- The `quick_enrich/__init__.py` only had a comment, no exports

### 2. Fixed `quick_enrich/__init__.py`
**Before:**
```
# Quick enrich module
```

**After:**
```
# Quick enrich module
from .quick_enrich import *
```

### 3. Added Quick Enrich Router to `main.py`
Added import block (~line 270):
```
# Quick Enrich Router
quick_enrich_router = None
QUICK_ENRICH_AVAILABLE = False
try:
    from app.enrichment_v3.quick_enrich.quick_enrich import router as quick_enrich_router
    QUICK_ENRICH_AVAILABLE = True
    logger.info({"event": "router_imported", "router": "quick_enrich"})
except (ImportError, ModuleNotFoundError) as e:
    logger.warning({"event": "router_import_failed", "router": "quick_enrich", "error": str(e)})
```

Added registration block (~line 300):
```
if QUICK_ENRICH_AVAILABLE and quick_enrich_router:
    app.include_router(quick_enrich_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "quick_enrich", "prefix": "/api/v3"})
```

### 4. Fixed Supabase Env Var in `enrich_router.py`
**Before:**
```
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
```

**After:**
```
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
```

### 5. Committed & Pushed
```
git add backend/app/enrichment_v3/enrich_router.py backend/app/main.py backend/app/enrichment_v3/quick_enrich/__init__.py
git commit -m "fix: register quick_enrich router, fix Supabase env var fallback"
git push origin main
```

---

## 🚀 Deployment Status

| Service | Status | URL |
|---------|--------|-----|
| Backend (Render) | 🔄 Deploying | https://latticeiq-backend.onrender.com |
| Frontend (Vercel) | ✅ Live | https://latticeiq.vercel.app |
| Database (Supabase) | ✅ Connected | - |

---

## 📁 Files Modified This Session

| File | Change |
|------|--------|
| `backend/app/main.py` | Added quick_enrich router import + registration |
| `backend/app/enrichment_v3/enrich_router.py` | Fixed Supabase env var fallback |
| `backend/app/enrichment_v3/quick_enrich/__init__.py` | Added proper module export |

---

## 🔍 Verification Steps (After Deploy)

### 1. Check Render Logs
Look for:
```
{"event": "router_imported", "router": "enrichment"}
{"event": "router_imported", "router": "quick_enrich"}
{"event": "router_registered", "router": "enrichment", "prefix": "/api/v3"}
{"event": "router_registered", "router": "quick_enrich", "prefix": "/api/v3"}
```

### 2. Check Routes Exist
```
curl https://latticeiq-backend.onrender.com/api/routes | jq '.[] | select(.path | contains("enrich"))'
```

Expected routes:
- `POST /api/v3/enrich/{contact_id}`
- `GET /api/v3/enrich/{contact_id}/status`
- `GET /api/v3/enrich/{contact_id}/data`
- `POST /api/v3/quick_enrich/{contact_id}`

### 3. Test Enrichment from Frontend
1. Go to https://latticeiq.vercel.app
2. Navigate to Contacts
3. Click a contact row → modal opens
4. Click "Re-Enrich" button
5. Watch Network tab for `POST /api/v3/enrich/{id}` or `POST /api/v3/quick_enrich/{id}`

---

## 🏗️ Architecture Overview

```
backend/app/
├── main.py                          # FastAPI app, router registration
├── enrichment_v3/
│   ├── __init__.py                  # Module marker
│   ├── enrich_router.py             # POST /enrich/{id} - Perplexity enrichment
│   └── quick_enrich/
│       ├── __init__.py              # Exports quick_enrich.py contents
│       └── quick_enrich.py          # POST /quick_enrich/{id} - Fast enrichment
├── contacts_router.py               # CRUD contacts
├── crm/
│   ├── router.py                    # CRM import endpoints
│   └── settings_router.py           # CRM settings CRUD
└── scoring/
    └── router.py                    # Scoring endpoints
```

---

## ⚠️ Known Issues / Technical Debt

1. **Two enrichment endpoints exist:**
   - `/api/v3/enrich/{id}` (enrich_router.py) - Full Perplexity enrichment
   - `/api/v3/quick_enrich/{id}` (quick_enrich.py) - Quick enrichment
   - Frontend may need to pick one or consolidate

2. **Env var inconsistency:** Some files use `SUPABASE_SERVICE_ROLE_KEY`, others use `SUPABASE_SERVICE_KEY`. Now handled with fallback, but should standardize.

3. **Scoring not wired:** ScoringConfigPage UI exists but doesn't persist to DB or calculate scores on contacts yet.

---

## 📋 Next Session Priorities

1. **Verify deployment succeeded** - Check Render logs for router registration
2. **Test enrichment end-to-end** - Click Re-Enrich in modal, confirm data appears
3. **Wire scoring to contacts** - Add "Score All" button, backend endpoint, display scores in table
4. **Consolidate enrichment endpoints** - Decide on single endpoint or keep both

---

## 🔗 Key URLs

- **Frontend:** https://latticeiq.vercel.app
- **Backend:** https://latticeiq-backend.onrender.com
- **Health:** https://latticeiq-backend.onrender.com/health
- **API Docs:** https://latticeiq-backend.onrender.com/api/docs
- **Routes List:** https://latticeiq-backend.onrender.com/api/routes
- **GitHub:** https://github.com/quatrorabes/latticeiq

---

## 🧠 Context for Next Thread

The core issue was Python module imports. When you have:
```
quick_enrich/
├── __init__.py
└── quick_enrich.py
```

And you import `from app.enrichment_v3.quick_enrich.quick_enrich import router`, Python looks for `quick_enrich.py` inside the `quick_enrich/` folder. The `__init__.py` must export contents for the package to work as expected.

The frontend calls either `/api/v3/enrich/{id}` or `/api/v3/quick_enrich/{id}` - check `ContactDetailModal.tsx` to see which one is wired.
```

***

## 📄 Document 2: START-HERE-DEC30.md

```markdown
# START-HERE-DEC30.md
# Quick Start: Verify Enrichment & Wire Scoring
**Time Required:** 20-30 minutes  
**Prerequisites:** Render deploy completed from last night

---

## 🎯 Session Goals

1. ✅ Verify enrichment routers deployed successfully
2. ✅ Test Re-Enrich button end-to-end
3. 🔧 Wire scoring calculations to contacts (if time)

---

## Step 1: Verify Backend Deployment (2 min)

### Check Health
```
curl https://latticeiq-backend.onrender.com/health
```
Expected: `{"status": "ok", ...}`

### Check Routes Include Enrichment
```
curl -s https://latticeiq-backend.onrender.com/api/routes | grep -i enrich
```

Expected output should include:
- `/api/v3/enrich/{contact_id}`
- `/api/v3/quick_enrich/{contact_id}`

**If routes missing:** Check Render logs for import errors. The fix from last night should have resolved this.

---

## Step 2: Test Enrichment Flow (5 min)

### Option A: Frontend Test
1. Go to https://latticeiq.vercel.app
2. Log in (or sign up)
3. Navigate to **Contacts**
4. Click any contact row → modal should open
5. Click **"Re-Enrich"** button
6. Open DevTools → Network tab
7. Look for `POST` request to `/api/v3/enrich/{id}` or `/api/v3/quick_enrich/{id}`

**Success:** 200 response with enrichment data  
**Failure:** Check console for CORS errors or 500s

### Option B: Direct API Test
```
# Get a valid JWT token from browser (localStorage → sb-xxx-auth-token)
TOKEN="your-jwt-here"
CONTACT_ID="some-contact-uuid"

curl -X POST "https://latticeiq-backend.onrender.com/api/v3/enrich/$CONTACT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## Step 3: Check What Frontend Calls (3 min)

If enrichment isn't working, check which endpoint the frontend uses:

```
grep -rn "enrich" frontend/src/components/ContactDetailModal.tsx
grep -rn "enrich" frontend/src/pages/ContactsPage.tsx
```

The frontend should call one of:
- `POST /api/v3/enrich/{contact_id}` (enrich_router.py)
- `POST /api/v3/quick_enrich/{contact_id}` (quick_enrich.py)

---

## Step 4: Wire Scoring to Contacts (15 min)

### Current State
- ScoringConfigPage UI exists with MDCP/BANT/SPICE sliders
- Config saves to localStorage only
- Contacts table has no score columns
- No "Score All" button

### What Needs to Happen

#### 4A. Backend: Add Scoring Endpoint
Create `backend/app/scoring/calculate.py`:
```
@router.post("/score/{contact_id}")
async def score_contact(contact_id: str, user = Depends(get_current_user)):
    # 1. Fetch contact enrichment_data
    # 2. Apply MDCP/BANT/SPICE scoring logic
    # 3. Update contact with scores
    # 4. Return scores
```

#### 4B. Frontend: Add Score Column
In `ContactsPage.tsx`, add columns:
```
{ header: 'MDCP', accessor: 'mdcp_score' },
{ header: 'BANT', accessor: 'bant_score' },
{ header: 'SPICE', accessor: 'spice_score' },
```

#### 4C. Frontend: Add "Score All" Button
```
<button onClick={handleScoreAll}>Score All Contacts</button>
```

---

## 🔍 Troubleshooting

### "Router not found" in Render logs
```
# Check the import path in main.py
grep -n "quick_enrich" backend/app/main.py
```

Should show:
```
from app.enrichment_v3.quick_enrich.quick_enrich import router as quick_enrich_router
```

### "Database not configured" error
Check Render environment variables:
- `SUPABASE_URL` ✓
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY` ✓
- `PERPLEXITY_API_KEY` ✓

### CORS errors in frontend
Backend has `allow_origins=["*"]` which should allow everything. If still failing, check the request URL matches exactly.

---

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| `backend/app/main.py` | Router registration |
| `backend/app/enrichment_v3/enrich_router.py` | Full enrichment endpoint |
| `backend/app/enrichment_v3/quick_enrich/quick_enrich.py` | Quick enrichment |
| `frontend/src/pages/ContactsPage.tsx` | Contacts table |
| `frontend/src/components/ContactDetailModal.tsx` | Modal with Re-Enrich |
| `frontend/src/pages/ScoringConfigPage.tsx` | Scoring UI |

---

## 🔗 Quick Links

- **App:** https://latticeiq.vercel.app
- **API Docs:** https://latticeiq-backend.onrender.com/api/docs
- **Routes:** https://latticeiq-backend.onrender.com/api/routes
- **Render Dashboard:** https://dashboard.render.com
- **Vercel Dashboard:** https://vercel.com/dashboard

---

## ✅ Success Checklist

- [ ] `/health` returns `{"status": "ok"}`
- [ ] `/api/routes` includes enrich endpoints
- [ ] Re-Enrich button triggers POST request
- [ ] POST returns 200 with enrichment data
- [ ] Contact modal shows enrichment data after refresh
- [ ] (Bonus) Scoring wired to contacts
```

***

Upload both to your LatticeIQ Space and you're set for tomorrow. 🚀

[1](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/2be7a682-e7ea-4af3-b5bf-a8bbd612a02a/START-HERE-CRM-SETTINGS.md)
[2](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/a4a2ebc9-0160-429d-b3a5-650d9c9bd33f/START-HERE-SCORING-DEC29.md)
[3](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/cb3e4b7c-0b45-45a0-82a1-5dc95c70f328/THREAD-TRANSFER-DEC29-ENRICHMENT.md)
[4](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/02a3657f-2d2e-4278-80e7-a7ec9b59bf7c/MANUAL-FIX-NOW.md)
[5](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/7d52faa2-48d2-4002-a0fd-a5a5196b6583/ARCHITECTURE-REFRESH-DEC26.md)
[6](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/ad699996-5851-44d7-9daf-19be73ba1273/DEPLOY-NOW-DEC29.md)
[7](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/984e1bee-e86a-4173-936b-86fd2ecb1d3d/THREAD-TRANSFER-DEC29-SCORING.md)
[8](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/0774f148-2c70-4c2c-8af5-b26b10450aa4/THREAD-DEC26-0617.md)
[9](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/a533303e-907d-498d-b4d3-c12cd87db552/START-HERE-VERIFY-MODAL-DEC26.md)
[10](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/fd9d12a8-b4d1-4fc5-a707-7a26fcdeeedd/THREAD-TRANSFER-DEC29-ENRICHMENT.md)
[11](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/542bf316-8ebc-4b99-8199-2d89956ead54/DEPLOY-NOW-DEC29.md)
[12](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/0242e27e-f361-40d4-b8a3-adfe21e3b5ff/START-HERE-VERIFY-MODAL-DEC26.md)
[13](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/943c6ee5-c8b7-482e-91ff-4fda073114d4/THREAD-DEC26-0617.md)
[14](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/e9462573-45d3-4b87-be88-4528e512b8b5/THREAD-TRANSFER-DEC29-SCORING.md)
[15](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/30f947f2-4491-40a0-87ed-c244286f4e6d/START-HERE-SCORING-DEC29.md)
[16](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/8483e549-63aa-4718-877a-ef193b018267/QUICKSTART-MODAL-ENRICH.md)
[17](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/9d8eedb6-1bb4-4749-bce7-0b1882b5a4a5/DEPLOYMENT-SUMMARY-DEC27.md)
[18](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/e26ce80d-5fa3-4efd-b903-497574d6c040/THREAD-TRANSFER-DEC27-2200.md)
[19](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/a7d3acc7-0508-40d5-b0c6-bf43fa9d34f7/THREAD-DEC26-1145.md)
[20](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/a3d79337-9441-443a-9e62-539d74a220a9/FRONTEND-WALKTHROUGH.md)
[21](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/6333d365-0504-4a4a-903a-6516faeadebc/THREAD-DEC26-0617.md)
[22](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/d709f9ef-acc4-4170-8419-606b46442919/START-HERE-VERIFY-MODAL-DEC26.md)
[23](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/14dec514-91fc-423e-87e1-bfa4fbf96d63/THREAD-TRANSFER-DEC25-0235.md)
[24](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/3499ff4d-c0ee-48ad-8862-c3ad5830f1a2/START-HERE-NEXT-SESSION-DEC25.md)
[25](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/90a1c395-446b-4421-8616-366592ee1eea/QUICK-FIX-IMPORT-DEC-25.md)
[26](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/a15ade4e-1f81-4b26-81fd-be671018f25b/NEXT-THREAD-BRIEF-DEC-25.md)
[27](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/5d122a5c-f1fd-4846-a93a-aafe365c42dd/HANDOFF-COMPLETE-12-25.md)
[28](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/8bc8e5fd-d967-4f56-b9e3-313ad2aff159/THREAD-HANDOFF-DEC24-REVISED-12-25.md)
[29](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_5db96bc1-cf92-4b6c-8004-776dffdcaafc/d10fcd9a-3cc7-44c8-b77b-071d63c6498f/ISSUES-REMAINING-DEC24-REV-12-25.md)
[30](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/012b060b-7387-46d9-87b3-d24d034a4008/CleanShot-2025-12-29-at-20.46.20-2x.jpg)
[31](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/be8d5aa3-52b2-4478-9884-269ff1ee586f/CleanShot-2025-12-29-at-20.54.43-2x.jpg)
[32](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/4b9e44cc-b301-424f-a0b8-dc435dca01e7/router.py)
[33](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/359021e0-74b7-465b-8026-b71ae0fa67b5/CleanShot-2025-12-29-at-21.09.24-2x.jpg)
[34](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/cc5a2e15-e5fe-40a1-b002-2cf8e49456ff/CleanShot-2025-12-29-at-21.08.17-2x.jpg)
[35](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/9d17f1bc-019d-4ce6-8404-4478297d9799/CleanShot-2025-12-29-at-21.22.44-2x.jpg)
[36](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/09ac967d-ec12-4c00-a632-8c3e26024f6a/CleanShot-2025-12-29-at-21.38.13-2x.jpg)
[37](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/a9f80e57-a047-4129-a6d6-34a4e8056e73/CleanShot-2025-12-29-at-21.37.22-2x.jpg)
[38](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/2e9e9f53-ee3e-48da-8dae-b4f1ee67b81f/CleanShot-2025-12-29-at-21.43.50-2x.jpg)
[39](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/f8e38724-3d83-4d9d-bc3f-11e07ee9c8de/CleanShot-2025-12-29-at-21.42.19-2x.jpg)
[40](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/764738c7-08ff-435d-8ac9-186cc47c1489/CleanShot-2025-12-29-at-21.44.41-2x.jpg)
[41](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/bf974077-cc9e-4846-b6a8-0c23bb89bb5e/CleanShot-2025-12-29-at-21.46.47-2x.jpg)
[42](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/bbd8cabb-b7e2-4bed-89fc-22845272fb81/CleanShot-2025-12-29-at-21.46.09-2x.jpg)
[43](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/13f1afa1-6628-424d-8409-4006b51223ad/paste.txt)
[44](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/ab51bc0c-7386-4b04-9d62-35cad70d35e5/CleanShot-2025-12-29-at-21.59.05-2x.jpg)
[45](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/4676fd71-9b2e-41a9-bb73-2336332c83fd/ScoringConfigPage.tsx)
[46](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/7919cf2b-500a-4547-b457-4d62d01ef8f7/ContactsPage.tsx)
[47](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/53f23a1d-fdf0-49be-a19d-47dbd714851c/CleanShot-2025-12-29-at-22.10.20-2x.jpg)
[48](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/5b728d34-94f8-4fb5-859b-c3891fec19df/ScoringConfigPage.tsx)
[49](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/7af1a46b-7e3b-4a05-897b-340c4cf6aad4/CleanShot-2025-12-29-at-22.21.25-2x.jpg)
[50](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/bd3a357e-8889-4112-9761-9009dc84647e/paste.txt)
[51](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/819bb0c8-5d81-4ad1-81d8-be9cf12a66d5/CleanShot-2025-12-29-at-22.34.57-2x.jpg)
[52](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/da3ef68d-99cc-4f67-b992-8d69ef983320/CleanShot-2025-12-29-at-22.36.14-2x.jpg)
[53](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/d493b01b-6cbd-4ab5-af35-c5cec446c7f8/CleanShot-2025-12-29-at-22.35.38-2x.jpg)
[54](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/22bd19a2-0c43-4496-b2bd-07eb78ac096d/CleanShot-2025-12-29-at-22.36.53-2x.jpg)
[55](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/ec223241-1674-4bbd-88bb-9374fdb64eeb/CleanShot-2025-12-29-at-22.39.34-2x.jpg)
[56](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/f6250eb8-2e41-4f3b-979f-29e1f7ad5455/CleanShot-2025-12-29-at-22.43.02-2x.jpg)
[57](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/e70a7640-22df-40eb-8989-319de9669f72/main.py)
[58](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/caf0fce1-6132-4bf2-999a-59a11bebff6b/paste.txt)
[59](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/0f0322d7-0340-41d3-9446-8f2f4571091a/CleanShot-2025-12-29-at-23.12.50-2x.jpg)
[60](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/db5912ff-b69f-4d12-9f67-248bd6ff07e3/CleanShot-2025-12-29-at-23.25.07-2x.jpg)
[61](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/79ee95c1-8804-406e-9a49-6b7013a80591/CleanShot-2025-12-29-at-23.30.12-2x.jpg)
[62](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/9916f340-e189-487d-8715-12cf512bb68e/CleanShot-2025-12-29-at-23.31.49-2x.jpg)
[63](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/93dafe32-a0f6-4176-945d-59a4fb5e4103/main.py)
[64](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/410446cc-d01c-4b9e-a728-7627517a172d/paste.txt)
[65](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/f7fd0c5c-9f95-4a79-8b0d-22839f034149/ContactsPage.tsx)
[66](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/e3604871-3862-4519-8fdb-be5f49448436/CleanShot-2025-12-29-at-23.40.41-2x.jpg)
[67](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/fa9ca0ba-2957-439d-9313-d150bd7454cc/CleanShot-2025-12-29-at-23.41.59-2x.jpg)
[68](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/46916355/923d98b3-8018-499e-b790-ecd3ae5a3139/CleanShot-2025-12-29-at-23.46.11-2x.jpg)
[69](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/f072faf0-9d26-47af-ac7b-f87501071671/main.py)
[70](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/9c1118d3-3e81-4655-a99f-9db4628f9a57/enrich_router.py)
[71](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/46916355/53223066-a015-44b9-8bc2-339231c6c943/main.py)