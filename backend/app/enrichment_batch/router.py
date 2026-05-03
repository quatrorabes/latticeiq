from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Query
from supabase import Client, create_client

from .models import (
    ActorContext,
    ApprovalUpdateRequest,
    BatchEnrichmentRequest,
    EnrichmentJobItemListResponse,
    EnrichmentJobItemResponse,
    EnrichmentJobListResponse,
    EnrichmentJobResponse,
    JobCounts,
)

logger = logging.getLogger("latticeiq")

router = APIRouter(prefix="/enrichment-jobs", tags=["enrichment-batch"])

INTERNAL_API_BASE_URL = os.getenv("INTERNAL_API_BASE_URL", "http://127.0.0.1:8000")
QUICK_ENRICH_PATH = os.getenv("QUICK_ENRICH_PATH", "/api/v3/enrichment/quick-enrich/{contact_id}")
DEEP_ENRICH_PATH = os.getenv("DEEP_ENRICH_PATH", "/api/v3/enrichment/deep-enrich/{contact_id}")
DEFAULT_PROVIDER = "perplexity"


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


def row_to_job_response(row: Dict[str, Any]) -> EnrichmentJobResponse:
    return EnrichmentJobResponse(
        id=row["id"],
        user_id=row["user_id"],
        mode=row["mode"],
        provider=row["provider"],
        status=row["status"],
        selection_type=row["selection_type"],
        requested_contact_ids=row.get("requested_contact_ids") or [],
        filters=row.get("filters") or {},
        metadata=row.get("metadata") or {},
        counts=JobCounts(
            contact_count=row.get("contact_count") or 0,
            success_count=row.get("success_count") or 0,
            failure_count=row.get("failure_count") or 0,
        ),
        started_at=row.get("started_at"),
        completed_at=row.get("completed_at"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def row_to_item_response(row: Dict[str, Any]) -> EnrichmentJobItemResponse:
    return EnrichmentJobItemResponse(
        id=row["id"],
        job_id=row["job_id"],
        contact_id=row["contact_id"],
        user_id=row["user_id"],
        mode=row["mode"],
        provider=row["provider"],
        status=row["status"],
        approval_status=row["approval_status"],
        attempt_count=row.get("attempt_count") or 0,
        provider_response=row.get("provider_response"),
        normalized_data=row.get("normalized_data"),
        field_patch=row.get("field_patch") or {},
        approved_fields=row.get("approved_fields") or [],
        error_message=row.get("error_message"),
        started_at=row.get("started_at"),
        completed_at=row.get("completed_at"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def chunked(values: List[str], size: int) -> List[List[str]]:
    return [values[i : i + size] for i in range(0, len(values), size)]


def extract_first_text(value: Any) -> Optional[str]:
    if isinstance(value, str) and value.strip():
        return value.strip()

    if isinstance(value, dict):
        if isinstance(value.get("text"), str) and value["text"].strip():
            return value["text"].strip()
        for sub in value.values():
            found = extract_first_text(sub)
            if found:
                return found

    if isinstance(value, list):
        for item in value:
            found = extract_first_text(item)
            if found:
                return found

    return None


def extract_text_list(value: Any, limit: int = 5) -> List[str]:
    results: List[str] = []

    def _walk(v: Any) -> None:
        if len(results) >= limit:
            return

        if isinstance(v, str):
            text = v.strip()
            if text:
                results.append(text)
            return

        if isinstance(v, dict):
            if isinstance(v.get("text"), str) and v["text"].strip():
                results.append(v["text"].strip())
                return
            for sub in v.values():
                _walk(sub)
                if len(results) >= limit:
                    return
            return

        if isinstance(v, list):
            for item in v:
                _walk(item)
                if len(results) >= limit:
                    return

    _walk(value)
    return results[:limit]


def build_field_patch(normalized_data: Dict[str, Any], contact_row: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    patch: Dict[str, Any] = {}

    source = normalized_data or {}
    if "enrichment_data" in source and isinstance(source["enrichment_data"], dict):
        source = source["enrichment_data"]

    contact_profile = source.get("contact_profile") or {}
    company_profile = source.get("company_profile") or {}
    messaging = source.get("messaging") or {}
    current_focus = source.get("current_focus") or {}
    buying_signals = source.get("buying_signals") or {}

    headline = extract_first_text(contact_profile.get("headline"))
    role_summary = extract_first_text(contact_profile.get("role_summary"))
    one_liner = extract_first_text(company_profile.get("one_liner"))
    industry = extract_first_text(company_profile.get("industry"))
    cold_opener = extract_first_text(messaging.get("cold_openers"))
    value_props = extract_text_list(messaging.get("value_props"), limit=5)
    focus_items = extract_text_list(current_focus, limit=5)
    signal_items = extract_text_list(buying_signals, limit=5)

    if headline or role_summary:
        patch["enrichment_summary"] = " ".join([x for x in [headline, role_summary] if x]).strip()

    if cold_opener:
        patch["recommended_opener"] = cold_opener

    if one_liner:
        patch["company_summary"] = one_liner

    if industry:
        patch["industry"] = industry

    if value_props:
        patch["value_props"] = " | ".join(value_props)

    combined_signals = signal_items or focus_items
    if combined_signals:
        patch["buying_signals"] = " | ".join(combined_signals[:5])

    if contact_row:
        linkedin = contact_row.get("linkedinurl") or contact_row.get("linkedin_url")
        website = contact_row.get("website")
        if linkedin:
            patch["linkedinurl"] = linkedin
        if website:
            patch["website"] = website

    return patch


async def call_existing_enrichment_endpoint(
    contact_id: str,
    mode: str,
    authorization: Optional[str],
) -> Dict[str, Any]:
    path = QUICK_ENRICH_PATH if mode == "quick" else DEEP_ENRICH_PATH
    url = f"{INTERNAL_API_BASE_URL}{path.format(contact_id=contact_id)}"

    headers: Dict[str, str] = {}
    if authorization:
        headers["Authorization"] = authorization

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, headers=headers)

    content_type = response.headers.get("content-type", "")
    try:
        body = response.json() if "application/json" in content_type else {"raw": response.text}
    except Exception:
        body = {"raw": response.text}

    if response.status_code >= 400:
        detail = body.get("detail") if isinstance(body, dict) else body
        raise RuntimeError(f"Underlying enrichment failed for contact {contact_id}: {detail}")

    return body


def fetch_contacts_for_user(
    supabase: Client,
    user_id: str,
    contact_ids: List[str],
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for group in chunked(contact_ids, 100):
        res = (
            supabase.table("contacts")
            .select("*")
            .eq("user_id", user_id)
            .in_("id", group)
            .execute()
        )
        if res.data:
            rows.extend(res.data)
    return rows


def fetch_contact_by_id(
    supabase: Client,
    user_id: str,
    contact_id: str,
) -> Optional[Dict[str, Any]]:
    res = (
        supabase.table("contacts")
        .select("*")
        .eq("user_id", user_id)
        .eq("id", contact_id)
        .execute()
    )
    if not res.data:
        return None
    return res.data[0]


async def process_batch_job(
    job_id: str,
    user_id: str,
    authorization: Optional[str],
) -> None:
    supabase = get_supabase_admin()

    try:
        (
            supabase.table("enrichment_jobs")
            .update({"status": "processing", "started_at": utcnow_iso()})
            .eq("id", job_id)
            .eq("user_id", user_id)
            .execute()
        )

        items_res = (
            supabase.table("enrichment_job_items")
            .select("*")
            .eq("job_id", job_id)
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
        items = items_res.data or []

        for item in items:
            item_id = item["id"]
            contact_id = item["contact_id"]
            mode = item["mode"]

            try:
                (
                    supabase.table("enrichment_job_items")
                    .update(
                        {
                            "status": "processing",
                            "attempt_count": (item.get("attempt_count") or 0) + 1,
                            "started_at": utcnow_iso(),
                            "error_message": None,
                        }
                    )
                    .eq("id", item_id)
                    .execute()
                )

                provider_body = await call_existing_enrichment_endpoint(
                    contact_id=contact_id,
                    mode=mode,
                    authorization=authorization,
                )

                contact_row = fetch_contact_by_id(supabase, user_id, contact_id)
                if not contact_row:
                    raise RuntimeError(f"Contact {contact_id} not found after enrichment")

                normalized_data = (
                    contact_row.get("enrichment_data")
                    or provider_body.get("enrichment_data")
                    or provider_body
                )
                if not isinstance(normalized_data, dict):
                    normalized_data = {"raw": normalized_data}

                field_patch = build_field_patch(normalized_data, contact_row)

                (
                    supabase.table("enrichment_job_items")
                    .update(
                        {
                            "status": "completed",
                            "approval_status": "pending",
                            "provider_response": provider_body,
                            "normalized_data": normalized_data,
                            "field_patch": field_patch,
                            "completed_at": utcnow_iso(),
                            "error_message": None,
                        }
                    )
                    .eq("id", item_id)
                    .execute()
                )

            except Exception as exc:
                logger.exception("Batch enrichment failed for item %s", item_id)
                (
                    supabase.table("enrichment_job_items")
                    .update(
                        {
                            "status": "failed",
                            "error_message": str(exc),
                            "completed_at": utcnow_iso(),
                        }
                    )
                    .eq("id", item_id)
                    .execute()
                )

    except Exception as exc:
        logger.exception("Batch enrichment job failed: %s", job_id)
        (
            supabase.table("enrichment_jobs")
            .update(
                {
                    "status": "failed",
                    "error_summary": str(exc),
                    "completed_at": utcnow_iso(),
                }
            )
            .eq("id", job_id)
            .execute()
        )


def process_batch_job_sync(job_id: str, user_id: str, authorization: Optional[str]) -> None:
    asyncio.run(process_batch_job(job_id, user_id, authorization))


@router.post("/batch", response_model=EnrichmentJobResponse, status_code=202)
async def create_batch_enrichment_job(
    payload: BatchEnrichmentRequest,
    authorization: Optional[str] = Header(default=None),
) -> EnrichmentJobResponse:
    actor = get_actor_context(authorization)
    supabase = get_supabase_admin()

    if payload.selection_type == "manual" and not payload.contact_ids:
        raise HTTPException(status_code=400, detail="contact_ids cannot be empty for manual selection")

    contacts = fetch_contacts_for_user(supabase, actor.user_id, payload.contact_ids)
    found_ids = {row["id"] for row in contacts}
    missing_ids = [cid for cid in payload.contact_ids if cid not in found_ids]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail={"message": "Some contacts were not found for this user", "missing_ids": missing_ids},
        )

    job_row = {
        "user_id": actor.user_id,
        "mode": payload.mode,
        "provider": payload.provider or DEFAULT_PROVIDER,
        "status": "queued",
        "selection_type": payload.selection_type,
        "requested_contact_ids": payload.contact_ids,
        "filters": payload.filters,
        "metadata": payload.metadata,
        "contact_count": len(payload.contact_ids),
        "success_count": 0,
        "failure_count": 0,
    }

    job_res = supabase.table("enrichment_jobs").insert(job_row).execute()
    if not job_res.data:
        raise HTTPException(status_code=500, detail="Failed to create enrichment job")
    job = job_res.data[0]

    item_rows = [
        {
            "user_id": actor.user_id,
            "job_id": job["id"],
            "contact_id": row["id"],
            "mode": payload.mode,
            "provider": payload.provider or DEFAULT_PROVIDER,
            "status": "queued",
            "approval_status": "pending",
            "attempt_count": 0,
        }
        for row in contacts
    ]
    if item_rows:
        supabase.table("enrichment_job_items").insert(item_rows).execute()

    import threading
    thread = threading.Thread(
        target=process_batch_job_sync,
        args=(job["id"], actor.user_id, authorization),
        daemon=True,
    )
    thread.start()

    fresh = (
        supabase.table("enrichment_jobs")
        .select("*")
        .eq("id", job["id"])
        .execute()
    )
    return row_to_job_response(fresh.data[0])


@router.get("/jobs/{job_id}", response_model=EnrichmentJobResponse)
async def get_batch_enrichment_job(
    job_id: str,
    authorization: Optional[str] = Header(default=None),
) -> EnrichmentJobResponse:
    actor = get_actor_context(authorization)
    supabase = get_supabase_admin()

    res = (
        supabase.table("enrichment_jobs")
        .select("*")
        .eq("id", job_id)
        .eq("user_id", actor.user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Enrichment job not found")
    return row_to_job_response(res.data[0])


@router.get("/jobs/{job_id}/items", response_model=EnrichmentJobItemListResponse)
async def get_batch_enrichment_job_items(
    job_id: str,
    limit: int = Query(default=200, ge=1, le=1000),
    authorization: Optional[str] = Header(default=None),
) -> EnrichmentJobItemListResponse:
    actor = get_actor_context(authorization)
    supabase = get_supabase_admin()

    res = (
        supabase.table("enrichment_job_items")
        .select("*")
        .eq("job_id", job_id)
        .eq("user_id", actor.user_id)
        .order("created_at")
        .limit(limit)
        .execute()
    )
    rows = res.data or []
    return EnrichmentJobItemListResponse(
        items=[row_to_item_response(row) for row in rows],
        total=len(rows),
    )


@router.get("/history", response_model=EnrichmentJobListResponse)
async def get_enrichment_history(
    limit: int = Query(default=50, ge=1, le=500),
    authorization: Optional[str] = Header(default=None),
) -> EnrichmentJobListResponse:
    actor = get_actor_context(authorization)
    supabase = get_supabase_admin()

    res = (
        supabase.table("enrichment_jobs")
        .select("*")
        .eq("user_id", actor.user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows = res.data or []
    return EnrichmentJobListResponse(
        items=[row_to_job_response(row) for row in rows],
        total=len(rows),
    )


@router.post("/jobs/{job_id}/approve", response_model=EnrichmentJobItemListResponse)
async def approve_job_items(
    job_id: str,
    payload: ApprovalUpdateRequest,
    authorization: Optional[str] = Header(default=None),
) -> EnrichmentJobItemListResponse:
    actor = get_actor_context(authorization)
    supabase = get_supabase_admin()

    if not payload.item_ids:
        raise HTTPException(status_code=400, detail="item_ids cannot be empty")

    (
        supabase.table("enrichment_job_items")
        .update(
            {
                "approval_status": payload.approval_status,
                "approved_fields": payload.approved_fields,
            }
        )
        .eq("job_id", job_id)
        .eq("user_id", actor.user_id)
        .in_("id", payload.item_ids)
        .execute()
    )

    res = (
        supabase.table("enrichment_job_items")
        .select("*")
        .eq("job_id", job_id)
        .eq("user_id", actor.user_id)
        .in_("id", payload.item_ids)
        .execute()
    )
    rows = res.data or []
    return EnrichmentJobItemListResponse(
        items=[row_to_item_response(row) for row in rows],
        total=len(rows),
    )