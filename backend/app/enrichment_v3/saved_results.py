"""Independent latest Quick/Deep snapshots, with legacy compatibility.

The existing top-level payload stays intact for scoring/outreach consumers.
Compare-and-swap writes prevent simultaneous provider completions losing a mode.
No new column, migration, or provider request is required to read saved results.
"""

from copy import deepcopy
from datetime import datetime, timezone
import json
from typing import Any, Dict, Optional

from fastapi import HTTPException

MODES = ("quick", "deep")


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
        results[mode] = snapshot
    return results


def merge_saved_result(existing: Any, mode: str, snapshot: Dict[str, Any]) -> Dict[str, Any]:
    if mode not in MODES:
        raise ValueError("Unsupported enrichment mode")
    latest = deepcopy(snapshot)
    latest.pop("saved_results", None)
    latest.pop("storage_version", None)
    latest["mode"] = mode
    latest.setdefault("enriched_at", datetime.now(timezone.utc).isoformat())
    results = get_saved_results(existing)
    results[mode] = deepcopy(latest)
    return {**latest, "storage_version": 2, "saved_results": results}


def persist_saved_result(client, contact_id: str, mode: str, snapshot: Dict[str, Any],
                         user_id: str) -> Dict[str, Any]:
    """Reread after the provider call, then atomically update if unchanged.

    PostgREST's JSONB equality filter compares the full previous value. If another
    writer finishes first, reread and merge without calling the provider again.
    """
    for _ in range(5):
        response = client.table("contacts").select("id,enrichment_data").eq(
            "id", contact_id
        ).eq("user_id", user_id).execute()
        if not response.data:
            raise HTTPException(404, "Contact not found")
        existing = response.data[0].get("enrichment_data")
        merged = merge_saved_result(existing, mode, snapshot)
        query = client.table("contacts").update({
            "enrichment_data": merged,
            "enrichment_status": "completed",
            "enriched_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", contact_id).eq("user_id", user_id)
        if existing is None:
            query = query.is_("enrichment_data", "null")
        else:
            query = query.eq("enrichment_data", json.dumps(existing, separators=(",", ":")))
        updated = query.execute()
        if updated.data:
            return merged
    raise HTTPException(409, "Enrichment changed concurrently; saved results were not overwritten.")
