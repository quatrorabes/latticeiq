"""Independent latest Quick/Deep snapshots, with legacy compatibility.

The existing top-level payload stays intact for scoring/outreach consumers.
Compare-and-swap writes prevent simultaneous provider completions losing a mode.
No new column, migration, or provider request is required to read saved results.
"""

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException

MODES = ("quick", "deep")
REVISION_KEY = "storage_revision"
REVISION_FILTER = f"enrichment_data->>{REVISION_KEY}"


def _mode(payload: Dict[str, Any]) -> Optional[str]:
    if payload.get("mode") in MODES:
        return payload["mode"]
    data = payload.get("data") or payload
    if isinstance(data, dict):
        meta = data.get("meta")
        if isinstance(meta, dict) and meta.get("source") in MODES:
            return meta["source"]
        if data.get("summary") or data.get("talking_points") or data.get("openingline"):
            return "quick"
    return None  # Do not label an unidentified legacy result as Deep.


def get_saved_results(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict):
        return {"quick": None, "deep": None}
    stored = value.get("saved_results")
    results = {
        mode: deepcopy(stored.get(mode)) if isinstance(stored, dict)
        and isinstance(stored.get(mode), dict) else None
        for mode in MODES
    }
    mode = _mode(value)
    if mode and results[mode] is None:
        snapshot = deepcopy(value)
        snapshot.pop("saved_results", None)
        snapshot.pop("storage_version", None)
        snapshot.pop(REVISION_KEY, None)
        results[mode] = snapshot
    return results


def merge_saved_result(existing: Any, mode: str, snapshot: Dict[str, Any]) -> Dict[str, Any]:
    if mode not in MODES:
        raise ValueError("Unsupported enrichment mode")
    latest = deepcopy(snapshot)
    latest.pop("saved_results", None)
    latest.pop("storage_version", None)
    latest.pop(REVISION_KEY, None)
    latest["mode"] = mode
    latest.setdefault("enriched_at", datetime.now(timezone.utc).isoformat())
    results = get_saved_results(existing)
    results[mode] = deepcopy(latest)
    return {
        **latest, "storage_version": 2, REVISION_KEY: uuid4().hex,
        "saved_results": results,
    }


def persist_saved_result(client, contact_id: str, mode: str, snapshot: Dict[str, Any],
                         user_id: str) -> Dict[str, Any]:
    """Reread after the provider call, then atomically update if unchanged.

    Compare a short revision token, never the full JSONB in the request URL.
    Legacy values without a token also compare the existing enriched_at column.
    If another writer finishes first, reread and merge without another provider
    call. The full payload is sent only in the PATCH body.
    """
    for _ in range(5):
        response = client.table("contacts").select("id,enrichment_data,enriched_at").eq(
            "id", contact_id
        ).eq("user_id", user_id).execute()
        if not response.data:
            raise HTTPException(404, "Contact not found")
        existing = response.data[0].get("enrichment_data")
        revision = existing.get(REVISION_KEY) if isinstance(existing, dict) else None
        if revision is not None:
            try:
                if not isinstance(revision, str) or len(revision) > 36:
                    raise ValueError("Invalid revision")
                UUID(revision)
            except ValueError:
                raise HTTPException(
                    409, "Invalid saved enrichment revision; no data was overwritten."
                ) from None
        merged = merge_saved_result(existing, mode, snapshot)
        query = client.table("contacts").update({
            "enrichment_data": merged,
            "enrichment_status": "completed",
            "enriched_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", contact_id).eq("user_id", user_id)
        if existing is None:
            query = query.is_("enrichment_data", "null")
        elif revision is not None:
            query = query.eq(REVISION_FILTER, revision)
        else:
            # The first successful upgrade writes a token, so competing new
            # writers cannot both match this null-token guard. The timestamp
            # also catches a pre-upgrade writer finishing during rollout.
            query = query.is_(REVISION_FILTER, "null")
            enriched_at = response.data[0].get("enriched_at")
            if enriched_at is None:
                query = query.is_("enriched_at", "null")
            else:
                query = query.eq("enriched_at", enriched_at)
        updated = query.execute()
        if updated.data:
            return merged
    raise HTTPException(409, "Enrichment changed concurrently; saved results were not overwritten.")
