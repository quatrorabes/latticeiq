# LatticeIQ Next Thread - Action Items
**Start Date:** January 8, 2026+  
**Priority:** P0 - Critical bugs blocking features  
**Estimated Time:** 4-5 hours total  

---

## Issue #1: Deep Enrichment 404 Bug (URGENT)
**Status:** 🔴 Blocking - Users cannot enrich contacts  
**Symptom:** POST `/api/v3/enrichment/deep-enrich/{contact_id}` returns 404  
**Confidence Level:** 60% (need logs to confirm)

### Diagnosis Steps (15 min)
1. **Check Render logs:**
   ```
   Render Dashboard → LatticeIQ Backend → Logs
   Search for: "enrichment_v3_deep"
   ```
   - Look for: `✅ router registered` OR `❌ router failed: [ERROR]`
   - Copy exact error message

2. **Verify file exists:**
   ```bash
   git ls-files | grep enrichment_v3_deep
   ls -la backend/app/routers/enrichment_v3_deep.py
   ```

3. **Check route paths in file:**
   - Should see: `@router.post("/deep-enrich/{contact_id}")`
   - NOT: `@router.post("/api/v3/enrichment/deep-enrich/...")`

4. **Test import locally:**
   ```bash
   cd backend && python -c "from app.routers.enrichment_v3_deep import router; print('OK')"
   ```

### Most Likely Causes
1. **Import fails** (70% probability)
   - Missing dependency (httpx, aiohttp, etc.)
   - File doesn't exist in Git
   - Import error in enrichment_v3_deep.py or deep_enrichment.py
   
2. **Route paths wrong** (20% probability)
   - Routes have double prefix (`/api/v3/enrichment/deep-enrich` instead of `/deep-enrich`)

3. **Other** (10% probability)
   - Render environment variable missing
   - Python version mismatch

### Fix Based on Root Cause
**If import fails:**
- Check requirements.txt for missing dependencies → add them → redeploy
- Check enrichment_v3_deep.py for syntax errors → fix → redeploy
- Check deep_enrichment.py for bad imports → fix → redeploy

**If route paths wrong:**
- Edit enrichment_v3_deep.py routes to remove `/api/v3/enrichment` prefix
- Commit and redeploy

### Verification After Fix
```bash
# Should return { status: "queued", job_id: "...", error: null }
curl -X POST "https://latticeiq-backend.onrender.com/api/v3/enrichment/deep-enrich/[contact-id]" \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json"
```

---

## Issue #2: HubSpot Import Button Not Wired (HIGH)
**Status:** 🟠 Broken - Import button does nothing  
**Location:** `frontend/src/pages/ContactsPage.tsx` line ~237  
**Estimated Time:** 30 min  

### Current Code
```typescript
<button style={styles.btnPrimary}>
  <Upload size={18} />
  Import  // ← No onClick handler
</button>
```

### Fix Steps
1. Check backend endpoint exists:
   ```bash
   grep -r "hubspot/import" backend/app/
   # Should find: POST /api/v3/integrations/hubspot/import
   ```

2. Add handler to ContactsPage.tsx:
   ```typescript
   const handleHubSpotImport = async () => {
     setLoading(true);
     try {
       const response = await fetch(`${API_URL}/api/v3/integrations/hubspot/import`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${token}`,
           'Content-Type': 'application/json'
         }
       });
       if (response.ok) {
         const data = await response.json();
         toast.success(`Imported ${data.imported} contacts`);
         await loadContacts(); // Refresh table
       } else {
         toast.error('Import failed');
       }
     } finally {
       setLoading(false);
     }
   };
   ```

3. Wire to button:
   ```typescript
   <button 
     style={styles.btnPrimary}
     onClick={handleHubSpotImport}
     disabled={loading}
   >
     <Upload size={18} />
     {loading ? 'Importing...' : 'Import'}
   </button>
   ```

4. Test with real HubSpot account

### Backend Checklist
- [ ] HubSpot API key in Render .env
- [ ] Endpoint exists and returns { imported: N, failed: N }
- [ ] No duplicate contacts created
- [ ] Proper error handling for bad credentials

---

## Issue #3: Outreach Tab Empty (HIGH)
**Status:** 🟠 Not Implemented - Shows "Coming soon"  
**Location:** `frontend/src/components/ContactDetailModal.tsx` line ~650  
**Estimated Time:** 60 min  

### What Needs Building
Email generation + Call script generation in modal

### Frontend Code to Add
```typescript
// In ContactDetailModal state section
const [generatedEmails, setGeneratedEmails] = useState<EmailVariant[]>([]);
const [generatedCallScripts, setGeneratedCallScripts] = useState<CallScriptVariant[]>([]);
const [isGeneratingEmails, setIsGeneratingEmails] = useState(false);
const [isGeneratingCallScripts, setIsGeneratingCallScripts] = useState(false);

