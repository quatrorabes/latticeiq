# LatticeIQ Thread Transfer - Scoring Configuration Implementation
**Date:** December 29, 2025 | **Session:** Scoring Framework Setup  
**Status:** ✅ PRODUCTION READY | **Next:** Save scoring configs to DB + Score all contacts

---

## 🎯 Session Summary

### What We Accomplished
1. ✅ **Fixed frontend build issues** - Resolved WeightSlider component path resolution (inline component fix)
2. ✅ **Activated scoring router** - Fixed import path in `backend/app/main.py` (`app.scoring.router`)
3. ✅ **Added GET config endpoints** - Created `/api/v3/scoring/config/{framework}` endpoints
4. ✅ **Synced data structures** - Aligned backend config response with frontend MDCPConfig/BANTConfig/SPICEConfig expectations
5. ✅ **Deployed both** - Frontend (Vercel) and backend (Render) live and operational

### Current Status
- **Frontend:** ✅ Live at https://latticeiq.vercel.app
- **Backend:** ✅ Live at https://latticeiq-backend.onrender.com
- **Scoring UI:** ✅ Page loads, config tabs (MDCP/BANT/SPICE) functional
- **API Integration:** ✅ GET endpoints returning correct structure

---

## 🏗️ Architecture

### Scoring System Flow
```
Frontend (React)
  ↓ GET /api/v3/scoring/config/{framework}
Backend (FastAPI)
  ↓ Returns: { weights, thresholds, config, ... }
  ├── MDCP: Money-Decision-Contact-Profile
  ├── BANT: Budget-Authority-Need-Timeline
  └── SPICE: Situation-Problem-Implication-Critical Event-Decision
```

### Key Files

**Backend:**
- `backend/app/main.py` - Router registration (FIXED: added `app.scoring.router` import)
- `backend/app/scoring/router.py` - GET endpoints + config data
- `backend/app/scoring/models.py` - Data models
- `backend/app/scoring/calculators.py` - Scoring logic (PLACEHOLDER)

**Frontend:**
- `frontend/src/components/ScoringConfig/MDCPConfig.tsx` - MDCP framework UI
- `frontend/src/components/ScoringConfig/BANTConfig.tsx` - BANT framework UI
- `frontend/src/components/ScoringConfig/SPICEConfig.tsx` - SPICE framework UI
- `frontend/src/components/ScoringConfig/WeightSliderInline.tsx` - Shared slider component
- `frontend/src/api/scoring.ts` - API client (scoring.getScoringConfig, saveScoringConfig)

---

## 🔧 Recent Fixes

### 1. Frontend Build: WeightSlider Module Resolution
**Problem:** TypeScript couldn't find WeightSlider component due to import path issues  
**Solution:** Moved WeightSlider to same folder as config files (`ScoringConfig/WeightSliderInline.tsx`), updated imports to use relative paths

```bash
# Files affected:
- MDCPConfig.tsx: import { WeightSlider } from "./WeightSliderInline"
- BANTConfig.tsx: import { WeightSlider } from "./WeightSliderInline"
- SPICEConfig.tsx: import { WeightSlider } from "./WeightSliderInline"
```

### 2. Backend Router Registration
**Problem:** `from scoring.router` import failing; endpoint returning 404  
**Solution:** Fixed import path to `from app.scoring.router`

```python
# backend/app/main.py - LINE ~30
try:
    from app.scoring.router import router as scoring_router  # ← FIXED PATH
    SCORING_AVAILABLE = True
except ImportError as e:
    scoring_router = None
    SCORING_AVAILABLE = False
```

### 3. Scoring Config Data Structure
**Problem:** Frontend expecting nested object with weights/thresholds/config; backend returning flat structure  
**Solution:** Updated `SCORING_CONFIGS` dict in router.py to match frontend expectations

```python
SCORING_CONFIGS = {
    "mdcp": {
        "framework": "MDCP",
        "weights": { "money": 25, "decisionmaker": 25, ... },
        "thresholds": { "hotMin": 71, "warmMin": 40 },
        "config": { "moneyMinRevenue": 1000000, ... }
    }
}
```

---

## ✅ Testing Checklist

- [ ] Navigate to https://latticeiq.vercel.app/scoring-config
- [ ] All three tabs visible: MDCP, BANT, SPICE
- [ ] Click each tab - configs load without errors
- [ ] Sliders are interactive and update weight values
- [ ] Browser console shows no errors
- [ ] Test API endpoint manually:
  ```bash
  curl "https://latticeiq-backend.onrender.com/api/v3/scoring/config/mdcp" \
    -H "Authorization: Bearer $TOKEN"
  # Should return full config object
  ```

---

## 🚀 Next Steps (Priority Order)

### 1. Save Config Endpoint (Backend) - **30 min**
Add POST endpoint to save user-configured weights/thresholds to Supabase:

```python
@router.post("/config/{framework}")
async def save_scoring_config(framework: str, config: ScoringConfig, user: dict = Depends(get_current_user)):
    # Save to Supabase scoring_configs table
    # Row: user_id, framework, weights, thresholds, config, updated_at
```

**Schema needed:**
```sql
CREATE TABLE scoring_configs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  framework TEXT NOT NULL,
  weights JSONB NOT NULL,
  thresholds JSONB NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(user_id, framework)
);
```

