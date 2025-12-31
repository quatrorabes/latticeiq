Perfect! I'll create a comprehensive deployment guide for you to save and reference. This will consolidate both systems so you can deploy whichever version you need.

***

# 🚀 LATTICEIQ DEPLOYMENT GUIDE
**Date Created:** December 18, 2025, 12:26 PM PST  
**Project:** LatticeIQ Sales Intelligence Platform  
**Systems:** Legacy (apex-sales-intelligence) + New (LatticeIQ with Supabase Auth)

***

## 📋 TABLE OF CONTENTS

1. [System Overview](#system-overview)
2. [New System Deployment (RECOMMENDED)](#new-system-deployment-recommended)
3. [Legacy System Deployment](#legacy-system-deployment)
4. [Environment Variables Reference](#environment-variables-reference)
5. [Verification & Testing](#verification--testing)
6. [Troubleshooting](#troubleshooting)
7. [Architecture Comparison](#architecture-comparison)

***

## 🎯 SYSTEM OVERVIEW

You have **two parallel systems** in different states:

| System | Backend Status | Frontend Status | Auth | Multi-User |
|--------|---------------|-----------------|------|------------|
| **NEW (LatticeIQ)** | ✅ Deployed | ⏳ Ready to deploy | ✅ Supabase JWT | ✅ Yes |
| **Legacy (ArcMetric)** | ✅ Deployed | ⚠️ Stuck loading | ❌ None | ❌ No |

**RECOMMENDATION:** Deploy the **New System** - it's 95% complete with proper authentication and multi-tenant support.

***

## 🆕 NEW SYSTEM DEPLOYMENT (RECOMMENDED)

### Architecture

```
Frontend (Vercel) → Backend (Render) → Database (Supabase PostgreSQL)
  LatticeIQ          latticeiq-backend         Row-Level Security
```

### ✅ Already Completed

1. **Database Setup** - Supabase SQL executed
   - `profiles` table created
   - `contacts` table with `user_id` column
   - Row-Level Security (RLS) policies active
   - Auto-profile creation trigger

2. **Backend Deployed** - Render
   - URL: `https://latticeiq-backend.onrender.com`
   - Health check: `GET /health` → `{"status": "ok"}`
   - All endpoints filter by `user_id`
   - JWT auth validation working

3. **Frontend Code Ready** - GitHub
   - Repo: `quatrorabes/latticeiq`
   - Branch: `main` (default)
   - Auth UI complete (login/signup)
   - Dashboard with contact list

### 🚀 DEPLOYMENT STEPS

#### Step 1: Deploy Frontend to Vercel

1. **Go to Vercel Dashboard**
   - Click "Add New Project"
   - Click "Import Git Repository"

2. **Select Repository**
   - Choose: `quatrorabes/latticeiq`

3. **Configure Build Settings**
   ```
   Framework Preset: Vite
   Root Directory: frontend
   Build Command: npm run build
   Output Directory: dist
   ```

4. **Add Environment Variables** (CRITICAL)
   ```
   VITE_API_URL=https://latticeiq-backend.onrender.com
   VITE_SUPABASE_URL=[get from Supabase Dashboard → Settings → API]
   VITE_SUPABASE_ANON_KEY=[get from Supabase Dashboard → Settings → API]
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait 1-2 minutes for build

#### Step 2: Get Supabase Credentials

1. Go to **Supabase Dashboard**
2. Navigate to **Settings → API**
3. Copy:
   - **Project URL** → use as `VITE_SUPABASE_URL`
   - **anon/public key** → use as `VITE_SUPABASE_ANON_KEY`

#### Step 3: Verify Deployment

1. Visit your Vercel URL (e.g., `https://latticeiq.vercel.app`)
2. Should see: **Login screen** with email/password fields
3. Test login with your Supabase account
4. Should see: **Dashboard** with contacts list

***

## 🔧 LEGACY SYSTEM DEPLOYMENT

### Architecture

```
Frontend (Vercel) → Backend (Render) → Database (Railway PostgreSQL)
  LatticeIQ          ArcMetric
```

### URLs

| Component | URL |
|-----------|-----|
| Frontend | `https://latticeiq-jxzawn8l0-quatrorabes-projects.vercel.app` |
| Backend | `https://arcmetric.onrender.com` |
| API Docs | `https://arcmetric.onrender.com/docs` |

### ⚠️ KNOWN ISSUES

**Frontend stuck on "Loading contacts..."**

Likely causes:
- CORS not configured on backend
- API endpoint path mismatch
- Render service cold start

### Debug Steps

```bash
# Test backend directly
curl https://arcmetric.onrender.com/api/contacts

# Check API docs
curl https://arcmetric.onrender.com/docs

# Wake up Render service (if sleeping)
curl https://arcmetric.onrender.com/health
```

### Fix CORS Issue

If backend shows CORS errors, update `backend/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Then redeploy:
```bash
cd ~/projects/apex-sales-intelligence
git add -A
git commit -m "fix: add CORS middleware"
git push origin main
```

***

## 🔐 ENVIRONMENT VARIABLES REFERENCE

### New System - Backend (Render)

```bash
DATABASE_URL=postgresql://[supabase connection string]
SUPABASE_URL=[from Supabase Dashboard → Settings → API]
SUPABASE_KEY=[service_role key from Supabase]
PORT=10000
```

### New System - Frontend (Vercel)

```bash
VITE_API_URL=https://latticeiq-backend.onrender.com
VITE_SUPABASE_URL=[from Supabase Dashboard]
VITE_SUPABASE_ANON_KEY=[from Supabase Dashboard]
```

### Legacy System - Backend (Render)

```bash
DATABASE_URL=postgresql://[Railway connection string]
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
PORT=10000
```

### Legacy System - Frontend (Vercel)

```bash
VITE_API_URL=https://arcmetric.onrender.com
```

***

## ✅ VERIFICATION & TESTING

### New System Health Checks

**1. Backend Health**
```bash
curl https://latticeiq-backend.onrender.com/health
# Expected: {"status": "ok"}
```

**2. Frontend Login**
- Visit Vercel URL
- Enter valid Supabase email/password
- Should redirect to dashboard

**3. Auth Token Flow**
- Open browser DevTools → Network
- Login
- Check any API request → Headers
- Should see: `Authorization: Bearer eyJ...`

**4. Data Isolation**
- Create contact as User A
- Login as User B
- User B should NOT see User A's contact

### Legacy System Health Checks

**1. Backend Health**
```bash
curl https://arcmetric.onrender.com/api/contacts
# Should return contacts array (or error if DB issue)
```

**2. Frontend Loading**
- Visit Vercel URL
- Open DevTools → Console
- Check for errors (CORS, 404, etc.)

***

## 🔍 TROUBLESHOOTING

### New System Issues

#### "Login failed" or 401 Unauthorized

**Check:**
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel env vars
2. Confirm user exists in Supabase Auth (Dashboard → Authentication → Users)
3. Check browser console for error messages

**Fix:**
- Re-enter env vars in Vercel (Settings → Environment Variables)
- Redeploy frontend

#### "No contacts" but should have data

**Check:**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM contacts WHERE user_id = '[your-user-id]';
```

**Fix:**
- Verify `user_id` is set on contacts
- Check RLS policies are active:
```sql
SELECT * FROM pg_policies WHERE tablename = 'contacts';
```

#### Backend returns 500 errors

**Check Render Logs:**
1. Go to Render Dashboard
2. Select `latticeiq-backend` service
3. Click "Logs"
4. Look for Python errors

**Common fixes:**
- Missing env vars (add in Render → Environment)
- Database connection issue (verify `DATABASE_URL`)

### Legacy System Issues

#### CORS Error in Browser Console

```
Access to fetch at 'https://arcmetric.onrender.com/api/contacts' 
from origin 'https://latticeiq.vercel.app' has been blocked by CORS policy
```

**Fix:** Add CORS middleware (see Legacy System Deployment section)

#### 404 Not Found on `/api/contacts`

**Check:** API might use different path
```bash
curl https://arcmetric.onrender.com/docs
# View all available endpoints
```

**Fix:** Update frontend API URL in `App.tsx`:
```typescript
const API_URL = 'https://arcmetric.onrender.com'
// Change endpoint path if needed
fetch(`${API_URL}/contacts`) // instead of /api/contacts
```

#### Render Service Sleeping (Cold Start)

**Symptom:** First request takes 30+ seconds

**Fix:**
- Upgrade Render plan (paid plans don't sleep)
- Or accept 30s delay on first request

***

## 🏗️ ARCHITECTURE COMPARISON

### Data Flow - New System

```
User enters credentials
    ↓
Supabase Auth validates → Returns JWT token
    ↓
Frontend stores token in memory
    ↓
Frontend sends API request with: Authorization: Bearer <token>
    ↓
Backend validates token with Supabase
    ↓
Backend extracts user_id from token
    ↓
Backend filters query: WHERE user_id = <extracted_id>
    ↓
Database RLS double-checks: auth.uid() = user_id
    ↓
Returns ONLY that user's data
```

### Data Flow - Legacy System

```
User visits site
    ↓
Frontend loads (no auth)
    ↓
Frontend sends API request (no token)
    ↓
Backend returns ALL contacts (no filtering)
    ↓
Database returns all rows (no RLS)
```

### Security Comparison

| Feature | New System | Legacy System |
|---------|-----------|---------------|
| Authentication | ✅ JWT tokens | ❌ None |
| User isolation | ✅ Per-user data | ❌ Shared data |
| Row-Level Security | ✅ Enforced | ❌ Not implemented |
| Password hashing | ✅ Supabase | ❌ N/A |
| Session management | ✅ Auto-refresh | ❌ N/A |
| Multi-tenant ready | ✅ Yes | ❌ No |

***

## 📦 REPOSITORIES

| System | Repo | Default Branch |
|--------|------|---------------|
| New System | `github.com/quatrorabes/latticeiq` | `main` |
| Legacy System | `github.com/quatrorabes/apex-sales-intelligence` | `main` (was `master`) |

***

## 🎯 RECOMMENDED DEPLOYMENT PATH

**For Production Use → Deploy New System**

Reasons:
1. ✅ **95% complete** (just needs frontend deploy)
2. ✅ **Multi-user ready** (can onboard customers immediately)
3. ✅ **Secure** (RLS + JWT auth)
4. ✅ **No known blockers** (backend working, code tested)

**For Testing/Demo → Fix Legacy System**

Only if you need:
- Single-user demo
- No auth requirement
- Quick prototype

***

## 📝 DEPLOYMENT CHECKLIST

### New System Deployment

- [ ] Get Supabase URL and anon key
- [ ] Create new Vercel project
- [ ] Set root directory to `frontend`
- [ ] Add 3 environment variables
- [ ] Deploy and verify login works
- [ ] Test creating a contact
- [ ] Verify data isolation (try second user account)

### Legacy System Fix

- [ ] Add CORS middleware to backend
- [ ] Verify API endpoints in `/docs`
- [ ] Update frontend API paths if needed
- [ ] Redeploy backend to Render
- [ ] Test frontend loads contacts
- [ ] Check browser console for errors

***

## 🆘 QUICK REFERENCE

**Backend Health Check:**
```bash
# New System
curl https://latticeiq-backend.onrender.com/health

# Legacy System
curl https://arcmetric.onrender.com/api/contacts
```

**Redeploy Frontend:**
```bash
cd ~/projects/latticeiq
git add -A
git commit -m "fix: description"
git push origin main  # Auto-deploys to Vercel
```

**Redeploy Backend:**
```bash
cd ~/projects/apex-sales-intelligence  # or latticeiq
git add -A
git commit -m "fix: description"
git push origin main  # Auto-deploys to Render
```

**View Logs:**
- **Render:** Dashboard → Service → Logs tab
- **Vercel:** Dashboard → Deployment → View Function Logs
- **Supabase:** Dashboard → Database → Logs

***

## 📞 SUPPORT RESOURCES

- **Supabase Docs:** https://supabase.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **Render Docs:** https://render.com/docs
- **FastAPI Docs:** https://fastapi.tiangolo.com

***

**END OF DEPLOYMENT GUIDE**  
*Last Updated: December 18, 2025, 12:26 PM PST*

***

✅ **Save this document** and reference it whenever you need to deploy or troubleshoot either system. Ready to proceed with deployment when you are!