// Handler for email generation
const handleGenerateEmails = async () => {
  setIsGeneratingEmails(true);
  try {
    const response = await fetch(`${API_URL}/api/v3/outreach/generate-emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contact_id: contact.id,
        enrichment_data: enrichmentData,
        variants: 3
      })
    });
    const data = await response.json();
    setGeneratedEmails(data.variants);
  } finally {
    setIsGeneratingEmails(false);
  }
};

// Handler for call script generation
const handleGenerateCallScripts = async () => {
  setIsGeneratingCallScripts(true);
  try {
    const response = await fetch(`${API_URL}/api/v3/outreach/generate-call-scripts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contact_id: contact.id,
        enrichment_data: enrichmentData,
        variants: 3
      })
    });
    const data = await response.json();
    setGeneratedCallScripts(data.variants);
  } finally {
    setIsGeneratingCallScripts(false);
  }
};

// Render in outreach tab
{activeTab === 'outreach' && (
  <div>
    {/* Email Section */}
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <Mail style={{ width: 20, height: 20, color: '#818cf8' }} />
        <h4 style={styles.cardTitle}>Cold Email Templates</h4>
      </div>
      <button 
        style={generatedEmails.length > 0 ? styles.btnSecondary : styles.btnPrimary}
        onClick={handleGenerateEmails}
        disabled={isGeneratingEmails}
      >
        {isGeneratingEmails ? 'Generating...' : 'Generate Email Variants'}
      </button>
      
      {generatedEmails.map((email, i) => (
        <div key={i} style={{ ...styles.card, marginTop: '1rem' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>Subject:</strong> {email.subject}
          </div>
          <div style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap', marginBottom: '0.5rem' }}>
            {email.body}
          </div>
          <button 
            style={styles.btnSecondary}
            onClick={() => copyToClipboard(email.body, `email-${i}`)}
          >
            Copy Email
          </button>
        </div>
      ))}
    </div>

    {/* Call Script Section */}
    <div style={{ ...styles.card, marginTop: '1rem' }}>
      <div style={styles.cardHeader}>
        <Phone style={{ width: 20, height: 20, color: '#34d399' }} />
        <h4 style={styles.cardTitle}>Call Scripts</h4>
      </div>
      <button 
        style={generatedCallScripts.length > 0 ? styles.btnSecondary : styles.btnPrimary}
        onClick={handleGenerateCallScripts}
        disabled={isGeneratingCallScripts}
      >
        {isGeneratingCallScripts ? 'Generating...' : 'Generate Call Scripts'}
      </button>
      
      {generatedCallScripts.map((script, i) => (
        <div key={i} style={{ ...styles.card, marginTop: '1rem' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>OPENER:</strong>
            <div style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
              {script.opener}
            </div>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>BODY:</strong>
            <div style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
              {script.body}
            </div>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>CLOSER:</strong>
            <div style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
              {script.closer}
            </div>
          </div>
          <button 
            style={styles.btnSecondary}
            onClick={() => copyToClipboard(`${script.opener}\n\n${script.body}\n\n${script.closer}`, `script-${i}`)}
          >
            Copy Script
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

### Backend Requirements
- Need endpoints:
  - `POST /api/v3/outreach/generate-emails`
  - `POST /api/v3/outreach/generate-call-scripts`
- Use enrichment data (contact_profile, company_profile, messaging sections)
- Return { variants: [{ subject, body }, ...] }
- Call OpenAI to generate personalized content

---

## Issue #4: Enrich Button Doesn't Work (MEDIUM)
**Status:** 🟡 Broken - Zap icon does nothing  
**Location:** `frontend/src/pages/ContactsPage.tsx` line ~289  
**Estimated Time:** 20 min  

### Current Code
```typescript
<button style={styles.actionBtn} title="Enrich">
  <Zap size={16} />  // ← No onClick
</button>
```

### Fix
```typescript
const handleEnrichClick = (contact: Contact, e: React.MouseEvent) => {
  e.stopPropagation();
  setSelectedContact(contact);
  setIsModalOpen(true);
  // Note: Need to pass initialTab to modal
};

<button 
  style={styles.actionBtn} 
  title="Enrich"
  onClick={(e) => handleEnrichClick(contact, e)}
>
  <Zap size={16} />
</button>
```

### Also Update Modal Props
```typescript
interface ContactDetailModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (contact: Contact) => void;
  initialTab?: 'overview' | 'enrichment' | 'outreach' | 'scores';  // NEW
}

export default function ContactDetailModal({ 
  contact, 
  isOpen, 
  onClose, 
  onUpdate,
  initialTab = 'overview'  // NEW
}: ContactDetailModalProps) {
  const [activeTab, setActiveTab] = useState(initialTab);  // CHANGED
```

---

## Priority Order

### Session 1 (Next): Fix Critical Issues (2 hours)
1. **Deep Enrichment 404** (30 min diagnosis + 30 min fix)
2. **HubSpot Import** (30 min)
3. **Test everything** (15 min)

### Session 2: Build Features (2-3 hours)
4. **Outreach Email/Call** (60 min)
5. **Enrich Button** (20 min)
6. **Error handling + polish** (30 min)

---

## Testing After Each Fix

### Deep Enrichment Test
```bash
# Test endpoint
curl -X POST "https://latticeiq-backend.onrender.com/api/v3/enrichment/deep-enrich/[contact-id]" \
  -H "Authorization: Bearer [token]"
# Should return: { status: "queued", job_id: "...", error: null }

# Test UI
1. Open ContactsPage
2. Click contact row
3. Modal opens to Overview tab
4. Click "Enrich Contact" button
5. Wait 10-18s
6. Should show enrichment data in modal
```

### HubSpot Import Test
```bash
1. Click "Import" button
2. Button shows "Importing..."
3. After 5-10s, shows "Imported X contacts"
4. ContactsPage table refreshes with new contacts
5. No duplicate contacts created
```

### Outreach Test
```bash
1. Open ContactDetailModal
2. Click "Outreach" tab
3. Click "Generate Email Variants"
4. Wait 3-5s
5. Shows 3 email options with subjects
6. Can copy to clipboard
7. Same for call scripts
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b fix/deep-enrichment-404

# Make fixes
# Test locally

# Commit
git add .
git commit -m "fix: debug and resolve deep enrichment 404 endpoints"

# Push
git push origin fix/deep-enrichment-404

# Create PR
# Get review
# Merge to main

# Vercel auto-deploys
```

---

## Success Criteria

### Definition of Done
- ✅ All 4 P0 issues fixed
- ✅ No console errors
- ✅ All endpoints respond correctly (no 404s)
- ✅ Manual tests pass
- ✅ Deployed to production (Vercel + Render)
- ✅ Session summary written

### Before/After
**Before:**
- ContactDetailModal opens ✅
- Deep enrich returns 404 ❌
- HubSpot import broken ❌
- Outreach empty ❌
- Enrich button broken ❌

**After:**
- ContactDetailModal opens ✅
- Deep enrich works, shows data ✅
- HubSpot import imports contacts ✅
- Outreach shows email + call options ✅
- Enrich button opens modal to enrichment tab ✅

---

## Files to Have Ready

Before starting, gather:
1. Render logs (screenshot of enrichment_v3_deep errors if any)
2. enrichment_v3_deep.py file content
3. deep_enrichment.py first 30 lines
4. requirements.txt
5. HubSpot API key confirmation

---

## Slack for Help If Stuck

If you get stuck on:
- **Import errors**: Paste full traceback + requirements.txt
- **404 endpoints**: Paste actual route decorators from file
- **Frontend state issues**: Paste console errors + component code
- **API response format**: Paste actual JSON responses

---

## Estimated Total Time

- Deep Enrichment 404: 1 hour
- HubSpot Import: 30 min
- Outreach Tab: 1 hour  
- Enrich Button: 20 min
- Testing + Deployment: 30 min
- **Total: 3-4 hours**

---

**Status:** Ready for next session  
**Branch:** Start from `main`  
**Deploy Target:** Production (Vercel + Render)  
**Backup Plan:** If stuck > 30 min on any issue, file new thread with minimal example