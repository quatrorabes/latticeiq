# Quick and Deep Saved Results

Implemented October 14, 2026 against `quatrorabes/latticeiq` main revision `cfe03c66137553d3a6d513b9fb1a0495e165e8aa`. This feature is separate from the previously prepared provider monitoring probe, which is not included in this change.

## User-facing behavior

- **Quick and Deep viewing tabs:** Each shows the latest independent saved result and its own timestamp. Switching views reads existing browser state and does not generate enrichment or trigger scoring.
- **Explicit generation actions:** `Refresh Quick` and `Refresh Deep` refresh their corresponding saved snapshot. Where no snapshot exists, the action is labelled `Run Quick Enrich` or `Deep Enrich`.
- **Missing-result state:** A tab without a retained snapshot says `Not saved` and explains that generating it uses API credits. No background regeneration occurs.
- **Reopening contacts:** A read-only authenticated GET reloads both snapshots, even if the contact list's cached payload is older.
- **Refresh safety:** Quick refresh leaves Deep intact, and Deep refresh leaves Quick intact. Contact list state is updated after enrichment; delayed scoring no longer republishes an older contact payload.
- **Keyboard support:** Arrow keys, Home, and End select the saved-result tabs. Panels have tab/tabpanel semantics, and tabs remain usable on narrow screens.

## Root cause

