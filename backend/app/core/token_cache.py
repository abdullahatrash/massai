from __future__ import annotations

import asyncio
from dataclasses import dataclass
from time import time

import httpx


@dataclass(frozen=True, slots=True)
class AccessToken:
    access_token: str
    expires_at: float
    token_type: str = "Bearer"

    def is_expired(self, *, refresh_buffer_seconds: int = 30) -> bool:
        return time() >= self.expires_at - refresh_buffer_seconds


class ServiceAccountTokenCache:
    def __init__(
        self,
        *,
        token_url: str,
        client_id: str,
        client_secret: str,
        refresh_buffer_seconds: int = 30,
        timeout_seconds: float = 5.0,
    ) -> None:
        self._token_url = token_url
        self._client_id = client_id
        self._client_secret = client_secret
        self._refresh_buffer_seconds = refresh_buffer_seconds
        self._timeout_seconds = timeout_seconds
        self._lock = asyncio.Lock()
        self._cached_token: AccessToken | None = None

    async def get_access_token(self) -> str:
        if self._cached_token and not self._cached_token.is_expired(
            refresh_buffer_seconds=self._refresh_buffer_seconds,
        ):
            return self._cached_token.access_token

        async with self._lock:
            if self._cached_token and not self._cached_token.is_expired(
                refresh_buffer_seconds=self._refresh_buffer_seconds,
            ):
                return self._cached_token.access_token

            self._cached_token = await self._fetch_token()
            return self._cached_token.access_token

    async def get_authorization_header(self) -> dict[str, str]:
        token = await self.get_access_token()
        return {"Authorization": f"Bearer {token}"}

    async def _fetch_token(self) -> AccessToken:
        async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
            response = await client.post(
                self._token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                },
            )
            response.raise_for_status()

        payload = response.json()
        access_token = payload.get("access_token")
        expires_in = payload.get("expires_in")
        token_type = payload.get("token_type", "Bearer")
        if not access_token or not expires_in:
            raise RuntimeError("Keycloak token response is missing access_token or expires_in.")

        return AccessToken(
            access_token=str(access_token),
            expires_at=time() + float(expires_in),
            token_type=str(token_type),
        )
