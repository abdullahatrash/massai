from __future__ import annotations

import base64
import asyncio
import unittest
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, patch

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import Depends, FastAPI
from fastapi import HTTPException
from fastapi.testclient import TestClient
from jose import jwt

from app.core import auth
from app.core.auth import CurrentUser, get_current_user, validate_access_token
from app.core.config import Settings
from app.core.dependencies import (
    require_admin,
    require_consumer,
    require_contract_access,
    require_provider,
)


def _b64url_uint(value: int) -> str:
    raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("utf-8")


class KeyMaterial:
    def __init__(self) -> None:
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        public_numbers = private_key.public_key().public_numbers()
        self.kid = "test-key"
        self.jwks = {
            "keys": [
                {
                    "kty": "RSA",
                    "kid": self.kid,
                    "use": "sig",
                    "alg": "RS256",
                    "n": _b64url_uint(public_numbers.n),
                    "e": _b64url_uint(public_numbers.e),
                }
            ]
        }

    def issue_token(self, claims: dict[str, Any]) -> str:
        return jwt.encode(
            claims,
            self.private_pem,
            algorithm="RS256",
            headers={"kid": self.kid},
        )


class AuthTestCase(unittest.TestCase):
    def setUp(self) -> None:
        auth.clear_jwks_cache()
        self.keys = KeyMaterial()
        self.settings = Settings(
            KEYCLOAK_URL="http://keycloak:8080",
            KEYCLOAK_REALM="massai",
            KEYCLOAK_ALLOWED_AUDIENCES="massai-backend,massai-frontend",
        )
        self.now = datetime.now(UTC)

    def tearDown(self) -> None:
        auth.clear_jwks_cache()

    def _run(self, coroutine):
        return asyncio.run(coroutine)

    def _claims(self, **overrides: Any) -> dict[str, Any]:
        base_claims = {
            "sub": "user-123",
            "iss": "http://keycloak:8080/realms/massai",
            "azp": "massai-frontend",
            "email": "consumer-factor@test.com",
            "preferred_username": "consumer-factor@test.com",
            "exp": int((self.now + timedelta(minutes=5)).timestamp()),
            "iat": int(self.now.timestamp()),
            "realm_access": {"roles": ["consumer"]},
            "contract_ids": ["contract-factor-001"],
        }
        base_claims.update(overrides)
        return base_claims

    def _build_app(self) -> FastAPI:
        app = FastAPI()

        @app.get("/me")
        async def me(current_user: CurrentUser = Depends(get_current_user)) -> dict[str, Any]:
            return {
                "id": current_user.id,
                "email": current_user.email,
                "roles": list(current_user.roles),
                "contract_ids": list(current_user.contract_ids),
            }

        @app.get("/consumer")
        async def consumer_only(
            current_user: CurrentUser = Depends(require_consumer()),
        ) -> dict[str, Any]:
            return {"roles": list(current_user.roles)}

        @app.get("/provider")
        async def provider_only(
            current_user: CurrentUser = Depends(require_provider()),
        ) -> dict[str, Any]:
            return {"roles": list(current_user.roles)}

        @app.get("/admin")
        async def admin_only(
            current_user: CurrentUser = Depends(require_admin()),
        ) -> dict[str, Any]:
            return {"roles": list(current_user.roles)}

        @app.get("/contracts/{contract_id}")
        async def contract_detail(
            current_user: CurrentUser = Depends(require_contract_access()),
        ) -> dict[str, Any]:
            return {"contract_ids": list(current_user.contract_ids)}

        return app

    def test_validate_access_token_accepts_valid_consumer_token(self) -> None:
        token = self.keys.issue_token(self._claims())

        async def run_test() -> None:
            with patch("app.core.auth.fetch_jwks", AsyncMock(return_value=self.keys.jwks)):
                user = await validate_access_token(token, settings=self.settings, now=self.now.timestamp())

            self.assertEqual(user.id, "user-123")
            self.assertEqual(user.email, "consumer-factor@test.com")
            self.assertEqual(user.roles, ("consumer",))
            self.assertEqual(user.contract_ids, ("contract-factor-001",))

        self._run(run_test())

    def test_validate_access_token_rejects_expired_token(self) -> None:
        token = self.keys.issue_token(
            self._claims(exp=int((self.now - timedelta(minutes=1)).timestamp()))
        )

        async def run_test() -> None:
            with patch("app.core.auth.fetch_jwks", AsyncMock(return_value=self.keys.jwks)):
                with self.assertRaises(HTTPException) as ctx:
                    await validate_access_token(token, settings=self.settings, now=self.now.timestamp())

            self.assertEqual(ctx.exception.status_code, 401)
            self.assertEqual(ctx.exception.detail, "Token expired.")

        self._run(run_test())

    def test_validate_access_token_rejects_wrong_signature(self) -> None:
        other_keys = KeyMaterial()
        token = other_keys.issue_token(self._claims())

        async def run_test() -> None:
            with patch("app.core.auth.fetch_jwks", AsyncMock(return_value=self.keys.jwks)):
                with self.assertRaises(HTTPException) as ctx:
                    await validate_access_token(token, settings=self.settings, now=self.now.timestamp())

            self.assertEqual(ctx.exception.status_code, 401)
            self.assertEqual(ctx.exception.detail, "Invalid token signature.")

        self._run(run_test())

    def test_validate_access_token_rejects_invalid_audience(self) -> None:
        token = self.keys.issue_token(self._claims(azp="unexpected-client"))

        async def run_test() -> None:
            with patch("app.core.auth.fetch_jwks", AsyncMock(return_value=self.keys.jwks)):
                with self.assertRaises(HTTPException) as ctx:
                    await validate_access_token(token, settings=self.settings, now=self.now.timestamp())

            self.assertEqual(ctx.exception.status_code, 401)
            self.assertEqual(ctx.exception.detail, "Invalid token audience.")

        self._run(run_test())

    def test_protected_routes_enforce_auth_role_and_contract_access(self) -> None:
        app = self._build_app()
        client = TestClient(app)
        token = self.keys.issue_token(self._claims())
        provider_token = self.keys.issue_token(
            self._claims(
                realm_access={"roles": ["provider"]},
                contract_ids=["contract-factor-001"],
                email="provider-factor@test.com",
                preferred_username="provider-factor@test.com",
            )
        )
        admin_token = self.keys.issue_token(
            self._claims(
                realm_access={"roles": ["admin"]},
                contract_ids=[],
                email="admin@test.com",
                preferred_username="admin@test.com",
            )
        )

        with patch("app.core.auth.fetch_jwks", AsyncMock(return_value=self.keys.jwks)):
            missing = client.get("/me")
            consumer_ok = client.get("/consumer", headers={"Authorization": f"Bearer {token}"})
            provider_forbidden = client.get(
                "/consumer", headers={"Authorization": f"Bearer {provider_token}"}
            )
            provider_ok = client.get("/provider", headers={"Authorization": f"Bearer {provider_token}"})
            admin_ok = client.get("/admin", headers={"Authorization": f"Bearer {admin_token}"})
            contract_ok = client.get(
                "/contracts/contract-factor-001",
                headers={"Authorization": f"Bearer {token}"},
            )
            contract_forbidden = client.get(
                "/contracts/contract-e4m-001",
                headers={"Authorization": f"Bearer {token}"},
            )
            admin_contract_ok = client.get(
                "/contracts/contract-e4m-001",
                headers={"Authorization": f"Bearer {admin_token}"},
            )

        self.assertEqual(missing.status_code, 401)
        self.assertEqual(consumer_ok.status_code, 200)
        self.assertEqual(provider_forbidden.status_code, 403)
        self.assertEqual(provider_ok.status_code, 200)
        self.assertEqual(admin_ok.status_code, 200)
        self.assertEqual(contract_ok.status_code, 200)
        self.assertEqual(contract_forbidden.status_code, 403)
        self.assertEqual(admin_contract_ok.status_code, 200)
