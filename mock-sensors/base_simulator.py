from __future__ import annotations

import json
import os
import time
from datetime import UTC, datetime
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class ServiceAccountTokenProvider:
    def __init__(
        self,
        *,
        keycloak_url: str,
        keycloak_realm: str,
        client_id: str,
        client_secret: str,
        refresh_buffer_seconds: int = 30,
    ) -> None:
        self._token_url = (
            f"{keycloak_url.rstrip('/')}/realms/{keycloak_realm}/protocol/openid-connect/token"
        )
        self._client_id = client_id
        self._client_secret = client_secret
        self._refresh_buffer_seconds = refresh_buffer_seconds
        self._access_token: str | None = None
        self._expires_at: float = 0.0

    def get_access_token(self) -> str:
        now = time.time()
        if self._access_token and now < self._expires_at - self._refresh_buffer_seconds:
            return self._access_token

        request = Request(
            self._token_url,
            data=urlencode(
                {
                    "grant_type": "client_credentials",
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                }
            ).encode("utf-8"),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urlopen(request, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))

        access_token = payload.get("access_token")
        if not access_token:
            raise RuntimeError(
                f"Keycloak token response missing access_token for {self._client_id}: {payload}"
            )
        self._access_token = access_token
        self._expires_at = now + float(payload.get("expires_in", 60))
        print(json.dumps({"event": "authenticated", "client_id": self._client_id}))
        return self._access_token


def run_simulator(default_name: str) -> None:
    simulator_name = os.environ.get("SIMULATOR_NAME", default_name)
    contract_id = os.environ.get("CONTRACT_ID", f"contract-{default_name}-001")
    api_url = os.environ.get("API_URL", "http://backend:8000").rstrip("/")
    keycloak_url = os.environ.get("KEYCLOAK_URL", "http://keycloak:8080")
    keycloak_realm = os.environ.get("KEYCLOAK_REALM", "massai")
    keycloak_client_id = os.environ["KEYCLOAK_CLIENT_ID"]
    keycloak_client_secret = os.environ["KEYCLOAK_CLIENT_SECRET"]
    interval_seconds = float(os.environ.get("INTERVAL_SECONDS", "15"))
    token_provider = ServiceAccountTokenProvider(
        keycloak_url=keycloak_url,
        keycloak_realm=keycloak_realm,
        client_id=keycloak_client_id,
        client_secret=keycloak_client_secret,
    )

    while True:
        payload = {
            "simulator": simulator_name,
            "contract_id": contract_id,
            "timestamp": datetime.now(UTC).isoformat(),
            "client_id": keycloak_client_id,
        }
        try:
            token = token_provider.get_access_token()
            request = Request(
                f"{api_url}/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
                method="GET",
            )
            with urlopen(request, timeout=5) as response:
                backend_status = response.status
                backend_payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            backend_status = exc.code
            backend_payload = {"error": exc.reason}
        except URLError as exc:
            backend_status = f"unreachable ({exc.reason})"
            backend_payload = {}
        except Exception as exc:
            backend_status = f"error ({type(exc).__name__})"
            backend_payload = {"detail": str(exc)}

        print(
            json.dumps(
                {
                    "event": "heartbeat",
                    "backend_status": backend_status,
                    "backend_payload": backend_payload,
                    **payload,
                }
            )
        )
        time.sleep(interval_seconds)
