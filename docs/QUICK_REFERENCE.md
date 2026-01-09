# LatticeIQ Quick Reference - Jan 8, 2026
**For Starting Next Thread** | **Troubleshooting at a Glance**

---

## 🎯 The Four Broken Things (In Priority Order)

### 1️⃣ Deep Enrichment Returns 404 (P0 - BLOCKING)
**Symptom:** Click "Deep Enrich Contact" in modal → 404 error  
**Check First:**
```bash
# Step 1: Render logs
Render Dashboard → Logs → search "enrichment_v3_deep"
Look for: "✅ router registered" or "❌ router failed: [ERROR]"

# Step 2: File exists?
git ls-files | grep enrichment_v3_deep.py

# Step 3: Routes correct?
grep "@router" backend/app/routers/enrichment_v3_deep.py
Should show: @router.post("/deep-enrich/
NOT: @router.post("/api/v3/enrichment/deep-enrich/

# Step 4: Dependencies?
grep -i "httpx\|aiohttp" backend/requirements.txt
```
**If All Good:** The problem is likely a silent import error → check logs for exact message

**Fix:** Add missing dependency OR fix route paths OR fix import error in enrichment_v3_deep.py

---

### 2️⃣ HubSpot Import Button Does Nothing (P0 - HIGH)
**Symptom:** Click "Import" button on ContactsPage → Nothing happens  
**Location:** `frontend/src/pages/ContactsPage.tsx` line ~237  
**Fix:**
```typescript
// Add handler:
const handleHubSpotImport = async () => {
  setLoading(true);
  try {
    const response = await fetch(`${API_URL}/api/v3/integrations/hubspot/import`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) await loadContacts();
  } finally {
    setLoading(false);
  }
};

// Wire to button:
<button onClick={handleHubSpotImport} disabled={loading}>
  Import
</button>
```
**Time:** 15 minutes

---

### 3️⃣ Outreach Tab Shows "Coming Soon" (P0 - MEDIUM)
**Symptom:** Click "Outreach" tab → See placeholder text  
**Location:** `frontend/src/components/ContactDetailModal.tsx` line ~650  
**What's Needed:** Email generator UI + Call script generator UI  
**See:** NEXT_THREAD_ACTIONS.md section "Issue #3" for full code  
**Time:** 60 minutes (frontend + backend)

---

### 4️⃣ Enrich Button (Zap Icon) Doesn't Work (P1 - MEDIUM)
**Symptom:** Click zap icon in ContactsTable → Nothing  
**Location:** `frontend/src/pages/ContactsPage.tsx` line ~289  
**Fix:** Add onClick handler, pass `initialTab="enrichment"` to modal  
**See:** NEXT_THREAD_ACTIONS.md section "Issue #4"  
**Time:** 20 minutes

---

## 📊 System Health Check

```bash
# Frontend working?
curl https://latticeiq.vercel.app | grep "<html" && echo "✅ UP"

# Backend working?
curl https://latticeiq-backend.onrender.com/health | grep "ok" && echo "✅ UP"

# Database working?
curl https://latticeiq-backend.onrender.com/api/v3/contacts | grep "[]" && echo "✅ UP"

# Deep enrichment registered?
curl https://latticeiq-backend.onrender.com/openapi.json | grep "deep-enrich" && echo "✅ REGISTERED" || echo "❌ 404 ISSUE"
```

---

## 🔍 Deep Enrichment 404 - Decision Tree

```
Does Render log show "✗ enrichment_v3_deep router failed"?
├─ YES → Check error message
│   ├─ "No module named X" → Add dependency to requirements.txt
│   ├─ "ImportError" → Fix import in enrichment_v3_deep.py or deep_enrichment.py
│   └─ Other → Google the error
│
└─ NO → Check if "✅ enrichment_v3_deep router imported" exists
    ├─ YES → Problem is route paths inside enrichment_v3_deep.py
    │   └─ Check @router decorators don't have double prefix
    │
    └─ NO → Router not registered at all
        └─ File doesn't exist in Git OR main.py has a bug
```

---

## 📝 Files You'll Need to Review

| Priority | File | What to Check |
|----------|------|---------------|
| 1️⃣ | Render Logs | "enrichment_v3_deep" error message |
| 2️⃣ | `backend/requirements.txt` | Missing httpx, aiohttp, etc. |
| 3️⃣ | `backend/app/routers/enrichment_v3_deep.py` | Route paths (@router decorators) |
| 4️⃣ | `backend/app/enrichment_v3/deep_enrichment.py` | Import errors in this file |
| 5️⃣ | `frontend/src/pages/ContactsPage.tsx` | Missing onClick handlers |
| 6️⃣ | `frontend/src/components/ContactDetailModal.tsx` | Outreach tab implementation |

