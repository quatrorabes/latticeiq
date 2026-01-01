# ⚡ LatticeIQ Quick Start - Dec 27, 2025

**Goal:** Verify modal opens and enrich button works end-to-end  
**Time:** 20 minutes  
**Status:** Modal & API implemented, waiting for user verification

---

## 🚀 One-Minute Setup

```bash
cd frontend

# Verify these three files are in place:
# ✅ src/App.tsx
# ✅ src/pages/ContactsPage.tsx  
# ✅ src/components/ContactDetailModal.tsx

git add src/App.tsx src/pages/ContactsPage.tsx src/components/ContactDetailModal.tsx
git commit -m "modal and enrich: complete implementation"
git push origin main

# Vercel auto-deploys in 2-3 minutes
```

---

## 🧪 Testing Checklist (5 min)

### 1. Hard Refresh App (1 min)
```
Browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
URL: https://latticeiq.vercel.app/contacts
Expected: Contacts page loads, table visible, contacts listed
```

✅ **Pass** / ❌ **Fail**

---

### 2. Modal Opens (2 min)
```
Action: Click ANY contact row in the table
Expected: 
  - Dark background appears
  - White card pops up in center
  - Card shows contact name at top
  - Card shows email, company, job title
  - Card shows 3 score boxes (MDCP, BANT, SPICE)
  - Card shows "Close" button (lower left)
  - Card shows "Re-Enrich" button (lower right)

If modal doesn't appear:
  1. DevTools (F12) → Console tab
  2. Look for red error messages
  3. Take screenshot and share
```

✅ **Modal opens** / ❌ **Modal doesn't open**

---

### 3. Close Modal (30 sec)
```
Action: Click "Close" button OR click dark background
Expected: Modal disappears, table visible again
```

✅ **Close works** / ❌ **Close doesn't work**

---

### 4. Enrich Button Works (10 min)
```
Action: Click contact row again to open modal
Action: Click "Re-Enrich" button (blue, bottom right)

Expected sequence:
  ⏱️ 0-1 sec: Button text changes to "⏳ Enriching..."
              Button becomes disabled (grayed out)
              
  ⏱️ 1-30 sec: Wait... enrichment is happening
              Open DevTools (F12) → Network tab
              You should see: POST request to 
              /api/v3/enrich/{contact_id}
              (Status should be 200 after 15-30 seconds)
              
  ⏱️ 30+ sec: Modal updates with new content!
             Look for sections:
             - "Summary" paragraph
             - "Company Overview" 
             - "Talking Points" (bulleted list)
             - "Recommended Approach"
             - "Persona Type"
             - "Vertical"
             
             Button re-enables, text back to "Re-Enrich"

If enrichment hangs:
  1. Wait full 60 seconds (enrichment can be slow)
  2. Check Network tab response for errors
  3. Check Render backend logs if still no response
```

✅ **Enrichment completes + data shows** / ❌ **Enrichment fails or hangs**

---

### 5. Enrichment Status States (2 min)
```
Click different contacts and check their states:

Pending Contact:
  Modal shows: "No enrichment data yet. Click the 
              'Re-Enrich' button below to start..."
  Button: Ready to click
  
Completed Contact:
  Modal shows: Full "Sales Intelligence" section
              with all enriched data
  Button: "Re-Enrich" available to re-run
  
Processing Contact (if any):
  Modal shows: "⏳ Enrichment in progress... 
              (this may take 15-30 seconds)"
  Button: Disabled
```

✅ **All states display correctly** / ⚠️ **Some states missing**

---

## 📊 Network Tab Debugging

When clicking "Re-Enrich", look for this request:

```
METHOD: POST
URL: https://latticeiq-backend.onrender.com/api/v3/enrich/{contact_id}

Headers (Request):
  Authorization: Bearer eyJ0eXAi... (your JWT token)
  Content-Type: application/json

Response (200 OK):
  {
    "success": true,
    "status": "completed",
    "enrichment_data": {
      "summary": "...",
      "company_overview": "...",
      "talking_points": [...],
      "recommended_approach": "...",
      "persona_type": "...",
      "vertical": "..."
    }
  }
```

**If you see 404:** Endpoint doesn't exist (backend not deployed)
**If you see 401:** JWT token invalid (authentication issue)
**If you see 500:** Server error (check Render logs)
**If request never appears:** Frontend not calling API (code issue)

---

## 🎯 Success Criteria

**All green = Ready for next features** ✅

- [ ] Modal opens on contact click
- [ ] Modal closes on button/backdrop click
- [ ] Re-Enrich button initiates enrichment
- [ ] Network shows POST to `/api/v3/enrich/{id}`
- [ ] Enrichment completes in 15-30 seconds
- [ ] Modal updates with enrichment data
- [ ] All sections visible (summary, talking points, etc.)
- [ ] Status states display correctly (pending, processing, completed)

---

## 🚨 If Something Fails

### Modal doesn't open
```
DevTools → Console
- Any errors? Copy/paste them
- Check: is ContactDetailModal imported in ContactsPage.tsx?
- Check: is ContactDetailModal component rendering?
```

### Enrich button does nothing
```
DevTools → Console
- Should see: "Calling: POST {URL}/api/v3/enrich/{id}"
- If not: Frontend not calling API
- Check ContactDetailModal.tsx handleEnrich function
```

### Enrichment hangs/times out
```
DevTools → Network tab
- Is POST request being made?
- If yes: Check response status & body
- If no: Frontend not sending request

Render backend logs:
- Dashboard: https://dashboard.render.com
- Select latticeiq-backend service
- Look for enrichment logs
```

### Modal shows no enrichment data after completion
```
DevTools → Console
- Should see: "Enrichment response: {data}"
- Check response has enrichment_data field
- Check modal is checking for enrichment_status === 'completed'
```

---

## 📚 Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v3/contacts` | List all contacts |
| POST | `/api/v3/contacts` | Create contact |
| GET | `/api/v3/contacts/{id}` | Get single contact |
| PUT | `/api/v3/contacts/{id}` | Update contact |
| DELETE | `/api/v3/contacts/{id}` | Delete contact |
| **POST** | **`/api/v3/enrich/{id}`** | **ENRICH CONTACT** ⭐ |

---

## 🔗 Important Links

| Resource | URL |
|----------|-----|
| **Frontend** | https://latticeiq.vercel.app/contacts |
| **Backend Health** | https://latticeiq-backend.onrender.com/health |
| **Vercel Logs** | https://vercel.com/latticeiq |
| **Render Logs** | https://dashboard.render.com |
| **Supabase DB** | https://app.supabase.com |

---

## 💡 Tips

1. **Hard refresh often** - Browser may cache old JS
2. **Open DevTools early** - Easier to debug as things happen
3. **Filter Network tab** - Use "Fetch/XHR" filter for API calls only
4. **Check timestamps** - Supabase DB updates may lag by 1-2 seconds
5. **Don't close modal during enrichment** - Wait for completion
6. **First enrichment is slow** - Perplexity may take 20-30 seconds first time

---

## 📝 Reporting Issues

If something doesn't work, save this info:

```
❌ ISSUE: [What failed]

Expected: [What should happen]
Actual: [What actually happened]

Screenshots: [DevTools error, Network response, etc.]

Browser: [Chrome/Firefox/Safari] Version [##]
OS: [Mac/Windows/Linux]

Steps to reproduce:
1. ...
2. ...
3. ...
```

---

**Status:** Ready for testing  
**Deployed:** Vercel auto-deploys from main branch  
**Next Step:** Run checklist above and report results