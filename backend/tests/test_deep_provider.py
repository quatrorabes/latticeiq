"""Deep provider, route, and real PostgREST SDK regressions; entirely offline."""

import asyncio
from copy import deepcopy
import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from app.enrichment_v3.deep_provider import (
    DEEP_RESEARCH_RESPONSE_FORMAT,
    DeepProviderResponseError,
    parse_deep_provider_response,
)
from app.enrichment_v3.models import EnrichmentMeta, UnifiedEnrichmentResult
from app.enrichment_v3.saved_results import get_saved_results, merge_saved_result
from app.enrichment_v3 import saved_results_router
from app.routers import enrichment_v3_deep as deep


def research_payload():
    return {
        "contact_profile": {
            "headline": "Vice President at Example Bank",
            "role_summary": "Leads small-business lending.",
            "seniority": "VP",
            "background_bullets": [{"text": "Commercial lending experience"}],
        },
        "company_profile": {
            "one_liner": "A synthetic community bank used only in tests.",
            "industry": "Commercial banking",
            "size_segment": None,
            "region": None,
            "key_products_or_services": [{"text": "Business lending"}],
        },
        "current_focus": {
            "strategic_initiatives": [], "recent_projects": [], "primary_kpis": [],
        },
        "buying_signals": {
            "recent_news": [], "hiring_signals": [], "tech_changes": [],
            "timing_triggers": [],
        },
        "risks_and_objections": {
            "risk_bullets": [], "likely_objections": [], "landmines": [],
        },
        "messaging": {
            "cold_openers": [{"text": "Your business-lending focus stood out."}],
            "value_props": [], "call_to_action_ideas": [],
        },
    }


def completion(content=None, finish_reason="stop"):
    return {
        "model": "sonar-pro",
        "choices": [{
            "finish_reason": finish_reason,
            "message": {
                "content": json.dumps(research_payload()) if content is None else content,
            },
        }],
    }


def saved_snapshot(mode):
    return {
        "mode": mode,
        "data": UnifiedEnrichmentResult(
            contact_id="contact-1", meta=EnrichmentMeta(source=mode),
        ).model_dump(),
        "enriched_at": "2026-10-15T19:00:00+00:00",
        "raw_provider_response": {"content": "large saved result " * 12000},
    }


class SDKDatabase:
    """Exercise the actual installed SDK with local, stateful HTTP responses."""

    def __init__(self, both_modes=False, owner="owner"):
        existing = merge_saved_result(None, "quick", saved_snapshot("quick"))
        if both_modes:
            existing = merge_saved_result(existing, "deep", saved_snapshot("deep"))
        self.row = {
            "id": "contact-1", "user_id": owner,
            "first_name": "Test", "last_name": "Prospect",
            "email": "test@example.invalid", "company": "Example Bank",
            "enrichment_status": "completed",
            "enriched_at": "2026-10-15T19:00:00+00:00",
            "enrichment_data": existing,
        }
        self.requests = []
        self.applied_patches = []
        self.conflict_once = False
        self.fail_cleanup = False
        self.client = SyncPostgrestClient("https://database.invalid/rest/v1")
        self.client.session.close()
        self.client.session = httpx.Client(
            base_url="https://database.invalid/rest/v1",
            transport=httpx.MockTransport(self.handle),
        )

    def handle(self, request):
        self.requests.append(request)
        assert request.url.params["id"] == "eq.contact-1"
        assert request.url.params["user_id"] == "eq.owner"
        assert len(str(request.url).encode()) < 512
        patch = json.loads(request.content) if request.method == "PATCH" else None
        if patch and patch.get("enrichment_status") == "failed" and self.fail_cleanup:
            raise httpx.ConnectError("synthetic cleanup failure", request=request)
        if patch and "enrichment_data" in patch and self.conflict_once:
            self.conflict_once = False
            concurrent = saved_snapshot("quick")
            concurrent["data"]["contact_profile"]["headline"] = "Concurrent Quick"
            self.row["enrichment_data"] = merge_saved_result(
                self.row["enrichment_data"], "quick", concurrent
            )
        for key, value in request.url.params.multi_items():
            if key == "select":
                continue
            actual = self.row.get(key)
            if key == "enrichment_data->>storage_revision":
                actual = self.row["enrichment_data"].get("storage_revision")
            if value.startswith("eq.") and str(actual) != value[3:]:
                return httpx.Response(200, json=[])
            if value == "is.null" and actual is not None:
                return httpx.Response(200, json=[])
        if patch is not None:
            self.applied_patches.append(deepcopy(patch))
            self.row.update(deepcopy(patch))
        return httpx.Response(200, json=[deepcopy(self.row)])

    def close(self):
        self.client.session.close()


