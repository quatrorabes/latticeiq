"""Check both installed PostgreSQL drivers without connecting to a database."""

import os
from pathlib import Path
import subprocess
import sys

import pytest


@pytest.mark.parametrize("driver", ["psycopg", "psycopg2"])
def test_application_starts_with_selected_postgresql_driver(driver):
    backend = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    # Do not inherit real credentials or make database/provider requests.
    for name in tuple(env):
        if name.startswith(("SUPABASE_", "PERPLEXITY_", "OPENAI_")):
            env.pop(name)
    env.update({
        "PYTHONPATH": str(backend),
        "DATABASE_URL": (
            f"postgresql+{driver}://postgres:password@127.0.0.1:5432/latticeiq"
        ),
    })
    code = """
from app.database import engine
from app.main import app
from fastapi.testclient import TestClient
import sys

assert engine.dialect.driver == sys.argv[1]
assert "/api/v3/enrichment/saved/{contact_id}" in app.openapi()["paths"]
with TestClient(app) as client:
    assert client.get("/health").status_code == 200
    assert client.get("/api/v3/enrichment/saved/example-contact").status_code == 401
print("startup and saved-results authorization passed")
"""
    result = subprocess.run(
        [sys.executable, "-c", code, driver],
        cwd=backend, env=env, capture_output=True, text=True, timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "startup and saved-results authorization passed" in result.stdout
