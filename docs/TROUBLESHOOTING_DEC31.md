# LatticeIQ Troubleshooting Guide - Dec 31, 2025

**Version:** 3.0.0  
**Last Updated:** Dec 31, 2025 2:08 AM PST

---

## 🆘 **If Deployment Fails**

### Frontend Build Error (Vercel)

**Symptom:** Build fails with TypeScript errors  
**Check:** https://vercel.com → LatticeIQ project → Deployments tab

**Common Errors:**

1. **"Cannot find module '@types/react'"**
   ```bash
   cd frontend
   npm install
   npm run build
   git add package-lock.json
   git commit -m "fix: reinstall dependencies"
   git push
   ```

2. **"ScoreResponse is not exported"**
   - Verify `frontend/src/types/index.ts` exists
   - Verify it contains `export type ScoreResponse`
   - If missing, copy from LATTICEIQ_CONTEXT_DEC31.md

3. **"Cannot find module '../api/scoring'"**
   - Verify `frontend/src/api/scoring.ts` exists
   - Verify it exports all functions
   - If missing, create from scratch

---

### Backend Startup Error (Render)

**Symptom:** 404 on all endpoints  
**Check:** https://render.com → LatticeIQ Backend → Logs

**Common Errors:**

1. **"cannot import name HTTPAuthCredentials"**
   - This was the Dec 31 critical issue
   - Verify `backend/app/main.py` has scoring router DISABLED:
     ```python
     # Scoring Router - DISABLED
     scoring_router = None
     SCORING_AVAILABLE = False
     logger.warning({"event": "router_disabled", "router": "scoring", ...})
     ```
   - If not, replace entire main.py with version from LATTICEIQ_CONTEXT_DEC31.md

2. **"ModuleNotFoundError: No module named 'app'"**
   - Python path issue
   - Verify lines 15-20 in main.py set sys.path correctly
   - Check `backend/app/__init__.py` exists

3. **"Supabase not configured"**
   - Check Render environment variables
   - Must have: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
   - In Render dashboard: Settings → Environment → verify all present

---

## ✅ **Deployment Success Verification**

### Step 1: Check Backend Health
```bash
curl https://latticeiq-backend.onrender.com/api/v3/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-12-31T10:08:00.123456",
  "database": "connected",
  "enrichment": "available",
  "scoring": "disabled_for_maintenance"
}
```

**If you see:**
- ✅ `"status": "ok"` → Backend is alive
- ✅ `"database": "connected"` → Supabase is connected
- ✅ `"enrichment": "available"` → Enrichment router loaded
- ✅ `"scoring": "disabled_for_maintenance"` → Scoring disabled as designed

**If you see:**
- ❌ 404 → Backend didn't deploy, check Render logs
- ❌ 500 → Unhandled exception, check error message
- ❌ Connection refused → Backend not running

---

### Step 2: Check Frontend Load
```bash
# Open browser
open https://latticeiq.vercel.app

# Check console (F12 → Console tab)
# Expected: No red errors
```

**If you see:**
- ✅ Page loads → Frontend deployed successfully
- ✅ No red console errors → No TypeScript compilation issues
- ❌ Page blank/errors → Check Vercel logs
- ❌ Red 404 errors for API calls → Backend not deployed yet

---

### Step 3: Check API Routes
```bash
curl https://latticeiq-backend.onrender.com/api/routes | jq '.[] | select(.path | contains("/api/v3"))' | head -20

# Expected output:
# ✅ /api/v3/contacts (GET, POST, PUT, DELETE)
# ✅ /api/v3/enrich (POST)
# ✅ /api/v3/icp-config (GET)
# ❌ /api/v3/scoring (should NOT appear if disabled correctly)
```

---

## 🔄 **Fixing Scoring Router (Next Session)**

### If deployment succeeds, follow these steps:

#### Step 1: Create Missing Files

**File: `backend/app/scoring/models.py`**
```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ScoreResponse(BaseModel):
    contact_id: str
    mdcp_score: float
    mdcp_tier: str
    bant_score: float
    bant_tier: str
    spice_score: float
    spice_tier: str
    overall_score: float

class BatchScoringResponse(BaseModel):
    success: bool
    scored_count: int
    total_contacts: int
    errors: Optional[list] = None
    message: str
```

**File: `backend/app/scoring/calculators.py`**
```python
# Implement these 3 functions:

def calculate_mdcp_score(contact: dict, config: dict) -> dict:
    """Calculate MDCP score (Match, Data, Contact, Profile)"""
    # Implementation here
    return {"score": 0.0, "breakdown": {}}

def calculate_bant_score(contact: dict, config: dict) -> dict:
    """Calculate BANT score (Budget, Authority, Need, Timeline)"""
    # Implementation here
    return {"score": 0.0, "breakdown": {}}

def calculate_spice_score(contact: dict, config: dict) -> dict:
    """Calculate SPICE score (Situation, Problem, Implication, Critical Event, Decision)"""
    # Implementation here
    return {"score": 0.0, "breakdown": {}}
```

**File: `backend/app/scoring/router.py`** - Use corrected version from previous response
- Has correct imports (no HTTPAuthCredentials)
- Uses Depends(get_current_user)
- Includes all endpoints

