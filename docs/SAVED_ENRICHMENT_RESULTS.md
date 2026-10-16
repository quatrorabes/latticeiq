# Quick and Deep Saved Results

Implemented October 14, 2026 against `quatrorabes/latticeiq` main revision `cfe03c66137553d3a6d513b9fb1a0495e165e8aa`. This feature is separate from the previously prepared provider monitoring probe, which is not included in this change.

## Production status

The current production release is [PR #4](https://github.com/quatrorabes/latticeiq/pull/4), merge commit `30a320da0f1746e75440550206a7888f3160a501`, merged October 15, 2026 at 19:30:53 PDT (October 16 at 02:30:53 UTC). The [Render backend deployment](https://dashboard.render.com/web/srv-d51o44mmcj7s73egfv5g/deploys/dep-db8oonnavr4c739hnqh0) became live at 02:32:12 UTC and the [Vercel frontend deployment](https://vercel.com/quatrorabes-projects/latticeiq/7JaE17FT8nQvnTATh2fBt5NDGDz1) succeeded at 02:31:19 UTC. Backend health returned HTTP 200 after deployment.

One authorized paid Deep request for the approved test contact returned HTTP 502 at approximately 19:32 PDT, before persistence, because the provider returned malformed JSON. Deep is not yet verified working end to end. The structured-output follow-up described below is prepared for review, not deployed.

Closing and reopening that contact issued a successful read-only saved-results GET. The saved Quick result's canonical SHA-256 matched the pre-test baseline (4,360 UTF-8 bytes). Deep remains absent. Exactly one Deep POST and zero Quick POSTs occurred; there was no automatic or manual paid retry. This fingerprint covers the saved GET's display snapshot, not the database's raw provider response. Customer identifiers and the response contents are intentionally omitted from this public guide.

### Earlier rollout history

The implementation was merged in [pull request #2](https://github.com/quatrorabes/latticeiq/pull/2) on October 14, 2026 at 19:36 UTC, commit `9bcdae69df06e7b7c4c8034cdbdab6bf8a4bcf07`. The Vercel frontend deployed successfully; the first Render backend rollout failed during startup and left the previous healthy backend running ([Render service](https://dashboard.render.com/web/srv-d51o44mmcj7s73egfv5g)).

The failed rollout reported `ModuleNotFoundError: No module named 'psycopg'` while importing `app.database` through the newly registered saved-results router. Production requirements included `psycopg2-binary`, but not the separate Psycopg 3 driver requested by the production startup path. [PR #3](https://github.com/quatrorabes/latticeiq/pull/3) added `psycopg[binary]==3.3.6` and startup tests; both production services subsequently deployed successfully on October 14.

### October 15 save-path regression

Production Deep attempts failed after provider completion while executing the persistence PATCH, not while parsing provider output. PostgREST wrapped a non-JSON HTTP 400 response (`Bad Request`) as `JSON could not be generated` ([Render service logs](https://dashboard.render.com/web/srv-d51o44mmcj7s73egfv5g/logs)). The earlier full-JSONB equality filter put the entire previous enrichment in the request URL. This creates oversized requests as real provider payloads grow, a case the initial small mocked payloads did not cover.

The follow-up changes only the shared persistence helper, regression tests, and documentation. A 32-character UUID `storage_revision` in the existing JSONB envelope replaces the full-payload URL filter. The full JSON remains in the PATCH body; no table, column, migration, API key, or new dependency is required. Legacy envelopes acquire a revision on their next explicit save. Their first save compares a missing revision plus the existing `enriched_at` column, protecting against an older writer finishing during rollout.

Before applying the fix, the actual installed PostgREST SDK reproduced the screenshot's exact error against a simulated gateway rejecting request URIs larger than 8 KiB. Larger payloads also exceeded HTTPX's query length limit. The gateway threshold is a regression fixture, not a measured production limit. The updated helper keeps all tested PATCH URLs below 512 bytes, including roughly 230 KiB envelopes, with Quick and Deep preserved in either order and concurrent completion retries retained.

This compact-filter fix was merged and deployed in PR #4. The authorized live test did not reach persistence because it exposed a separate provider-output error. Its bounded URL and snapshot-retention regressions pass offline, but production dual-mode persistence must not be claimed verified from that failed test.

### Deep structured-output follow-up

The paid test's provider content contained an unkeyed object in the middle of `company_profile`, equivalent to this anonymized example:

```text
{"company_profile":{"one_liner":"Example","industry":"Banking"},{"size_segment":"51-200"}}
```

This is a JSON syntax defect, not a funding, authentication, or database error. The old Deep request relied only on the prompt for formatting and attempted to repair truncated JSON. It did not request provider-enforced structured output. The malformed middle object cannot safely be reconstructed, and the full failed response was not saved.

The prepared follow-up adds Sonar's `response_format` with a named `json_schema` while retaining the existing `sonar-pro` model, `/chat/completions` endpoint, credentials, temperature, and token cap. Perplexity documents JSON structured outputs across all models in its [official changelog](https://docs.perplexity.ai/docs/resources/changelog), and the [Sonar request schema](https://docs.perplexity.ai/openapi.json) specifies the `response_format.json_schema.schema` contract. No Agent API migration, new provider, new billing account, dependency, or database migration is included.

- **Schema contract:** All six boxes and their fields are required. Unknown scalar values can be null; unsupported lists can be empty. Every object rejects extra properties, bullet items require string `text`, and local schema references are inlined before the request.
- **Completion validation:** A successful response must have `finish_reason: stop`, valid JSON, and the required strict shape. Truncation, malformed envelopes, duplicate keys, nonstandard numeric constants, fenced/prose output, and wrong field types are rejected before any snapshot write. The application no longer guesses missing braces or repairs provider content.
- **Credit protection:** There is exactly one outgoing provider request per explicit Deep action. Neither parsing, transport failures, nor database conflict retries cause another generation.
- **Saved-result protection:** Existing Quick and Deep snapshots remain unchanged on provider failure. Status-only processing/failure updates are owner-filtered. Failure cleanup changes `processing` to `failed` without downgrading a concurrently completed result; cleanup is best effort if the database is unavailable.
- **Privacy and identity:** This route no longer dumps full contact rows or malformed provider bodies into logs. Research uses canonical `first_name` and `last_name`, with the previous spellings retained as fallbacks.
- **Verification:** All 95 targeted backend checks pass on Python 3.11.15 and Python 3.13.12. These include actual HTTPX and installed PostgREST SDK calls through mocked transports, covering parsing, transformation, large snapshot persistence, readback, preserved Quick, conflicts, owner boundaries, timeouts, and cleanup failures. No additional live provider request was used.
- **Frontend compatibility:** The six saved-result normalization tests and TypeScript/Vite production build also pass. No frontend source change is included in this follow-up; the existing bundle-size and stale Browserslist warnings remain non-blocking.

The provider can still time out, reject a request, or reach its token limit; schema enforcement does not prove factual research accuracy or remove upstream failures. A new schema can also incur an initial preparation delay, as noted in [Perplexity output-control documentation](https://docs.perplexity.ai/docs/agent-api/output-control). The existing 120-second HTTP timeout is retained and no silent paid retry is introduced.

Deployment and one additional paid Deep test require fresh approval for this follow-up. After it is live, fingerprint Quick, run Deep once, verify both saved modes survive reopening, and confirm switching tabs produces no generation requests. Stop after a failed paid attempt rather than retrying automatically.

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
  "storage_revision": "22be5131061e40b4b7fc638eb12e1454",
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

No Supabase migration, new table, or new secret is required. The rollout follow-up adds the missing Psycopg 3 production dependency; the feature itself uses existing infrastructure. The full provider payload remains in the database for the existing debug surfaces; the new saved-results GET returns display fields without raw provider response bodies.

### Legacy records

Legacy `mode` and unified `meta.source` identify which saved tab owns an existing result. Recognizable summary/opening-line legacy payloads classify as Quick. Unidentified payloads are not silently relabelled Deep.

If Deep already overwrote Quick before this feature, the original Quick cannot be reconstructed from the current column alone. Deep is retained and displayed; Quick remains `Not saved` until the user explicitly generates it. No one-time paid backfill or fabricated result is part of this feature.

Known legacy UTC timestamps without timezone suffixes are interpreted as UTC rather than incorrectly treated as browser-local time.

### Concurrent completion safety

After the provider returns, persistence rereads the current row, merges the corresponding mode, and writes only if the prior `storage_revision` matches. Each successful replacement writes a new UUID revision. Empty fields use a null-field guard; existing legacy fields without a revision compare a missing revision and the prior `enriched_at` column. Atomic PostgREST filters provide compare-and-swap behavior; a conflicting writer causes a reread and merge, not another provider call.

The guard no longer includes the entire JSONB in a URL parameter. Revision metadata stays at the envelope root and is not copied into individual Quick/Deep snapshots. Malformed or oversized revision values return 409 without creating an unbounded filter or overwriting data.

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
| `backend/app/enrichment_v3/deep_provider.py` | Strict Deep request schema and completed-response validation |
| `backend/app/enrichment_v3/enrich_simple.py` | Quick persistence and retained Quick debug |
| `backend/app/routers/enrichment_v3_deep.py` | Deep persistence and retained Deep reads/debug |
| `backend/app/main.py` | Registers the saved-results GET |
| `backend/tests/test_saved_enrichment.py` | Backend, route, concurrency, and SDK-contract tests |
| `backend/tests/test_deep_provider.py` | Provider HTTP, strict parsing, route, and large-save integration regressions |
| `backend/tests/test_database_startup.py` | Full-app startup and authorization under both PostgreSQL drivers |
| `backend/requirements.txt` | Production dependencies including the startup driver fix |
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

## Original feature verification

- **Backend:** 23 tests passed under Python 3.11 with the repository's production dependencies and pytest 7.4.3.
- **Frontend normalization:** Six Node tests passed.
- **Build:** TypeScript compilation and the Vite production build passed.
- **Syntax/diff:** Changed Python modules compiled and `git diff --check` passed.
- **Real-modal browser QA:** Verified Quick/Deep switching, zero POST requests while viewing, keyboard switching, refreshing each mode while retaining the other, delayed scoring preservation, close/reopen, contact changes, and legacy Deep-only records.
- **Visual QA:** Inspected desktop and 390-pixel mobile screenshots; saved tabs and action controls fit without page-level horizontal overflow.

Browser QA used the actual modified modal with synthetic contacts and intercepted network responses. No production enrichment, customer record write, or billable provider call was made during verification. These checks are not a live Supabase persistence test or production deployment signoff.

The current backend test suite includes requests made through the actual installed PostgREST SDK with mocked HTTP transport, checking bounded revision/null guards and `return=representation`. The original whole-JSON equality guard was replaced in PR #4.

Existing framework deprecation warnings and the large frontend bundle warning remain; this feature does not refactor those unrelated areas.

## Reproduce tests

From the repository root:

```bash
python3.11 -m venv .venv-saved-results
.venv-saved-results/bin/python -m pip install -r backend/requirements.txt pytest==7.4.3
PYTHONPATH=backend .venv-saved-results/bin/python -m pytest \
  -q backend/tests/test_deep_provider.py \
  backend/tests/test_saved_enrichment.py backend/tests/test_database_startup.py
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

1. The feature, startup dependency fix, and compact persistence guard are merged. Review and merge the structured-output follow-up only after approval. Main-branch updates trigger production auto-deployment, so merging is a production action ([configured repository](https://github.com/quatrorabes/latticeiq)).
2. Verify backend readiness: saved-results GET should be registered in `/api/openapi.json`; confirm a signed, owner-authorized request returns the existing result without running enrichment.
3. Confirm the frontend deployment includes the saved tabs. If backend and frontend auto-deploy simultaneously, wait for both to finish before smoke testing; the new frontend requires the saved-results GET after generation.
4. Use one owned contact with a retained legacy Deep result. Confirm Deep appears and Quick says `Not saved`, without automatically generating it.
5. After separate paid-test approval, use the approved contact's existing Quick snapshot, record its fingerprint, and run Deep exactly once. Do not regenerate Quick as part of this test.
6. Reopen or reload the contact, confirm both persist, and compare Quick with its pre-test fingerprint.
7. Switch between saved modes and verify no generation POSTs occur. Stop and inspect logs if the single Deep test fails; a further paid retry needs separate approval.

Do not add funds, rotate provider keys, or change provider routing for this feature; the quota issue was resolved separately.

## Rollback

Revert the feature commit through the normal release process. No migration rollback is needed. Existing version-2 payloads retain compatible top-level fields, so an older UI can still display the latest top-level result.

However, an older backend's subsequent enrichment can replace the column and discard saved snapshots. Preserve a backup before any rollback involving further enrichment. The provider monitoring package remains separate and is not deployed by this branch.
