"""Read-only saved-result endpoint; does not call any provider."""

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.auth import get_current_user
from app.database import get_supabase
from app.enrichment_v3.saved_results import get_saved_results

router = APIRouter(prefix="/api/v3/enrichment", tags=["enrichment-saved"])


@router.get("/saved/{contact_id}")
async def read_saved_results(contact_id: str, user=Depends(get_current_user),
                             supabase: Client = Depends(get_supabase)):
    response = supabase.table("contacts").select("id,enrichment_data").eq(
        "id", contact_id
    ).eq("user_id", user.id).execute()
    if not response.data:
        raise HTTPException(404, "Contact not found")
    payload = response.data[0].get("enrichment_data")
    snapshots = get_saved_results(payload)
    # Only display data, not raw prompts/provider bodies. Preserve full envelope
    # in the contact row for compatibility and the existing debug endpoints.
    def timestamp(value):
        data = value.get("data") or value
        meta = data.get("meta") if isinstance(data, dict) else None
        return value.get("enriched_at") or (
            meta.get("generated_at") if isinstance(meta, dict) else None
        )

    results = {
        mode: {
            "mode": mode,
            "data": value.get("data") or value,
            "legacy": value.get("legacy"),
            "enriched_at": timestamp(value),
        } if value else None
        for mode, value in snapshots.items()
    }
    return {
        "contact_id": contact_id,
        "saved_results": results,
        "unclassified_legacy": bool(payload) and not any(snapshots.values()),
    }
