"""Saved-results regression tests; no live provider/database credentials."""

from copy import deepcopy
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.enrichment_v3.saved_results import (
    get_saved_results, merge_saved_result, persist_saved_result,
)
from app.enrichment_v3.models import UnifiedEnrichmentResult, EnrichmentMeta
from app.enrichment_v3 import saved_results_router as read_router


def snapshot(mode, marker="original"):
    unified = UnifiedEnrichmentResult(
        contact_id="contact-1", meta=EnrichmentMeta(source=mode),
    ).model_dump()
    unified["contact_profile"]["headline"] = f"{mode}-{marker}"
    return {"mode": mode, "data": unified, "legacy": {"summary": marker} if mode == "quick" else None}


class FakeDB:
    """Models equality/owner filters, returning representations and a lost CAS."""
    def __init__(self, value=None, user_id="owner"):
        self.row = {"id": "contact-1", "user_id": user_id, "enrichment_data": deepcopy(value)}
        self.next_conflict = None
        self.always_conflict = False
        self.writes = 0

    def table(self, table):
        assert table == "contacts"
        return Query(self)


class Query:
    def __init__(self, db):
        self.db, self.filters, self.patch = db, {}, None

    def select(self, columns):
        return self

    def update(self, patch):
        self.patch = patch
        return self

    def eq(self, key, value):
        self.filters[key] = json.loads(value) if key == "enrichment_data" else value
        return self

    def is_(self, key, value):
        assert key == "enrichment_data" and value == "null"
        self.filters[key] = None
        return self

    def execute(self):
        if self.patch is not None and self.db.next_conflict is not None:
            self.db.row["enrichment_data"] = self.db.next_conflict
            self.db.next_conflict = None
        if any(self.db.row.get(key) != value for key, value in self.filters.items()):
            return SimpleNamespace(data=[])
        if self.patch is not None:
            if self.db.always_conflict:
                return SimpleNamespace(data=[])
            self.db.row.update(deepcopy(self.patch))
            self.db.writes += 1
        return SimpleNamespace(data=[deepcopy(self.db.row)])


@pytest.mark.parametrize("value", [None, {}, "", [], 1])
def test_empty_values(value):
    assert get_saved_results(value) == {"quick": None, "deep": None}


@pytest.mark.parametrize("mode", ["quick", "deep"])
def test_legacy_mode_is_classified_without_duplicate(mode):
    data = snapshot(mode)
    assert get_saved_results(data)[mode] == data
    assert get_saved_results(data)["deep" if mode == "quick" else "quick"] is None
    assert get_saved_results(data["data"])[mode] == data["data"]


def test_unknown_legacy_not_invented_as_deep():
    assert get_saved_results({"data": {"contact_profile": {"headline": "unknown"}}}) == {
        "quick": None, "deep": None,
    }


@pytest.mark.parametrize("first,second", [("quick", "deep"), ("deep", "quick")])
def test_both_orders_and_refresh_preserve_other_mode(first, second):
    db = FakeDB()
    persist_saved_result(db, "contact-1", first, snapshot(first), "owner")
    persist_saved_result(db, "contact-1", second, snapshot(second), "owner")
    before = deepcopy(get_saved_results(db.row["enrichment_data"])[second])
    stored = persist_saved_result(db, "contact-1", first, snapshot(first, "refreshed"), "owner")
    assert get_saved_results(stored)[second] == before
    assert get_saved_results(stored)[first]["data"]["contact_profile"]["headline"] == f"{first}-refreshed"
    assert stored["mode"] == first
    assert stored["data"]["contact_profile"]["headline"] == f"{first}-refreshed"
    assert all("saved_results" not in entry for entry in stored["saved_results"].values())


def test_legacy_quick_migrates_on_deep_save():
    original = snapshot("quick")
    db = FakeDB(original)
    stored = persist_saved_result(db, "contact-1", "deep", snapshot("deep"), "owner")
    assert stored["saved_results"]["quick"] == original


def test_cas_retries_merge_concurrent_completion():
    db = FakeDB()
    concurrent = merge_saved_result(None, "deep", snapshot("deep", "concurrent"))
    db.next_conflict = concurrent
    stored = persist_saved_result(db, "contact-1", "quick", snapshot("quick"), "owner")
    assert stored["saved_results"]["deep"] == concurrent["saved_results"]["deep"]
    assert stored["saved_results"]["quick"]
    assert db.writes == 1


def test_continuous_conflicts_fail_without_overwrite():
    db = FakeDB(snapshot("deep"))
    old = deepcopy(db.row)
    db.always_conflict = True
    with pytest.raises(HTTPException) as error:
        persist_saved_result(db, "contact-1", "quick", snapshot("quick"), "owner")
    assert error.value.status_code == 409
    assert db.row == old


