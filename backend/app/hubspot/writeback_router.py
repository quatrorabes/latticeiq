from __future__ import annotations

import base64
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from supabase import Client, create_client

from app.enrichment_batch.models import (
    ActorContext,
    HubSpotBatchSyncRequest,
    HubSpotBatchSyncResponse,
    HubSpotSyncRow,
)

logger = logging.getLogger("latticeiq")

router = APIRouter(prefix="/hubspot", tags=["HubSpot Writeback"])

HUBSPOT_BATCH_UPDATE_URL = "https://api.hubapi.com/crm/v3/objects/contacts/batch/update"


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_supabase_admin() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
    )
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and service role key are required")
    return create_client(url, key)


def decode_jwt_without_verification(token: str) -> Dict[str, Any]:
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return {}
        payload = parts[1]
        padded = payload + "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
        return json.loads(decoded)
    except Exception:
        return {}


def get_actor_context(authorization: Optional[str]) -> ActorContext:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.split(" ", 1)[1].strip()
    claims = decode_jwt_without_verification(token)
    user_id = claims.get("sub")
    email = claims.get("email")

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing user id")

    return ActorContext(user_id=str(user_id), email=str(email) if email else None)


def get_supabase():
    return get_supabase_admin()


async def get_current_user_id(authorization: str = Header(...)) -> str:
    actor = get_actor_context(authorization)
    return actor.user_id


async def get_hubspot_api_key(
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase),
    api_key: Optional[str] = Header(None, alias="X-HubSpot-API-Key"),
) -> str:
    if api_key:
        return api_key

    try:
        result = (
            supabase.table("user_integrations")
            .select("api_key, status")
            .eq("user_id", user_id)
            .eq("provider", "hubspot")
            .single()
            .execute()
        )

        if result.data and result.data.get("api_key"):
            if result.data.get("status") == "error":
                raise HTTPException(
                    status_code=401,
                    detail="HubSpot connection has errors - please reconnect",
                )
            return result.data["api_key"]
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Could not fetch stored HubSpot key: %s", e)

    env_token = os.getenv("HUBSPOT_ACCESS_TOKEN")
    if env_token:
        return env_token

    raise HTTPException(
        status_code=401,
        detail="HubSpot not connected. Go to Settings → Integrations to connect.",
    )


def extract_hubspot_contact_id(contact_row: Dict[str, Any]) -> Optional[str]:
    for key in ["hubspot_id", "hubspot_contact_id", "hubspotid", "crm_record_id"]:
        value = contact_row.get(key)
        if value:
            return str(value)
    return None


def normalize_hubspot_properties(
    field_patch: Dict[str, Any],
    approved_fields: List[str],
    allowed_fields: List[str],
) -> Dict[str, Any]:
    approved_set = set(approved_fields or [])
    allowed_set = set(allowed_fields or [])
    properties: Dict[str, Any] = {}

    for key, value in (field_patch or {}).items():
        if approved_set and key not in approved_set:
            continue
        if allowed_set and key not in allowed_set:
            continue
        if value in (None, "", [], {}):
            continue
        properties[key] = value

    return properties


