from __future__ import annotations

import sys
from collections.abc import Iterator
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parent.parent

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture(scope="session")
def backend_root() -> Path:
    return BACKEND_ROOT


@pytest.fixture
def healthy_dependency_payload() -> dict[str, str]:
    return {
        "status": "ok",
        "db": "ok",
        "auth": "ok",
        "environment": "test",
    }


@pytest.fixture
def degraded_dependency_payload() -> dict[str, str]:
    return {
        "status": "degraded",
        "db": "unreachable",
        "auth": "ok",
        "environment": "test",
    }


@pytest.fixture(autouse=True)
def clear_auth_caches() -> Iterator[None]:
    from app.core import auth

    auth.clear_jwks_cache()
    yield
    auth.clear_jwks_cache()


@pytest.fixture
def app_client(healthy_dependency_payload: dict[str, str]) -> Iterator[TestClient]:
    from app.main import app

    with (
        patch(
            "app.core.health.get_dependency_health",
            AsyncMock(return_value=healthy_dependency_payload),
        ),
        patch(
            "app.main.get_dependency_health",
            AsyncMock(return_value=healthy_dependency_payload),
        ),
        TestClient(app) as client,
    ):
        yield client
