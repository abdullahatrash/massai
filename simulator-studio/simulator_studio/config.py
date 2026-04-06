from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _read_env(name: str, default: str) -> str:
    return os.environ.get(name, default).strip()


@dataclass(frozen=True)
class StudioSettings:
    db_path: Path
    massai_api_base_url: str
    keycloak_url: str
    keycloak_realm: str
    keycloak_admin_username: str
    keycloak_admin_password: str
    massai_oidc_client_id: str
    massai_operator_username: str
    massai_operator_password: str
    frontend_base_url: str
    provider_factor_client_secret: str
    provider_tasowheel_client_secret: str
    provider_e4m_client_secret: str

    @classmethod
    def from_env(cls) -> "StudioSettings":
        db_path = Path(
            _read_env("SIM_STUDIO_DB_PATH", "/data/simulator-studio.db")
        ).expanduser()
        return cls(
            db_path=db_path,
            massai_api_base_url=_read_env("MASSAI_API_BASE_URL", "http://localhost:8000"),
            keycloak_url=_read_env("KEYCLOAK_URL", "http://localhost:8080"),
            keycloak_realm=_read_env("KEYCLOAK_REALM", "massai"),
            keycloak_admin_username=_read_env("KEYCLOAK_ADMIN_USERNAME", "admin"),
            keycloak_admin_password=_read_env("KEYCLOAK_ADMIN_PASSWORD", "admin"),
            massai_oidc_client_id=_read_env("MASSAI_OIDC_CLIENT_ID", "massai-frontend"),
            massai_operator_username=_read_env("MASSAI_OPERATOR_USERNAME", "admin@test.com"),
            massai_operator_password=_read_env("MASSAI_OPERATOR_PASSWORD", "password"),
            frontend_base_url=_read_env("MASSAI_FRONTEND_BASE_URL", "http://localhost:3000"),
            provider_factor_client_secret=_read_env(
                "PROVIDER_FACTOR_CLIENT_SECRET",
                "provider-factor-sa-secret",
            ),
            provider_tasowheel_client_secret=_read_env(
                "PROVIDER_TASOWHEEL_CLIENT_SECRET",
                "provider-tasowheel-sa-secret",
            ),
            provider_e4m_client_secret=_read_env(
                "PROVIDER_E4M_CLIENT_SECRET",
                "provider-e4m-sa-secret",
            ),
        )

    def provider_secret_for_client(self, client_id: str) -> str:
        mapping = {
            "provider-factor-sa": self.provider_factor_client_secret,
            "provider-tasowheel-sa": self.provider_tasowheel_client_secret,
            "provider-e4m-sa": self.provider_e4m_client_secret,
        }
        try:
            return mapping[client_id]
        except KeyError as exc:
            raise KeyError(f"No provider secret configured for client '{client_id}'.") from exc
