# START HERE - LatticeIQ CRM Settings UI Session

## Quick Status
- ✅ Backend: Production ready, 778 HubSpot contacts imported
- ✅ CRM Router: Live and working (`crm_available: true`)
- 🎯 **Today's Goal**: Build CRM Settings UI (React + API)

## URLs
- Frontend: https://latticeiq.vercel.app
- Backend: https://latticeiq-backend.onrender.com
- Supabase: Check contacts table (778 records)

## The Task: CRM Settings Page
Users should be able to:
1. **Credentials**: Store HubSpot/Salesforce/Pipedrive API keys safely
2. **Filters**: Exclude records based on rules (unqualified, DNC, unsubscribed)
3. **Requirements**: Enforce minimum fields (name + company must exist)
4. **Test Connection**: Verify credentials work
5. **Auto Sync**: Enable periodic imports

## Architecture
- **Frontend**: `/settings/integrations` page (React component)
- **Backend**: `crm/settings_router.py` (already designed, not deployed)
- **Database**: `crm_integrations` table (needs SQL creation)

## Success Criteria
✅ User can save HubSpot credentials
✅ User can set import filters
✅ User can test connection
✅ Credentials stored securely in Supabase
✅ Import respects filters on next sync

## Files to Create/Modify
- Backend: `crm/settings_router.py` (provided in handoff)
- Backend: Update `main.py` to include settings router
- Database: Create `crm_integrations` table (SQL provided)
- Frontend: Create `src/pages/SettingsPage.tsx`
- Frontend: Create `src/components/CRMIntegrationCard.tsx`

## Start With
1. Read: `THREAD-HANDOFF-DEC23-1845.md`
2. Database: Run crm_integrations SQL in Supabase
3. Backend: Add settings_router.py + wire into main.py
4. Frontend: Build settings UI

**Estimated Time**: 2-3 hours
