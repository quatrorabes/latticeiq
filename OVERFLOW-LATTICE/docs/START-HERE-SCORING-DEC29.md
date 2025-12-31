# START HERE: Scoring Implementation - Dec 29, 2025
**Session Focus:** Wire scoring calculations to contacts + display scores  
**Estimated Time:** 2-3 hours for full feature  
**Status:** Scoring UI live ✅ | Configs loading ✅ | Calculations TODO

---

## ⚡ Quick Status Check (5 min)

### 1. Verify Frontend is Live
```bash
open https://latticeiq.vercel.app
# Navigate to Scoring Configuration
# Should see: Dashboard, Contacts, Scoring Configuration, Settings tabs
# MDCP/BANT/SPICE tabs should be visible with sliders
```

### 2. Verify Backend is Live
```bash
curl https://latticeiq-backend.onrender.com/health
# Expected: {"status":"ok","timestamp":"...","database":"connected"}

# Test scoring config endpoint
TOKEN="your_supabase_jwt"
curl "https://latticeiq-backend.onrender.com/api/v3/scoring/config/mdcp" \
  -H "Authorization: Bearer $TOKEN"
# Expected: { framework: "MDCP", weights: {...}, thresholds: {...}, config: {...} }
```

### 3. Check for Errors
Open DevTools (F12) → Console tab
- Should be **clean** (no red errors)
- Ignore warnings - they're OK

---

## 🎯 Today's Priority Tasks

### Task 1: Add "Score All Contacts" Button (30 min)
**Where:** `frontend/src/pages/ContactsPage.tsx`  
**What:** Add button that calls backend scoring API for all contacts

```tsx
const handleScoreAllContacts = async () => {
  setIsScoring(true);
  try {
    const response = await fetch(`${API_BASE}/api/v3/scoring/score-all`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ framework: 'mdcp' })
    });
    const result = await response.json();
    console.log(`Scored ${result.scored} contacts`);
    // Refresh table
    fetchContacts();
  } catch (error) {
    console.error('Scoring failed:', error);
  } finally {
    setIsScoring(false);
  }
};

// In JSX:
<button onClick={handleScoreAllContacts} disabled={isScoring}>
  {isScoring ? 'Scoring...' : 'Score All Contacts'}
</button>
```

### Task 2: Add Backend Score-All Endpoint (45 min)
**Where:** `backend/app/scoring/router.py`  
**What:** Implement POST /api/v3/scoring/score-all

```python
@router.post("/score-all")
async def score_all_contacts(
    framework: str = "mdcp",
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Score all contacts for user using specified framework"""
    try:
        # 1. Get user's contacts from DB
        # 2. Get scoring config for framework
        # 3. Calculate scores for each contact
        # 4. Batch update contacts with scores
        # 5. Return results
        
        return {
            "framework": framework,
            "scored": 0,  # TODO: actual count
            "errors": [],
            "message": "Scoring in progress"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Task 3: Add Score Columns to Contact Table (30 min)
**Where:** `frontend/src/pages/ContactsPage.tsx`  
**What:** Display MDCP/BANT/SPICE scores + tier badges in table

New columns:
```tsx
{ header: 'MDCP Score', accessor: 'mdcp_score', cell: ({ row }) => (
  <div className="flex items-center gap-2">
    <span className="font-bold">{row.original.mdcp_score}</span>
    <span className={`px-2 py-1 text-xs rounded ${getTierColor(row.original.mdcp_tier)}`}>
      {row.original.mdcp_tier?.toUpperCase()}
    </span>
  </div>
)},
{ header: 'BANT Score', accessor: 'bant_score', ... },
{ header: 'SPICE Score', accessor: 'spice_score', ... },
```

Tier colors:
```tsx
const getTierColor = (tier) => {
  if (tier === 'hot') return 'bg-red-100 text-red-800';
  if (tier === 'warm') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-800'; // cold
};
```

---

## 🔧 Implementation Roadmap

**Today (Session 1):**
- [ ] Task 1: Score All button working
- [ ] Task 2: Backend endpoint stubbed
- [ ] Task 3: Columns display in table

**Next Session (Session 2):**
- [ ] Implement actual scoring calculation logic
- [ ] Add DB persistence for scores
- [ ] Add score filters to table
- [ ] Implement individual contact scoring

**Future:**
- [ ] Real-time scoring as contacts are enriched
- [ ] Score trending over time
- [ ] Bulk actions (delete low scores, export high scores)
- [ ] Score explanation modal (why score is 75?)

---

## 📋 File Checklist

**Need to edit today:**
- [ ] `frontend/src/pages/ContactsPage.tsx` - Add button + columns
- [ ] `backend/app/scoring/router.py` - Add POST /score-all endpoint
- [ ] `backend/app/scoring/calculators.py` - Stub scoring logic (or leave for later)
- [ ] `frontend/src/api/scoring.ts` - Update client if needed

**Should NOT touch:**
- MDCPConfig, BANTConfig, SPICEConfig (these are fine)
- Backend main.py (already fixed)
- Anything in `/components/ScoringConfig/`

---

## 🚀 Deploy Checklist

### Before pushing frontend:
```bash
cd frontend
npm run build  # Should complete with no errors
```

### Before pushing backend:
```bash
cd backend
python -m pytest app/scoring/test_router.py  # If tests exist
# Or just: python -c "from app.scoring.router import router; print('✅ import OK')"
```

### Deploy steps:
```bash
# Frontend
cd frontend && git add . && git commit -m "feat: add score-all button and score columns" && git push

