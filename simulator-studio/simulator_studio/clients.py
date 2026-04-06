from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from .config import StudioSettings


class HttpError(RuntimeError):
    pass


def _http_json(
    method: str,
    url: str,
    *,
    token: str | None = None,
    payload: dict[str, Any] | None = None,
    form: dict[str, str] | None = None,
    expected: tuple[int, ...] = (200,),
) -> Any:
    headers: dict[str, str] = {"Accept": "application/json"}
    data = None

    if token:
        headers["Authorization"] = f"Bearer {token}"

    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    elif form is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        data = urlencode(form).encode("utf-8")

    request = Request(url, method=method, headers=headers, data=data)
    try:
        with urlopen(request, timeout=20) as response:
            status_code = response.getcode()
            body = response.read().decode("utf-8").strip()
    except Exception as exc:
        raise HttpError(f"{method} {url} failed: {exc}") from exc

    if status_code not in expected:
        raise HttpError(f"{method} {url} returned unexpected status {status_code}: {body}")
    if not body:
        return None
    return json.loads(body)


def merge_contract_ids(existing_values: list[str], contract_id: str) -> list[str]:
    merged = [value for value in existing_values if value]
    if contract_id not in merged:
        merged.append(contract_id)
    return merged


@dataclass
class _CachedToken:
    access_token: str
    expires_at: float


class OidcPasswordTokenProvider:
    def __init__(
        self,
        *,
        keycloak_url: str,
        realm: str,
        client_id: str,
        username: str,
        password: str,
    ) -> None:
        self._token_url = f"{keycloak_url.rstrip('/')}/realms/{realm}/protocol/openid-connect/token"
        self._client_id = client_id
        self._username = username
        self._password = password
        self._cached: _CachedToken | None = None

    def get_access_token(self) -> str:
        now = time.time()
        if self._cached and now < self._cached.expires_at - 30:
            return self._cached.access_token

        token_response = _http_json(
            "POST",
            self._token_url,
            form={
                "client_id": self._client_id,
                "grant_type": "password",
                "username": self._username,
                "password": self._password,
            },
        )
        access_token = str(token_response["access_token"])
        expires_in = float(token_response.get("expires_in", 60))
        self._cached = _CachedToken(access_token=access_token, expires_at=now + expires_in)
        return access_token


class ServiceAccountTokenProvider:
    def __init__(
        self,
        *,
        keycloak_url: str,
        realm: str,
        client_id: str,
        client_secret: str,
    ) -> None:
        self._token_url = f"{keycloak_url.rstrip('/')}/realms/{realm}/protocol/openid-connect/token"
        self._client_id = client_id
        self._client_secret = client_secret
        self._cached: _CachedToken | None = None

    def get_access_token(self) -> str:
        now = time.time()
        if self._cached and now < self._cached.expires_at - 30:
            return self._cached.access_token
        token_response = _http_json(
            "POST",
            self._token_url,
            form={
                "grant_type": "client_credentials",
                "client_id": self._client_id,
                "client_secret": self._client_secret,
            },
        )
        access_token = str(token_response["access_token"])
        expires_in = float(token_response.get("expires_in", 60))
        self._cached = _CachedToken(access_token=access_token, expires_at=now + expires_in)
        return access_token