### 2. Score All Contacts Endpoint (Backend) - **1 hour**
Add POST endpoint to score all user's contacts in one operation:

```python
@router.post("/score-all")
async def score_all_contacts(framework: str, user: dict = Depends(get_current_user)):
    # 1. Fetch all contacts for user_id
    # 2. Load scoring config for framework
    # 3. Calculate scores using calculators.py
    # 4. Batch update contacts with new scores
    # 5. Return { scored: N, errors: [] }
```

### 3. Score All Button (Frontend) - **20 min**
Add button to ContactsPage that triggers score-all endpoint:

```tsx
<button onClick={handleScoreAllContacts}>
  Score All Contacts
</button>

// Show progress/loading state
// Update contact table with new scores
```

### 4. Display Scores in Contact Table (Frontend) - **30 min**
Add columns to contacts table:
- MDCP Score + Tier badge (Hot/Warm/Cold)
- BANT Score + Tier badge
- SPICE Score + Tier badge
- Overall Score

### 5. Score Filters (Frontend) - **20 min**
Add filters to contact table:
- Filter by MDCP tier (Hot/Warm/Cold)
- Filter by BANT tier
- Filter by SPICE tier
- Multi-select support

---

## 📊 Data Structure Reference

### Scoring Config (from backend)
```json
{
  "framework": "MDCP",
  "weights": {
    "money": 25,
    "decisionmaker": 25,
    "champion": 25,
    "process": 25
  },
  "thresholds": {
    "hotMin": 71,
    "warmMin": 40
  },
  "config": {
    "moneyMinRevenue": 1000000,
    "moneyMaxRevenue": 100000000,
    "decisionmakerTitles": ["CEO", "VP Sales", "CMO"],
    "championEngagementDays": 30,
    "processDays": 90
  }
}
```

### Contact Score (to save in DB)
```json
{
  "contact_id": "...",
  "mdcp_score": 75,
  "mdcp_tier": "hot",
  "bant_score": 70,
  "bant_tier": "warm",
  "spice_score": 72,
  "spice_tier": "warm",
  "overall_score": 72,
  "last_scored_at": "2025-12-29T23:09:00Z"
}
```

---

## 🔗 Key Endpoints

### GET Endpoints (✅ Working)
- `GET /api/v3/scoring/config` - Get all framework configs
- `GET /api/v3/scoring/config/{framework}` - Get specific framework config (mdcp/bant/spice)
- `GET /api/v3/scoring/health` - Health check

### POST Endpoints (🚧 TODO)
- `POST /api/v3/scoring/config/{framework}` - Save custom config (NOT YET IMPLEMENTED)
- `POST /api/v3/scoring/mdcp` - Calculate single MDCP score (skeleton)
- `POST /api/v3/scoring/bant` - Calculate single BANT score (skeleton)
- `POST /api/v3/scoring/spice` - Calculate single SPICE score (skeleton)
- `POST /api/v3/scoring/score-all` - Score all contacts (NOT YET IMPLEMENTED)

---

## 📝 Deploy Commands

### Frontend
```bash
cd frontend
npm run build  # Verify build succeeds
git add .
git commit -m "feat: scoring configuration UI implementation"
git push origin main
# Vercel auto-deploys in 1-2 min
```

### Backend
```bash
cd backend
git add .
git commit -m "feat: scoring config endpoints with proper data structure"
git push origin main
# Render redeploys in 2-3 min
```

---

## 🐛 Known Issues

| Issue | Status | Workaround |
|-------|--------|-----------|
| Scoring calculation endpoints are stubs | 🚧 TODO | Use static test values for now |
| No DB persistence for custom configs | 🚧 TODO | Configs reset on page reload |
| Contact table doesn't show scores | 🚧 TODO | Need to add score columns + backend integration |
| No "Score All" button on contacts page | 🚧 TODO | Coming next session |

---

## 📚 Documentation

- `ARCHITECTURE-REFRESH-DEC26.md` - System design overview
- `FRONTEND-WALKTHROUGH.md` - React app structure
- Frontend API client: `frontend/src/api/scoring.ts`
- Backend models: `backend/app/scoring/models.py`
- Calculators: `backend/app/scoring/calculators.py` (mostly empty, needs implementation)

---

## 🎓 Context for Next Session

When starting new session:
1. Scoring UI is live and loading configs successfully
2. Next focus: Wire scoring calculation to actual contact data
3. Database: Need to add scoring columns to contacts table
4. Frontend: Need to add "Score All" button + display scores
5. Backend: Need to implement actual scoring algorithm (currently placeholder)

### Quick Verification
```bash
# Test backend is live
curl https://latticeiq-backend.onrender.com/health

# Test scoring endpoint
TOKEN="your_token"
curl "https://latticeiq-backend.onrender.com/api/v3/scoring/config/mdcp" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔐 Auth & Tokens

- Supabase JWT tokens needed for all scoring endpoints
- Get token from browser: `localStorage.getItem('sb-{PROJECT_ID}-auth-token')`
- Token valid for ~1 hour, auto-refreshes on page load
- Add to requests: `Authorization: Bearer {TOKEN}`

---

**Ready for next session. All systems operational.** ✅