def test_owner_filter_prevents_save():
    db = FakeDB(user_id="someone-else")
    with pytest.raises(HTTPException) as error:
        persist_saved_result(db, "contact-1", "quick", snapshot("quick"), "owner")
    assert error.value.status_code == 404
    assert db.writes == 0


def test_merge_does_not_mutate_inputs():
    old, new = snapshot("quick"), snapshot("deep")
    copies = deepcopy((old, new))
    merge_saved_result(old, "deep", new)
    assert (old, new) == copies


def test_saved_get_is_read_only_and_sanitized():
    quick = snapshot("quick")
    quick["raw_provider_response"] = "secret raw body"
    db = FakeDB(merge_saved_result(quick, "deep", snapshot("deep")))
    application = FastAPI()
    application.include_router(read_router.router)
    application.dependency_overrides[read_router.get_current_user] = lambda: SimpleNamespace(id="owner")
    application.dependency_overrides[read_router.get_supabase] = lambda: db
    with TestClient(application) as client:
        response = client.get("/api/v3/enrichment/saved/contact-1")
    assert response.status_code == 200
    assert all(response.json()["saved_results"][mode] for mode in ("quick", "deep"))
    assert "secret raw body" not in response.text
    assert db.writes == 0


def test_saved_get_unauthenticated():
    application = FastAPI()
    application.include_router(read_router.router)
    application.dependency_overrides[read_router.get_supabase] = lambda: FakeDB()
    with TestClient(application) as client:
        assert client.get("/api/v3/enrichment/saved/contact-1").status_code == 401


@pytest.mark.parametrize("order", [("quick", "deep"), ("deep", "quick")])
def test_actual_routes_preserve_both_modes(monkeypatch, order):
    from app.enrichment_v3 import enrich_simple as quick_route
    from app.routers import enrichment_v3_deep as deep_route

    db = FakeDB()
    # These provider responses are mocked, but both actual router functions,
    # schema transformations, and database persistence execute.
    monkeypatch.setenv("PERPLEXITY_API_KEY", "test-only")
    monkeypatch.setattr(quick_route, "call_perplexity_with_retry", AsyncMock(return_value={
        "parsed_payload": {}, "model": "sonar-pro", "raw_provider_response": {},
    }))
    monkeypatch.setattr(deep_route, "call_perplexity_deep_research", AsyncMock(return_value={
        "parsed_payload": {}, "model": "sonar-pro", "raw_provider_response": {},
    }))
    import asyncio
    user = SimpleNamespace(id="owner")
    for mode in order:
        function = quick_route.quick_enrich_contact if mode == "quick" else deep_route.trigger_deep_enrichment
        response = asyncio.run(function(contact_id="contact-1", user=user, supabase=db))
        assert response.status == "completed"
    assert all(get_saved_results(db.row["enrichment_data"]).values())
    # Deep GET must still serve the saved Deep even when Quick is latest.
    result = asyncio.run(deep_route.deep_enrich_result("contact-1", user, db))
    assert result.meta.source == "deep"


@pytest.mark.parametrize("initial", [None, {}, snapshot("deep")])
def test_real_postgrest_cas_request_contract(initial):
    """Actual installed SDK serializes null/JSONB guard and returns a row."""
    import httpx
    from postgrest import SyncPostgrestClient
    requests = []
    merged = merge_saved_result(initial, "quick", snapshot("quick"))

    def handler(request):
        requests.append(request)
        if request.method == "GET":
            return httpx.Response(200, json=[{"id": "contact-1", "enrichment_data": initial}])
        assert request.method == "PATCH"
        assert request.url.params["id"] == "eq.contact-1"
        assert request.url.params["user_id"] == "eq.owner"
        guard = request.url.params["enrichment_data"]
        if initial is None:
            assert guard == "is.null"
        else:
            assert json.loads(guard.removeprefix("eq.")) == initial
        assert "return=representation" in request.headers["prefer"]
        return httpx.Response(200, json=[{"id": "contact-1", "enrichment_data": merged}])

    client = SyncPostgrestClient("https://example.invalid/rest/v1")
    client.session.close()
    client.session = httpx.Client(
        base_url="https://example.invalid/rest/v1", transport=httpx.MockTransport(handler)
    )
    try:
        persist_saved_result(client, "contact-1", "quick", snapshot("quick"), "owner")
    finally:
        client.session.close()
    assert [request.method for request in requests] == ["GET", "PATCH"]


def test_real_application_registers_saved_get(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    from app.main import app
    routes = [route for route in app.routes if getattr(route, "path", "") ==
              "/api/v3/enrichment/saved/{contact_id}"]
    assert len(routes) == 1
    assert routes[0].methods == {"GET"}