# Backend
cd backend && git add . && git commit -m "feat: implement score-all endpoint" && git push

# Wait 2-3 min for auto-deploy, then test
```

---

## 🧪 Testing Sequence

### 1. Frontend (UI)
- [ ] Page loads without errors
- [ ] "Score All Contacts" button visible
- [ ] Click button → shows loading state
- [ ] After completion → toast message appears
- [ ] New score columns visible in table

### 2. Backend (API)
- [ ] `GET /api/v3/scoring/config/mdcp` works
- [ ] `POST /api/v3/scoring/score-all` accepts request
- [ ] Returns `{ framework, scored, errors, message }`

### 3. Integration
- [ ] Click Score All → backend receives request
- [ ] Scores update in table (may need refresh)
- [ ] No 500 errors in backend logs

---

## 🐛 Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Button doesn't appear | Check ContactsPage.tsx syntax, rebuild |
| 404 on score-all endpoint | Verify router registered in main.py |
| Scores all 0 | Normal - calculator is stub, just returns placeholder |
| Table doesn't refresh | Add `fetchContacts()` call after scoring completes |
| CORS errors | Check backend CORS config in main.py |

---

## 📊 Data Flow Diagram

```
User clicks "Score All" button
         ↓
Frontend POST /api/v3/scoring/score-all
         ↓
Backend:
  1. Get all contacts for user
  2. Load scoring config from DB
  3. For each contact:
     a. Run calculator (stub)
     b. Get score + tier
  4. Batch update contacts table
         ↓
Returns { scored: N, errors: [] }
         ↓
Frontend updates contact table
         ↓
Display success message
```

---

## 💡 Pro Tips

1. **Use browser DevTools Network tab** - Watch API calls in real-time
2. **Test endpoints with curl** - Faster than clicking UI
3. **Check backend logs on Render** - Scroll to see `print()` statements
4. **Start with stub data** - Don't worry about perfect calculation yet
5. **Keep it simple** - Get core flow working first, optimize later

---

## 📞 Quick Reference

**Frontend:**
- Contacts API: `frontend/src/api/contacts.ts`
- Scoring API: `frontend/src/api/scoring.ts`
- Types: `frontend/src/types/` (create if needed)

**Backend:**
- DB client: `backend/app/db.py`
- Auth: Uses Supabase JWT from Authorization header
- Logging: `logger.info()` and `logger.error()`

**Environment:**
- Frontend runs on: https://latticeiq.vercel.app
- Backend runs on: https://latticeiq-backend.onrender.com
- DB: Supabase (kbcmtbwhycudgeblkhtc.supabase.co)

---

**Ready to start?** Pick Task 1 and go. You've got this! 🚀