@pytest.fixture
def provider(monkeypatch):
    original = httpx.AsyncClient
    requests = []

    def install(body=None, http_status=200, error=None, raw=None):
        def handler(request):
            requests.append(request)
            assert str(request.url) == deep.PERPLEXITY_API_URL
            if error:
                raise error("synthetic provider failure", request=request)
            if raw is not None:
                return httpx.Response(http_status, content=raw)
            return httpx.Response(
                http_status, json=completion() if body is None else body,
            )

        monkeypatch.setattr(
            deep.httpx, "AsyncClient",
            lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
        )
        return requests

    monkeypatch.setenv("PERPLEXITY_API_KEY", "test-only-not-a-real-key")
    return install


def application(db):
    app = FastAPI()
    app.include_router(deep.router, prefix="/api/v3")
    app.include_router(saved_results_router.router)
    app.dependency_overrides[deep.get_current_user] = lambda: SimpleNamespace(id="owner")
    app.dependency_overrides[deep.get_supabase] = lambda: db.client
    return app


def test_schema_is_closed_required_and_fully_inlined():
    response_format = DEEP_RESEARCH_RESPONSE_FORMAT
    assert response_format["type"] == "json_schema"
    assert response_format["json_schema"]["name"].isalnum()
    assert len(response_format["json_schema"]["name"]) <= 64
    schema = response_format["json_schema"]["schema"]

    def check(value):
        if isinstance(value, dict):
            assert "$defs" not in value and "$ref" not in value
            if value.get("type") == "object":
                assert value["additionalProperties"] is False
                assert set(value["required"]) == set(value["properties"])
            for nested in value.values():
                check(nested)
        elif isinstance(value, list):
            for nested in value:
                check(nested)

    check(schema)
    assert set(schema["properties"]) == set(research_payload())
    assert parse_deep_provider_response(completion()) == research_payload()


@pytest.mark.parametrize("contact,name", [
    ({"first_name": "Test", "last_name": "Prospect"}, "Test Prospect"),
    ({"firstname": "Legacy", "lastname": "Prospect"}, "Legacy Prospect"),
    ({"first_name": "Canonical", "firstname": "Old", "last_name": "Name"}, "Canonical Name"),
])
def test_provider_requests_structured_output_once_and_uses_contact_name(provider, contact, name):
    requests = provider()
    result = asyncio.run(deep.call_perplexity_deep_research("test-key", contact))
    assert len(requests) == 1
    payload = json.loads(requests[0].content)
    assert payload["model"] == "sonar-pro"
    assert payload["max_tokens"] == 16000
    assert payload["response_format"] == DEEP_RESEARCH_RESPONSE_FORMAT
    assert f"- Name: {name}\n" in payload["messages"][1]["content"]
    assert result["parsed_payload"] == research_payload()


@pytest.mark.parametrize("content", [
    # Same middle-of-object syntax defect observed in production, anonymized.
    '{"company_profile":{"one_liner":"Example","industry":"Banking"},{"size_segment":"51-200"}}',
    '{"contact_profile": {"headline": "unfinished',
    '```json\n{}\n```',
    'Explanation before {"contact_profile": {}}',
    '{"contact_profile":{},"contact_profile":{}}',
    '{"contact_profile": NaN}',
    '{"contact_profile": Infinity}',
])
def test_invalid_json_is_not_repaired_retried_or_logged(provider, caplog, content):
    marker = "DO_NOT_LOG_PROVIDER_CONTENT"
    requests = provider(body=completion(content.replace("Example", marker)))
    with pytest.raises(HTTPException) as error:
        asyncio.run(deep.call_perplexity_deep_research("test-key", {}))
    assert error.value.status_code == 502
    assert "invalid JSON" in error.value.detail
    assert len(requests) == 1
    assert marker not in caplog.text
    assert content not in error.value.detail


