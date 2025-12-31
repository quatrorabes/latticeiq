#!/bin/bash

# LatticeIQ Thread Handoff
**Last Updated:** Dec 23, 2025 4:33 PM PST

## CURRENT STATE (Copy this to start new threads)
- Frontend: https://latticeiq.vercel.app ✅
- Backend: https://latticeiq-backend.onrender.com ✅
- Database: Supabase PostgreSQL (snake_case schema) ✅

## WHAT'S WORKING
- Contact CRUD (inline in main.py)
- CSV Import
- Supabase Auth/JWT
- Scoring modules (MDCP/BANT/SPICE)

## WHAT'S NOT WORKING / IN PROGRESS
- [ ] Enrichment routers (import path issues)
- [ ] Frontend auth wiring

## KEY FILES
- `backend/app/main.py` - Main API (contacts CRUD inline, NOT a separate router)
- `backend/scoring/` - Scoring calculators
- `frontend/src/pages/ContactsPage.tsx` - Main UI

## GOTCHAS (Things that broke before)
1. `contacts_router` - doesn't exist, contacts are inline in main.py
2. Import paths - use relative imports locally, `app.xxx` on Render
3. Field names - database uses snake_case (user_id, first_name, etc.)
4. JWT secret - must use SUPABASE_JWT_SECRET, not generic JWT_SECRET

## LAST SESSION SUMMARY
- Fixed contacts_router NameError (line 370)
- Confirmed schema is snake_case
- Deployed to Render