---

## ⏱️ Estimated Completion Times

| Issue | Diagnosis | Fix | Test | Total |
|-------|-----------|-----|------|-------|
| Deep Enrichment 404 | 15 min | 30 min | 15 min | 1 hour |
| HubSpot Import | 5 min | 15 min | 10 min | 30 min |
| Outreach Tab | 5 min | 50 min | 10 min | 1 hour 5 min |
| Enrich Button | 2 min | 15 min | 3 min | 20 min |
| **TOTAL** | **27 min** | **110 min** | **38 min** | **3 hours 15 min** |

---

## 🚀 Start Next Session Checklist

Before opening thread:
- [ ] Have Render dashboard open
- [ ] Have GitHub repo open to backend/ folder
- [ ] Have requirements.txt visible
- [ ] Have enrichment_v3_deep.py ready to paste
- [ ] Have these 4 files ready: main.py, enrichment_v3_deep.py, deep_enrichment.py, requirements.txt

When thread starts:
1. Copy Render log screenshot showing "enrichment_v3_deep" status
2. Paste requirements.txt
3. Paste first 50 lines of enrichment_v3_deep.py
4. Ask: "What's the exact error message in Render logs?"

---

## 🔴 Red Flags (Stop & Re-Diagnose)

⛔ Going in circles > 20 minutes → Stop, get logs  
⛔ "It should work" without testing → Test first, assume later  
⛔ Making changes without checking Render logs → Check logs first  
⛔ Unclear what the problem is → Ask for error messages  
⛔ Committed code that hasn't been tested → Test before commit  

---

## ✅ Success Criteria for Next Session

After next session, you should have:
- ✅ All 4 issues fixed or clearly documented as "won't fix"
- ✅ All endpoints tested with curl or Postman
- ✅ All UI buttons wired and working
- ✅ Deployed to production (Vercel + Render)
- ✅ Session summary written
- ✅ Next session priorities documented

---

## 📞 Quick Debugging Commands

```bash
# Test deep enrichment endpoint
curl -X POST "https://latticeiq-backend.onrender.com/api/v3/enrichment/deep-enrich/[contact-id]" \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json"
# Should return: { status: "queued", job_id: "...", error: null }

# Check Python import locally
cd backend && python -c "from app.routers.enrichment_v3_deep import router; print('✅ OK')"

# Check route registrations
curl https://latticeiq-backend.onrender.com/openapi.json | jq '.paths | keys | map(select(contains("enrichment")))'

# Check requirements
grep "^httpx\|^aiohttp\|^requests" backend/requirements.txt

# View actual Render logs
# (No CLI - use dashboard only)
```

---

## 💡 Pro Tips

1. **Render logs are your friend** - Always check them first when backend breaks
2. **Test locally before pushing** - Run `python -c "import..."` to verify imports
3. **Use git status** - See what files are new/modified before committing
4. **Document as you go** - Write down what you tried and result
5. **Commit frequently** - One fix per commit with clear message
6. **Deploy immediately after** - Don't stack multiple untested commits

---

## 🎓 Lessons from This Thread

❌ **What Went Wrong:**
- Didn't check Render logs (where the answer was)
- I misread your code instead of verifying it first
- We assumed things instead of testing
- Went in circles instead of stopping to diagnose

✅ **What to Do Better:**
- Always check logs first when something's broken
- Verify files exist before making assumptions
- Test imports locally before pushing
- Stop and ask for help if confused > 20 minutes
- Get the actual error message, not a guess

---

## 📚 Reference Files

All detailed in these files:
- **THREAD_SUMMARY_JAN8.md** - What went wrong this thread
- **NEXT_THREAD_ACTIONS.md** - Exactly what to do to fix everything
- **SYSTEM_STATE_SUMMARY.md** - Architecture overview and what's working
- **QUICK_REFERENCE.md** - This file

**Total Reading Time:** 30 minutes  
**Recommended:** Read NEXT_THREAD_ACTIONS.md first, then SYSTEM_STATE_SUMMARY.md

---

## 🎯 Your Goal for Next Thread

**Primary:** Fix deep enrichment 404 in 1 hour  
**Secondary:** Fix HubSpot import in 30 minutes  
**Tertiary:** Start Outreach tab implementation  
**Stretch:** Complete Outreach + Enrich button  

**Realistic:** 3-4 hours to fix all 4 issues  
**Absolute Minimum:** 2 hours if you focus

---

**Print This.** Use it as your checklist. You got this.

---

**Generated:** January 8, 2026, 12:20 AM PST  
**For:** Next development session  
**Status:** Ready to start fresh