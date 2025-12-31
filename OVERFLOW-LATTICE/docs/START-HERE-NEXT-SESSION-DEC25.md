# ⚡ QUICK START — Next Session (25 minutes total)

## The Two Things Blocking You

### BLOCKER #1: Node.js (LOCAL DEV)
**Problem:** `npm run dev` crashes → `crypto.hash is not a function`  
**Cause:** You have Node 18, need Node 20.19+ (Vite 7 requirement)  
**Fix (2 minutes):**
```bash
# Check current version
node -v

# If v18.x, upgrade to v22
brew install node@22
brew link --overwrite --force node@22
exec zsh
node -v  # verify: should be v22.x

# Now install dependencies
cd ~/projects/latticeiq/frontend
rm -rf node_modules package-lock.json
npm install
npm run dev  # DONE ✅
```

---

### BLOCKER #2: Render Pipeline Minutes (CI/CD)
**Problem:** Render backend service is blocked, can't deploy  
**Cause:** Monorepo issue — frontend commits trigger backend builds  
**Fix (2 minutes, after pipeline minutes reset):**

1. **Go to:** https://dashboard.render.com
2. **Select:** latticeiq-backend service
3. **Navigate to:** Settings → Build & Deploy
4. **Edit 3 fields:**
   - Root Directory: change `[empty]` → `backend`
   - Build Command: change `cd backend && pip install -r requirements.txt` → `pip install -r requirements.txt`
   - Start Command: change `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT` → `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. **Click:** Save Changes

**Result:** Frontend commits no longer waste backend pipeline minutes ✅

---

## What's Ready to Test (After Fixes Above)

### Test 1: Frontend Works (2 minutes)
```bash
cd ~/projects/latticeiq/frontend
npm run dev
# Open: http://localhost:5173
# Login with any Supabase user
# Navigate to Settings tab
```

### Test 2: Settings Page Works (3 minutes)
```
1. Click Settings tab
2. Select "HubSpot" from dropdown
3. Paste any API key (doesn't have to be real for now)
4. Click "Save" button
→ Should show: "HubSpot saved!"
```

### Test 3: Import Trigger Works (3 minutes)
```
1. In Settings, under "Saved Integrations", find HubSpot
2. Click "Import" button
3. Check browser console for successful POST to /api/v3/crm/import/hubspot
→ Should show: "Import job started! Job ID: [uuid]"
```

### Test 4: Verify Backend Stability (1 minute)
```
1. Open: https://latticeiq-backend.onrender.com
2. Should see JSON response with version info
→ Status: 🟢 Backend is live
```

---

## Files You'll Touch

| File | Action | Why |
|------|--------|-----|
| `frontend/.nvmrc` | Create with content: `22` | Lock Node version |
| Render Dashboard Settings | Edit Root Directory field | Stop wasting pipeline minutes |
| `frontend/src/pages/SettingsPage.tsx` | Read only (already fixed) | Verify import flow is correct |

---

## Success Checklist

After both fixes, you should be able to:

- [ ] `npm run dev` starts without error
- [ ] Settings page loads
- [ ] Can save HubSpot integration
- [ ] Can click Import button
- [ ] Job ID appears in response
- [ ] Backend API endpoint responds at https://latticeiq-backend.onrender.com
- [ ] Frontend commits don't appear in Render backend events

---

## Git Commits to Make

```bash
# 1. Lock Node version
echo "22" > frontend/.nvmrc
git add frontend/.nvmrc
git commit -m "Chore: pin Node 22 for frontend compatibility"
git push origin main

# That's it — Render fix is UI-only, no commit needed
```

---

## If Something Goes Wrong

| Error | Solution |
|-------|----------|
| Still getting `crypto.hash` error | Verify `node -v` shows v22.x, restart terminal with `exec zsh` |
| npm install takes forever | Normal for first install, just wait |
| Settings page won't save | Check VITE_API_URL env var, make sure backend is running |
| Import button returns 400 | Verify Bearer token in DevTools → Network tab |
| Render build still blocked | Wait for pipeline minutes reset (check your Render billing) |

---

## That's It!

**Two 2-minute fixes unlock everything.**

Next session is 25 minutes of actual work to get from "nothing works locally" to "full end-to-end import flow working."

🚀
