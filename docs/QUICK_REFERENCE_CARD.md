# QUICK REFERENCE CARD
**Print this. Keep it handy. Everything you need in 2 pages.**

---

## 🎯 WHAT YOU'RE STARTING WITH

**Status:** MVP Complete ✅  
**Live:** https://latticeiq.vercel.app  
**Backend:** https://latticeiq-backend.onrender.com  

### What Works
- ✅ CSV import (just deployed)
- ✅ Lead scoring (MDCP/BANT/SPICE)
- ✅ Contact management
- ✅ Multi-tenant (RLS)
- ✅ Auth (JWT + Supabase)

### What's Blocked
- 🟡 HubSpot display (workspace issue - 5 min fix)
- 🟡 Scoring router (deferred - Q1 2026)

### What's Missing (Phase 2)
- ⏳ Variables system (templates with {{variable}})
- ⏳ ICP wizard (filter by ideal client)
- ⏳ Campaign builder (target & send)
- ⏳ Denormalized columns (for speed)

---

## 📚 START HERE (Reading Order)

1. **This card** (2 min) ← You are here
2. **CLEAN_SESSION_SUMMARY_JAN1.md** (5 min)
3. **VARIABLES_AND_FIELDS_IMPLEMENTATION_SUMMARY.md** (20 min) ← Phase 2 overview
4. **VARIABLES_AND_FIELDS_VISUAL_SUMMARY.md** (15 min) ← Diagrams
5. **LATTICEIQ_MASTER_CONTEXT_FINAL.md** (30 min) ← Technical deep dive

**Total reading time: ~70 minutes to full understanding**

---

## 🚀 IMMEDIATE TO-DO LIST (Next 48 Hours)

- [ ] Read CLEAN_SESSION_SUMMARY_JAN1.md
- [ ] Review VARIABLES_AND_FIELDS_IMPLEMENTATION_SUMMARY.md
- [ ] Run SQL_MIGRATIONS.md (10 migrations, one-by-one, ~20 min)
- [ ] Test CSV import at https://latticeiq.vercel.app/crm
- [ ] Review backend code at `backend/app/crm/`
- [ ] Sketch Phase 2 implementation plan

**If all done:** You're ready to start Phase 2 development.

---

## 🗂️ IMPORTANT FILES

### Documentation
```
CLEAN_SESSION_SUMMARY_JAN1.md               ← START HERE
VARIABLES_AND_FIELDS_IMPLEMENTATION_SUMMARY.md
VARIABLES_AND_FIELDS_VISUAL_SUMMARY.md
VARIABLES_AND_FIELDS_ARCHITECTURE.md
SQL_MIGRATIONS.md
LATTICEIQ_MASTER_CONTEXT_FINAL.md
```

### Code
```
Frontend:   latticeiq/frontend/src/pages/CRMPage.tsx (CSV import UI)
Backend:    latticeiq/backend/app/crm/ (7 endpoints)
Database:   Supabase (PostgreSQL 15, 446 contacts)
```

---

## 🔑 KEY NUMBERS

**Cost/Month:** $17  
**Contacts:** 446 (HubSpot)  
**Tables:** 20+  
**API Endpoints:** 25+  
**Frameworks:** 3 (MDCP, BANT, SPICE)  
**Deploy Time:** <3 min (Vercel)  

---

## 🎯 NEXT PHASE (Phase 2)

**What:** Build variables & fields system  
**When:** Next 3-5 weeks  
**Files to Create:** 10 SQL migrations + 4 Python classes + 7 React components  
**Outcome:** Campaign builder with {{variable}} personalization  

**First step:** Run SQL migrations (already written, just need to execute)

---

## 💻 LOCAL DEV SETUP (If Needed)

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload

# Frontend
cd ../frontend
npm install
npm run dev
```

**Environment:** See `.env.template` files

---

## 🐛 IF SOMETHING BREAKS

**Contacts not showing?**  
→ Run: `UPDATE contacts SET workspace_id = '11111111-1111-1111-1111-111111111111' WHERE workspace_id IS NULL;`

**Import fails?**  
→ Check backend logs: https://dashboard.render.com

**Frontend stuck?**  
→ Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

**Still stuck?**  
→ Read TROUBLESHOOTING_DEC31.md

---

## 📞 QUICK LINKS

| What | Where |
|------|-------|
| Code | https://github.com/quatrorabes/latticeiq |
| Live App | https://latticeiq.vercel.app |
| Live API | https://latticeiq-backend.onrender.com |
| Dashboard | https://vercel.com/quatrorabes/latticeiq |
| Backend Dashboard | https://dashboard.render.com |
| Database | https://app.supabase.com |

---

## ✅ SUCCESS CRITERIA

**Phase 2 is done when:**
- [x] 10 SQL migrations executed
- [ ] 4 backend classes implemented (FieldAccessor, ICPMatcher, VariableSubstitutor, CampaignBuilder)
- [ ] Denormalized columns populated
- [ ] Campaign UI wizard built
- [ ] {{variable}} substitution working
- [ ] End-to-end test: Create campaign → Generate email → See personalization

**Estimated time:** 3-5 weeks for experienced developer

---

## 🎓 KEY ARCHITECTURE CONCEPTS

**Workspace Isolation:** Every table has workspace_id, filtered by RLS  
**Denormalization:** Fast columns for queries + JSONB for flexibility  
**Templates:** Use {{variable}} for personalization  
**Multi-Framework:** Score with MDCP, BANT, and SPICE simultaneously  
**UUID PKs:** Globally unique, prevents ID guessing, enables distribution  

---

## 🚀 YOU'RE READY TO:

✅ Understand the system  
✅ Run the SQL migrations  
✅ Test the live system  
✅ Start Phase 2 development  
✅ Deploy with confidence  

---

**Print this. Reference it. You got this. 🚀**

---

**Last Updated:** January 1, 2026  
**Status:** ✅ Ready for development  
**Next Phase:** Phase 2 - Variables & Fields System  