@pytest.mark.parametrize("body", [
    None, [], {}, {"choices": []}, {"choices": [None]},
    {"choices": [{"finish_reason": "stop", "message": None}]},
    {"choices": [{"finish_reason": "stop", "message": {"content": None}}]},
    {"choices": [{"finish_reason": "stop", "message": {"content": ""}}]},
    {"choices": [{"message": {"content": "{}"}}]},
    {"choices": [{"finish_reason": "content_filter", "message": {"content": "{}"}}]},
    {"choices": [{"finish_reason": "stop", "message": {"refusal": "refused", "content": "{}"}}]},
])
def test_invalid_response_envelope_is_rejected(body):
    with pytest.raises(DeepProviderResponseError) as error:
        parse_deep_provider_response(body)
    assert error.value.reason == "invalid_response"


@pytest.mark.parametrize("mutation", [
    lambda value: value.pop("company_profile"),
    lambda value: value["company_profile"].pop("region"),
    lambda value: value.update(unexpected="extra data"),
    lambda value: value["company_profile"].update(unexpected="extra data"),
    lambda value: value["contact_profile"].update(headline=42),
    lambda value: value["contact_profile"].update(background_bullets=["not an object"]),
    lambda value: value["contact_profile"].update(background_bullets=[{"text": 42}]),
    lambda value: value["messaging"].update(cold_openers=None),
])
def test_wrong_schema_cannot_be_saved(mutation):
    value = research_payload()
    mutation(value)
    with pytest.raises(DeepProviderResponseError) as error:
        parse_deep_provider_response(completion(json.dumps(value)))
    assert error.value.reason == "invalid_schema"


def test_valid_json_cannot_hide_a_truncated_generation():
    with pytest.raises(DeepProviderResponseError) as error:
        parse_deep_provider_response(completion(finish_reason="length"))
    assert error.value.reason == "truncated"


@pytest.mark.parametrize("http_status", [401, 429, 500, 503])
def test_http_errors_do_not_retry_or_expose_provider_body(provider, caplog, http_status):
    requests = provider(http_status=http_status, raw=b"DO_NOT_LOG_PROVIDER_ERROR")
    with pytest.raises(HTTPException) as error:
        asyncio.run(deep.call_perplexity_deep_research("test-key", {}))
    assert error.value.status_code == 502
    assert f"status {http_status}" in error.value.detail
    assert len(requests) == 1
    assert "DO_NOT_LOG_PROVIDER_ERROR" not in caplog.text


@pytest.mark.parametrize("exception,status_code", [
    (httpx.ReadTimeout, 504), (httpx.ConnectError, 502),
])
def test_network_failure_does_not_retry(provider, exception, status_code):
    requests = provider(error=exception)
    with pytest.raises(HTTPException) as error:
        asyncio.run(deep.call_perplexity_deep_research("test-key", {}))
    assert error.value.status_code == status_code
    assert len(requests) == 1


def test_non_json_outer_response_is_safe(provider, caplog):
    requests = provider(raw=b"DO_NOT_LOG_OUTER_RESPONSE")
    with pytest.raises(HTTPException) as error:
        asyncio.run(deep.call_perplexity_deep_research("test-key", {}))
    assert error.value.status_code == 502
    assert len(requests) == 1
    assert "DO_NOT_LOG_OUTER_RESPONSE" not in caplog.text


@pytest.mark.parametrize("both_modes", [False, True])
def test_real_provider_parse_transform_and_large_snapshot_save(provider, both_modes):
    requests = provider()
    db = SDKDatabase(both_modes=both_modes)
    original_quick = deepcopy(get_saved_results(db.row["enrichment_data"])["quick"])
    try:
        with TestClient(application(db)) as client:
            response = client.post("/api/v3/enrichment/deep-enrich/contact-1")
            assert response.status_code == 200, response.text
            assert response.json()["status"] == "completed"
            assert db.row["enrichment_status"] == "completed"
            stored = get_saved_results(db.row["enrichment_data"])
            assert stored["quick"] == original_quick
            assert stored["deep"]["data"]["contact_profile"]["headline"] == (
                research_payload()["contact_profile"]["headline"]
            )
            assert len(db.row["enrichment_data"]["storage_revision"]) == 32
            saved = client.get("/api/v3/enrichment/saved/contact-1")
            assert saved.status_code == 200
            assert all(saved.json()["saved_results"].values())
        assert len(requests) == 1
        assert sum("enrichment_data" in patch for patch in db.applied_patches) == 1
    finally:
        db.close()