class MassaiClient:
    def __init__(self, settings: StudioSettings) -> None:
        self._settings = settings
        self._token_provider = OidcPasswordTokenProvider(
            keycloak_url=settings.keycloak_url,
            realm=settings.keycloak_realm,
            client_id=settings.massai_oidc_client_id,
            username=settings.massai_operator_username,
            password=settings.massai_operator_password,
        )
        self._provider_tokens: dict[str, ServiceAccountTokenProvider] = {}

    def _token(self) -> str:
        return self._token_provider.get_access_token()

    def list_ingest_profiles(self) -> list[dict[str, Any]]:
        payload = _http_json(
            "GET",
            f"{self._settings.massai_api_base_url.rstrip('/')}/api/v2/admin/ingest-profiles",
            token=self._token(),
        )
        return list(payload.get("data") or [])

    def create_ingest_profile(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = _http_json(
            "POST",
            f"{self._settings.massai_api_base_url.rstrip('/')}/api/v2/admin/ingest-profiles",
            token=self._token(),
            payload=payload,
            expected=(201,),
        )
        return dict(response.get("data") or {})

    def create_demo_contract(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = _http_json(
            "POST",
            f"{self._settings.massai_api_base_url.rstrip('/')}/api/v2/admin/demo/contracts",
            token=self._token(),
            payload=payload,
            expected=(201,),
        )
        return dict(response.get("data") or {})

    def get_contract_ingest_spec(self, contract_id: str) -> dict[str, Any]:
        response = _http_json(
            "GET",
            f"{self._settings.massai_api_base_url.rstrip('/')}/api/v2/admin/contracts/{quote(contract_id, safe='')}/ingest-spec",
            token=self._token(),
        )
        return dict(response.get("data") or {})

    def ingest_update(
        self,
        *,
        contract_id: str,
        client_id: str,
        client_secret: str,
        body: dict[str, Any],
    ) -> dict[str, Any]:
        provider = self._provider_tokens.get(client_id)
        if provider is None:
            provider = ServiceAccountTokenProvider(
                keycloak_url=self._settings.keycloak_url,
                realm=self._settings.keycloak_realm,
                client_id=client_id,
                client_secret=client_secret,
            )
            self._provider_tokens[client_id] = provider
        response = _http_json(
            "POST",
            f"{self._settings.massai_api_base_url.rstrip('/')}/api/v2/ingest/{quote(contract_id, safe='')}",
            token=provider.get_access_token(),
            payload=body,
        )
        return dict(response.get("data") or {})


class KeycloakAdminClient:
    def __init__(self, settings: StudioSettings) -> None:
        self._settings = settings
        self._cached: _CachedToken | None = None

    def _admin_token(self) -> str:
        now = time.time()
        if self._cached and now < self._cached.expires_at - 30:
            return self._cached.access_token
        token_response = _http_json(
            "POST",
            f"{self._settings.keycloak_url.rstrip('/')}/realms/master/protocol/openid-connect/token",
            form={
                "client_id": "admin-cli",
                "grant_type": "password",
                "username": self._settings.keycloak_admin_username,
                "password": self._settings.keycloak_admin_password,
            },
        )
        access_token = str(token_response["access_token"])
        expires_in = float(token_response.get("expires_in", 60))
        self._cached = _CachedToken(access_token=access_token, expires_at=now + expires_in)
        return access_token

    def _realm_url(self, suffix: str) -> str:
        return f"{self._settings.keycloak_url.rstrip('/')}/admin/realms/{self._settings.keycloak_realm}{suffix}"

    def allow_service_account_contract(self, client_id: str, contract_id: str) -> None:
        token = self._admin_token()
        clients = _http_json(
            "GET",
            self._realm_url(f"/clients?clientId={quote(client_id, safe='')}"),
            token=token,
        )
        if not clients:
            raise HttpError(f"Keycloak client '{client_id}' not found.")
        internal_id = str(clients[0]["id"])
        service_user = _http_json(
            "GET",
            self._realm_url(f"/clients/{internal_id}/service-account-user"),
            token=token,
        )
        user_id = str(service_user["id"])
        current_user = _http_json(
            "GET",
            self._realm_url(f"/users/{user_id}"),
            token=token,
        )
        attributes = dict(current_user.get("attributes") or {})
        contract_ids = merge_contract_ids(
            list(attributes.get("contract_ids") or []),
            contract_id,
        )
        current_user["attributes"] = {**attributes, "contract_ids": contract_ids}
        _http_json(
            "PUT",
            self._realm_url(f"/users/{user_id}"),
            token=token,
            payload=current_user,
            expected=(204,),
        )