Both existing enrichment routes replaced `contacts.enrichment_data` with the latest single-mode payload. The deep route merged a few quick fields as fallbacks but did not retain the original Quick result; the modal treated a Quick unified result as the same state used for Deep display ([reviewed repository](https://github.com/quatrorabes/latticeiq)).

## Storage and compatibility

The existing JSONB column now contains a `storage_version: 2` envelope. The top-level `mode`, `data`, legacy fields, and latest-mode raw provider fields remain compatible with existing consumers. A new `saved_results` object preserves one latest snapshot per mode.

```json
{
  "storage_version": 2,
  "mode": "deep",
  "data": {
    "contact_id": "example-contact-id",
    "meta": { "source": "deep" }
  },
  "saved_results": {
    "quick": {
      "mode": "quick",
      "data": {
        "contact_id": "example-contact-id",
        "meta": { "source": "quick" }
      },
      "legacy": { "summary": "Quick summary" },
      "enriched_at": "2026-10-14T19:00:00+00:00"
    },
    "deep": {
      "mode": "deep",
      "data": {
        "contact_id": "example-contact-id",
        "meta": { "source": "deep" }
      },
      "enriched_at": "2026-10-14T19:05:00+00:00"
    }
  }
}
```

This is latest-per-mode retention, not a full historical audit trail. Refreshing Quick replaces the previous Quick snapshot, not Deep; refreshing Deep replaces the previous Deep snapshot, not Quick.

No Supabase migration, new table, new production dependency, or new secret is required. The full provider payload remains in the database for the existing debug surfaces; the new saved-results GET returns display fields without raw provider response bodies.

### Legacy records

Legacy `mode` and unified `meta.source` identify which saved tab owns an existing result. Recognizable summary/opening-line legacy payloads classify as Quick. Unidentified payloads are not silently relabelled Deep.

If Deep already overwrote Quick before this feature, the original Quick cannot be reconstructed from the current column alone. Deep is retained and displayed; Quick remains `Not saved` until the user explicitly generates it. No one-time paid backfill or fabricated result is part of this feature.

Known legacy UTC timestamps without timezone suffixes are interpreted as UTC rather than incorrectly treated as browser-local time.

### Concurrent completion safety

After the provider returns, persistence rereads the current row, merges the corresponding mode, and writes only if the prior JSONB value is unchanged. Atomic PostgREST equality filters provide compare-and-swap behavior; a conflicting writer causes a reread and merge, not another provider call.

Five repeated conflicts return 409 rather than overwrite competing data. This protects writes through the updated Quick/Deep routes. It does not prevent an unrelated legacy client or rollback deployment from replacing the whole column with a single-mode payload.

## API and authorization

`GET /api/v3/enrichment/saved/{contact_id}` returns both display snapshots. It invokes no enrichment provider and performs no contact write.

```json
{
  "contact_id": "example-contact-id",
  "saved_results": {
    "quick": null,
    "deep": {
      "mode": "deep",
      "data": {},
      "legacy": null,
      "enriched_at": "2026-10-14T19:05:00+00:00"
    }
  },
  "unclassified_legacy": false
}
```

The route uses the existing signed-JWT auth dependency and filters by both contact ID and authenticated `user_id`. The touched Quick/Deep read and save paths also filter by owner. Cross-owner records return 404; unauthenticated reads return 401.

This follows the application's existing contact-by-ID owner boundary. Before rollout, verify that the intended contact belongs to the current user; the existing Contacts list can expose a broader MVP list, so shared contacts not owned by that user are intentionally not made accessible by this feature. Workspace-wide sharing, if needed, requires an explicit authorization design rather than removing owner checks.

The existing Deep `/result` endpoint selects the retained Deep snapshot even when Quick is the latest top-level payload. Existing debug endpoints can select their corresponding saved snapshots.

## Complete changed files

| File | Purpose |
|---|---|
| `backend/app/enrichment_v3/saved_results.py` | Legacy normalization, snapshot merge, atomic persistence |
| `backend/app/enrichment_v3/saved_results_router.py` | Authenticated read-only saved-results route |
| `backend/app/enrichment_v3/enrich_simple.py` | Quick persistence and retained Quick debug |
| `backend/app/routers/enrichment_v3_deep.py` | Deep persistence and retained Deep reads/debug |
| `backend/app/main.py` | Registers the saved-results GET |
| `backend/tests/test_saved_enrichment.py` | Backend, route, concurrency, and SDK-contract tests |
| `frontend/src/lib/savedEnrichment.ts` | Legacy normalization and snapshot timestamps |
| `frontend/src/components/SavedEnrichmentTabs.tsx` | Accessible saved-result selector |
| `frontend/src/components/ContactDetailModal.tsx` | Independent displays, saved GETs, refresh handling |
| `frontend/src/pages/ContactsPage.tsx` | Keeps list/selected-contact state current |
| `frontend/package.json` | Adds the saved-results test command |
| `frontend/tests/saved-enrichment.test.mjs` | Normalization and timestamp tests |
| `frontend/tests/saved-enrichment.qa.html` | Isolated real-modal browser fixture |
| `frontend/tests/saved-enrichment.qa.tsx` | Synthetic contact states for browser QA |
| `frontend/tests/saved-enrichment.vite.config.ts` | Test-only auth fixture configuration |
| `docs/SAVED_ENRICHMENT_RESULTS.md` | This implementation/rollout guide |

The delivered source archive contains complete versions of these files, not fragments. Do not overwrite a newer `main.py` with the supplied snapshot if the repository advances; merge the branch normally.

## Verification completed

- **Backend:** 23 tests passed under Python 3.11 with the repository's production dependencies and pytest 7.4.3.
- **Frontend normalization:** Six Node tests passed.
- **Build:** TypeScript compilation and the Vite production build passed.
- **Syntax/diff:** Changed Python modules compiled and `git diff --check` passed.
- **Real-modal browser QA:** Verified Quick/Deep switching, zero POST requests while viewing, keyboard switching, refreshing each mode while retaining the other, delayed scoring preservation, close/reopen, contact changes, and legacy Deep-only records.
- **Visual QA:** Inspected desktop and 390-pixel mobile screenshots; saved tabs and action controls fit without page-level horizontal overflow.

Browser QA used the actual modified modal with synthetic contacts and intercepted network responses. No production enrichment, customer record write, or billable provider call was made during verification. These checks are not a live Supabase persistence test or production deployment signoff.

The backend test suite includes requests made through the actual installed PostgREST SDK with mocked HTTP transport, checking JSONB equality/null guards and `return=representation`.

Existing framework deprecation warnings and the large frontend bundle warning remain; this feature does not refactor those unrelated areas.

## Reproduce tests

From the repository root:

```bash
python3.11 -m venv .venv-saved-results
.venv-saved-results/bin/python -m pip install -r backend/requirements.txt pytest==7.4.3
PYTHONPATH=backend .venv-saved-results/bin/python -m pytest \
  -q backend/tests/test_saved_enrichment.py
npm ci --prefix frontend
npm run test:saved-enrichment --prefix frontend
npm run build --prefix frontend
git diff --check
```

For read-only visual fixture inspection:

```bash
cd frontend
npx vite --config tests/saved-enrichment.vite.config.ts
```

Open `http://127.0.0.1:4177/tests/saved-enrichment.qa.html`. Query variants include `?mode=quick`, `?mode=deep`, `?mode=legacy-deep`, `?mode=unknown`, and `?mode=empty`. The mock-auth configuration is ONLY for this synthetic QA fixture, never production.

The fixture alone displays local synthetic snapshots; complete refresh QA also requires intercepting `/mock/api/v3/*` requests with controlled mock responses, as done during implementation. Do not interpret the standalone fixture as a working enrichment backend.

## Rollout

1. Review and merge the feature branch only after deployment approval. Main-branch updates trigger Render auto-deployment for the live backend, so merging is a production action ([configured repository](https://github.com/quatrorabes/latticeiq)).
2. Verify backend readiness: saved-results GET should be registered in `/api/openapi.json`; confirm a signed, owner-authorized request returns the existing result without running enrichment.
3. Confirm the frontend deployment includes the saved tabs. If backend and frontend auto-deploy simultaneously, wait for both to finish before smoke testing; the new frontend requires the saved-results GET after generation.
4. Use one owned contact with a retained legacy Deep result. Confirm Deep appears and Quick says `Not saved`, without automatically generating it.
5. Explicitly run Quick once if a new Quick snapshot is desired, then switch between both saved modes.
6. Reopen or reload the contact and confirm both persist.
7. Refresh each mode only if requested; confirm the other snapshot remains unchanged and no requests fire solely from switching tabs.

Do not add funds, rotate provider keys, or change provider routing for this feature; the quota issue was resolved separately.

## Rollback

Revert the feature commit through the normal release process. No migration rollback is needed. Existing version-2 payloads retain compatible top-level fields, so an older UI can still display the latest top-level result.

However, an older backend's subsequent enrichment can replace the column and discard saved snapshots. Preserve a backup before any rollback involving further enrichment. The provider monitoring package remains separate and is not deployed by this branch.