#### Step 2: Re-enable in main.py

Change lines 228-233 from:
```python
# Scoring Router - DISABLED
scoring_router = None
SCORING_AVAILABLE = False
logger.warning(...)
```

To:
```python
# Scoring Router
scoring_router = None
SCORING_AVAILABLE = False
try:
    from app.scoring.router import router as scoring_router
    SCORING_AVAILABLE = True
    logger.info({"event": "router_imported", "router": "scoring"})
except (ImportError, ModuleNotFoundError) as e:
    logger.warning({"event": "router_import_failed", "router": "scoring", "error": str(e)})
```

Also un-comment lines 280-283:
```python
if SCORING_AVAILABLE and scoring_router:
    app.include_router(scoring_router, prefix="/api/v3")
    logger.info({"event": "router_registered", "router": "scoring", "prefix": "/api/v3"})
```

#### Step 3: Test
```bash
curl https://latticeiq-backend.onrender.com/api/v3/scoring/config/mdcp
# Should return scoring config

curl -X POST https://latticeiq-backend.onrender.com/api/v3/scoring/calculate-all/{contact_id}
# Should calculate and return scores
```

---

## 🐛 **Common Runtime Issues**

### "TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'"

**Cause:** Code assumes score exists, but it's None  
**Fix:** Add null checks

```python
# ❌ Wrong
score = contact.get('mdcp_score') + 10

# ✅ Right
score = (contact.get('mdcp_score') or 0) + 10
```

---

### "POST /api/v3/scoring/calculate-all/{id} returns 404"

**Cause:** Route wasn't registered  
**Check:**
```bash
curl https://latticeiq-backend.onrender.com/api/v3/health | jq '.scoring'
# If shows "disabled_for_maintenance", scoring router not re-enabled
```

**Fix:** Follow "Fixing Scoring Router" steps above

---

### "Contact not found in scoring calculation"

**Cause:** Using wrong workspace_id or user auth  
**Check:**
1. Verify authorization header is correct JWT
2. Verify contact exists in database
3. Check user_id matches workspace_id in database

```sql
-- In Supabase SQL console
SELECT id, user_id, first_name, email FROM contacts 
WHERE id = 'your-contact-id';
```

---

### "EnrichmentData fields missing"

**Cause:** Enrichment completed before schema updated  
**Fix:** Re-run enrichment on existing contacts

```python
# Frontend: Click "Enrich" on existing contact
# Or API: POST /api/v3/enrich/simple with contact_id
```

---

## 📊 **Monitoring & Logs**

### Render Logs
```
https://dashboard.render.com/services
→ LatticeIQ Backend
→ Logs tab
→ Filter by error/warning
```

**Key patterns to watch:**
- `"event": "router_import_failed"` → Router failed to load
- `"event": "auth_error"` → JWT authentication failed
- `"event": "supabase_init_failed"` → Database connection failed

### Vercel Logs
```
https://vercel.com
→ LatticeIQ project
→ Deployments
→ Select deployment
→ View logs
```

**Key patterns to watch:**
- `error TS` → TypeScript compilation error
- `Cannot find module` → Missing import
- `ERR!` → npm install failure

---

## 🔍 **Database Debugging**

### Check Contact Scores
```sql
SELECT 
  id, 
  email, 
  overall_score, 
  mdcp_score, 
  bant_score, 
  spice_score,
  updated_at
FROM contacts
WHERE overall_score IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;
```

### Check Enrichment Status
```sql
SELECT 
  id, 
  email, 
  enrichment_status, 
  enriched_at
FROM contacts
ORDER BY enriched_at DESC
LIMIT 10;
```

### Reset Scoring (if needed)
```sql
UPDATE contacts
SET mdcp_score = NULL,
    bant_score = NULL,
    spice_score = NULL,
    overall_score = NULL,
    mdcp_tier = NULL,
    bant_tier = NULL,
    spice_tier = NULL
WHERE id IN (select-your-contacts);
```

---

## 📞 **When Things Go Really Wrong**

### Nuclear Option: Full Reset
```bash
cd ~/projects/latticeiq

# Reset backend
git checkout backend/app/main.py
git push

# Reset frontend
git checkout frontend/src/
git push

# Wait 5 min for re-deploy
curl https://latticeiq-backend.onrender.com/api/v3/health
```

### If that doesn't work:
1. Check git status: `git status`
2. Verify you're on `main` branch: `git branch`
3. Check recent commits: `git log --oneline -n 5`
4. Check environment vars in Render/Vercel dashboards

---

## 📋 **Checklist for Success**

- [ ] Backend health returns 200
- [ ] Frontend loads without errors
- [ ] No red errors in browser console (F12)
- [ ] Contacts API working (GET /api/v3/contacts)
- [ ] Enrichment working (POST /api/v3/enrich/simple)
- [ ] Scoring disabled properly (routes not in /api/routes)
- [ ] Database connected (health check shows "connected")

---

**Document Version:** 1.0  
**Last tested:** Dec 31, 2025 2:08 AM PST  
**Status:** Ready for next session deployment
