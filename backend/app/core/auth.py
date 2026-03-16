from __future__ import annotations

import asyncio
from dataclasses import dataclass
from time import time
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwk, jwt
from jose.exceptions import JOSEError
from jose.utils import base64url_decode

from app.core.config import Settings, get_settings

bearer_scheme = HTTPBearer(auto_error=False)
_jwks_lock = asyncio.Lock()
_jwks_cache: dict[str, Any] | None = None
_jwks_cached_at: float = 0.0


@dataclass(frozen=True, slots=True)
class CurrentUser:
    id: str
    email: str | None
    roles: tuple[str, ...]
    contract_ids: tuple[str, ...]
    preferred_username: str | None = None

    @property
    def is_admin(self) -> bool:
        return "admin" in self.roles

    def has_role(self, *required_roles: str) -> bool:
        return any(role in self.roles for role in required_roles)

    def can_access_contract(self, contract_id: str) -> bool:
        return self.is_admin or contract_id in self.contract_ids


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=detail,
    )


def _service_unavailable(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=detail,
    )


def clear_jwks_cache() -> None:
    global _jwks_cache, _jwks_cached_at
    _jwks_cache = None
    _jwks_cached_at = 0.0


def _realm_url(settings: Settings) -> str:
    return f"{settings.keycloak_url.rstrip('/')}/realms/{settings.keycloak_realm}"


def _jwks_url(settings: Settings) -> str:
    return f"{_realm_url(settings)}/protocol/openid-connect/certs"


async def fetch_jwks(settings: Settings) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(_jwks_url(settings))
        response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict) or "keys" not in payload:
        raise _service_unavailable("Authentication service returned an invalid JWKS payload.")
    return payload


async def get_jwks(*, settings: Settings | None = None, force_refresh: bool = False) -> dict[str, Any]:
    global _jwks_cache, _jwks_cached_at

    settings = settings or get_settings()
    now = time()
    cache_valid = (
        _jwks_cache is not None
        and not force_refresh
        and now - _jwks_cached_at < settings.keycloak_jwks_cache_ttl_seconds
    )
    if cache_valid:
        return _jwks_cache

    async with _jwks_lock:
        now = time()
        cache_valid = (
            _jwks_cache is not None
            and not force_refresh
            and now - _jwks_cached_at < settings.keycloak_jwks_cache_ttl_seconds
        )
        if cache_valid:
            return _jwks_cache
        try:
            _jwks_cache = await fetch_jwks(settings)
            _jwks_cached_at = now
        except HTTPException:
            raise
        except httpx.HTTPError as exc:
            raise _service_unavailable("Authentication service unavailable.") from exc
        return _jwks_cache


def _extract_signing_key_id(token: str) -> tuple[str, str]:
    try:
        header = jwt.get_unverified_header(token)
    except JOSEError as exc:
        raise _unauthorized("Invalid token header.") from exc

    kid = header.get("kid")
    if not kid:
        raise _unauthorized("Token is missing a key identifier.")
    algorithm = header.get("alg")
    if not algorithm:
        raise _unauthorized("Token is missing an algorithm.")
    return str(kid), str(algorithm)


def _find_signing_key(kid: str, jwks_payload: dict[str, Any]) -> dict[str, Any] | None:
    for key_data in jwks_payload.get("keys", []):
        if key_data.get("kid") == kid:
            return key_data
    return None


def _verify_signature(token: str, key_data: dict[str, Any], algorithm: str) -> None:
    try:
        message, encoded_signature = token.rsplit(".", 1)
        decoded_signature = base64url_decode(encoded_signature.encode("utf-8"))
        key = jwk.construct(key_data, algorithm=algorithm)
    except Exception as exc:  # pragma: no cover - defensive parsing
        raise _unauthorized("Invalid token signature.") from exc

    if not key.verify(message.encode("utf-8"), decoded_signature):
        raise _unauthorized("Invalid token signature.")


def _normalize_roles(claims: dict[str, Any]) -> tuple[str, ...]:
    realm_access = claims.get("realm_access", {})
    if not isinstance(realm_access, dict):
        return ()
    roles = realm_access.get("roles", [])
    if not isinstance(roles, list):
        return ()
    return tuple(str(role) for role in roles)


def _normalize_contract_ids(claims: dict[str, Any]) -> tuple[str, ...]:
    contract_ids = claims.get("contract_ids", [])
    if isinstance(contract_ids, str):
        return (contract_ids,)
    if not isinstance(contract_ids, list):
        return ()
    return tuple(str(contract_id) for contract_id in contract_ids)


def _validate_issuer(claims: dict[str, Any], settings: Settings) -> None:
    expected_issuer = _realm_url(settings)
    if claims.get("iss") != expected_issuer:
        raise _unauthorized("Invalid token issuer.")


def _validate_expiry(claims: dict[str, Any], *, now: float | None = None) -> None:
    if now is None:
        now = time()
    exp = claims.get("exp")
    if exp is None:
        raise _unauthorized("Token is missing an expiry.")
    if float(exp) <= now:
        raise _unauthorized("Token expired.")

    nbf = claims.get("nbf")
    if nbf is not None and float(nbf) > now:
        raise _unauthorized("Token is not active yet.")


def _validate_audience(claims: dict[str, Any], settings: Settings) -> None:
    allowed_audiences = set(settings.keycloak_allowed_audiences)
    aud_claim = claims.get("aud")
    if isinstance(aud_claim, str):
        token_audiences = {aud_claim}
    elif isinstance(aud_claim, list):
        token_audiences = {str(item) for item in aud_claim}
    else:
        token_audiences = set()

    if token_audiences:
        if allowed_audiences.intersection(token_audiences):
            return
        raise _unauthorized("Invalid token audience.")

    authorized_party = claims.get("azp")
    if authorized_party in allowed_audiences:
        return
    raise _unauthorized("Invalid token audience.")


async def validate_access_token(
    token: str,
    *,
    settings: Settings | None = None,
    now: float | None = None,
) -> CurrentUser:
    settings = settings or get_settings()
    jwks_payload = await get_jwks(settings=settings)
    kid, algorithm = _extract_signing_key_id(token)
    key_data = _find_signing_key(kid, jwks_payload)
    if key_data is None:
        jwks_payload = await get_jwks(settings=settings, force_refresh=True)
        key_data = _find_signing_key(kid, jwks_payload)
    if key_data is None:
        raise _unauthorized("Unable to find a matching signing key for token.")

    _verify_signature(token, key_data, algorithm)

    try:
        claims = jwt.get_unverified_claims(token)
    except JOSEError as exc:
        raise _unauthorized("Invalid token payload.") from exc

    _validate_expiry(claims, now=now)
    _validate_issuer(claims, settings)
    _validate_audience(claims, settings)

    subject = claims.get("sub")
    if not subject:
        raise _unauthorized("Token is missing a subject.")

    return CurrentUser(
        id=str(subject),
        email=claims.get("email"),
        roles=_normalize_roles(claims),
        contract_ids=_normalize_contract_ids(claims),
        preferred_username=claims.get("preferred_username"),
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise _unauthorized("Missing bearer token.")
    if credentials.scheme.lower() != "bearer":
        raise _unauthorized("Invalid authentication scheme.")
    return await validate_access_token(credentials.credentials)