@router.post("/batch-update-enriched", response_model=HubSpotBatchSyncResponse)
async def hubspot_batch_update_enriched_contacts(
    payload: HubSpotBatchSyncRequest,
    authorization: Optional[str] = Header(default=None),
    hubspot_api_key: str = Depends(get_hubspot_api_key),
) -> HubSpotBatchSyncResponse:
    actor = get_actor_context(authorization)
    supabase = get_supabase_admin()

    items_query = (
        supabase.table("enrichment_job_items")
        .select("*")
        .eq("job_id", payload.job_id)
        .eq("user_id", actor.user_id)
        .eq("approval_status", "approved")
        .order("created_at")
    )

    if payload.item_ids:
        items_query = items_query.in_("id", payload.item_ids)

    items_res = items_query.execute()
    items = items_res.data or []
    if not items:
        raise HTTPException(status_code=404, detail="No approved enrichment job items found to sync")

    contact_ids = [item["contact_id"] for item in items]
    contacts_res = (
        supabase.table("contacts")
        .select("*")
        .eq("user_id", actor.user_id)
        .in_("id", contact_ids)
        .execute()
    )
    contact_map = {row["id"]: row for row in (contacts_res.data or [])}

    sync_rows: List[HubSpotSyncRow] = []
    prelogged_failures = 0

    for item in items:
        contact = contact_map.get(item["contact_id"])
        if not contact:
            prelogged_failures += 1
            supabase.table("crm_sync_events").insert(
                {
                    "user_id": actor.user_id,
                    "contact_id": item["contact_id"],
                    "job_id": item["job_id"],
                    "job_item_id": item["id"],
                    "crm_system": "hubspot",
                    "direction": "outbound",
                    "status": "failed",
                    "crm_record_id": None,
                    "payload_sent": {},
                    "response_body": {},
                    "error_message": "Contact not found",
                    "synced_at": utcnow_iso(),
                }
            ).execute()
            continue

        hubspot_contact_id = extract_hubspot_contact_id(contact)
        if not hubspot_contact_id:
            prelogged_failures += 1
            supabase.table("crm_sync_events").insert(
                {
                    "user_id": actor.user_id,
                    "contact_id": item["contact_id"],
                    "job_id": item["job_id"],
                    "job_item_id": item["id"],
                    "crm_system": "hubspot",
                    "direction": "outbound",
                    "status": "failed",
                    "crm_record_id": None,
                    "payload_sent": {},
                    "response_body": {},
                    "error_message": "Missing hubspot_id on contact record",
                    "synced_at": utcnow_iso(),
                }
            ).execute()
            continue

        properties = normalize_hubspot_properties(
            field_patch=item.get("field_patch") or {},
            approved_fields=item.get("approved_fields") or [],
            allowed_fields=payload.allowed_fields,
        )

        if not properties:
            prelogged_failures += 1
            supabase.table("crm_sync_events").insert(
                {
                    "user_id": actor.user_id,
                    "contact_id": item["contact_id"],
                    "job_id": item["job_id"],
                    "job_item_id": item["id"],
                    "crm_system": "hubspot",
                    "direction": "outbound",
                    "status": "skipped",
                    "crm_record_id": hubspot_contact_id,
                    "payload_sent": {},
                    "response_body": {},
                    "error_message": "No approved properties to sync",
                    "synced_at": utcnow_iso(),
                }
            ).execute()
            continue

        sync_rows.append(
            HubSpotSyncRow(
                contact_id=item["contact_id"],
                hubspot_contact_id=hubspot_contact_id,
                properties=properties,
            )
        )

    if payload.dry_run:
        return HubSpotBatchSyncResponse(
            job_id=payload.job_id,
            dry_run=True,
            attempted=len(sync_rows),
            synced=0,
            failed=prelogged_failures,
            rows=sync_rows,
        )

    if not sync_rows:
        return HubSpotBatchSyncResponse(
            job_id=payload.job_id,
            dry_run=False,
            attempted=0,
            synced=0,
            failed=prelogged_failures,
            rows=[],
        )

    request_inputs = [
        {
            "id": row.hubspot_contact_id,
            "properties": row.properties,
        }
        for row in sync_rows
    ]

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            HUBSPOT_BATCH_UPDATE_URL,
            headers={
                "Authorization": f"Bearer {hubspot_api_key}",
                "Content-Type": "application/json",
            },
            json={"inputs": request_inputs},
        )

    response_body: Dict[str, Any]
    try:
        response_body = response.json()
    except Exception:
        response_body = {"raw": response.text}

    if response.status_code not in (200, 201):
        for row in sync_rows:
            matching_item = next((item for item in items if item["contact_id"] == row.contact_id), None)
            supabase.table("crm_sync_events").insert(
                {
                    "user_id": actor.user_id,
                    "contact_id": row.contact_id,
                    "job_id": payload.job_id,
                    "job_item_id": matching_item["id"] if matching_item else None,
                    "crm_system": "hubspot",
                    "direction": "outbound",
                    "status": "failed",
                    "crm_record_id": row.hubspot_contact_id,
                    "payload_sent": row.properties,
                    "response_body": response_body,
                    "error_message": f"HubSpot batch update failed with status {response.status_code}",
                    "synced_at": utcnow_iso(),
                }
            ).execute()

        return HubSpotBatchSyncResponse(
            job_id=payload.job_id,
            dry_run=False,
            attempted=len(sync_rows),
            synced=0,
            failed=len(sync_rows) + prelogged_failures,
            rows=sync_rows,
        )

    for row in sync_rows:
        matching_item = next((item for item in items if item["contact_id"] == row.contact_id), None)
        supabase.table("crm_sync_events").insert(
            {
                "user_id": actor.user_id,
                "contact_id": row.contact_id,
                "job_id": payload.job_id,
                "job_item_id": matching_item["id"] if matching_item else None,
                "crm_system": "hubspot",
                "direction": "outbound",
                "status": "completed",
                "crm_record_id": row.hubspot_contact_id,
                "payload_sent": row.properties,
                "response_body": response_body,
                "error_message": None,
                "synced_at": utcnow_iso(),
            }
        ).execute()

    return HubSpotBatchSyncResponse(
        job_id=payload.job_id,
        dry_run=False,
        attempted=len(sync_rows),
        synced=len(sync_rows),
        failed=prelogged_failures,
        rows=sync_rows,
    )