@pytest.mark.parametrize("both_modes", [False, True])
@pytest.mark.parametrize("failure", ["invalid_json", "invalid_schema", "truncated", "timeout"])
def test_failed_provider_keeps_saved_results_and_clears_processing(provider, both_modes, failure):
    if failure == "timeout":
        requests = provider(error=httpx.ReadTimeout)
    else:
        body = completion(
            content='{"company_profile":{},{"size_segment":"51-200"}}'
            if failure == "invalid_json" else "{}" if failure == "invalid_schema" else None,
            finish_reason="length" if failure == "truncated" else "stop",
        )
        requests = provider(body=body)
    db = SDKDatabase(both_modes=both_modes)
    original = deepcopy(db.row)
    try:
        with TestClient(application(db)) as client:
            response = client.post("/api/v3/enrichment/deep-enrich/contact-1")
        assert response.status_code == (504 if failure == "timeout" else 502)
        assert db.row["enrichment_status"] == "failed"
        assert db.row["enrichment_data"] == original["enrichment_data"]
        assert db.row["enriched_at"] == original["enriched_at"]
        assert db.applied_patches == [
            {"enrichment_status": "processing"}, {"enrichment_status": "failed"},
        ]
        cleanup = db.requests[-1]
        assert cleanup.url.params["enrichment_status"] == "eq.processing"
        assert len(requests) == 1
    finally:
        db.close()


def test_concurrent_save_conflict_retries_only_database_not_provider(provider):
    requests = provider()
    db = SDKDatabase()
    db.conflict_once = True
    try:
        with TestClient(application(db)) as client:
            response = client.post("/api/v3/enrichment/deep-enrich/contact-1")
        assert response.status_code == 200, response.text
        stored = get_saved_results(db.row["enrichment_data"])
        assert stored["quick"]["data"]["contact_profile"]["headline"] == "Concurrent Quick"
        assert stored["deep"]
        assert len(requests) == 1
        assert sum("enrichment_data" in patch for patch in db.applied_patches) == 1
    finally:
        db.close()


def test_failed_status_cleanup_preserves_original_provider_error(provider):
    requests = provider(body=completion("{}"))
    db = SDKDatabase()
    db.fail_cleanup = True
    original = deepcopy(db.row["enrichment_data"])
    try:
        with TestClient(application(db)) as client:
            response = client.post("/api/v3/enrichment/deep-enrich/contact-1")
        assert response.status_code == 502
        assert "required format" in response.json()["detail"]
        assert db.row["enrichment_data"] == original
        assert len(requests) == 1
    finally:
        db.close()


def test_failure_cleanup_does_not_downgrade_a_completed_result():
    db = SDKDatabase()
    try:
        deep._mark_deep_enrichment_failed(db.client, "contact-1", "owner")
        assert db.row["enrichment_status"] == "completed"
        assert db.applied_patches == []
    finally:
        db.close()


def test_cross_owner_contact_never_calls_provider_or_writes(provider):
    requests = provider()
    db = SDKDatabase(owner="someone-else")
    try:
        with TestClient(application(db)) as client:
            response = client.post("/api/v3/enrichment/deep-enrich/contact-1")
        assert response.status_code == 404
        assert requests == []
        assert db.applied_patches == []
    finally:
        db.close()


def test_missing_api_key_does_not_touch_contact(provider, monkeypatch):
    requests = provider()
    monkeypatch.delenv("PERPLEXITY_API_KEY")
    db = SDKDatabase()
    try:
        with TestClient(application(db)) as client:
            response = client.post("/api/v3/enrichment/deep-enrich/contact-1")
        assert response.status_code == 503
        assert db.requests == []
        assert requests == []
    finally:
        db.close()
