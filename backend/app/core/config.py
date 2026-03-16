from __future__ import annotations

import json
from functools import lru_cache

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_list_str(value: str | list[str]) -> list[str]:
    if isinstance(value, list):
        return value
    if not value:
        return []
    s = str(value).strip()
    if s.startswith("["):
        try:
            parsed = json.loads(s)
            return [str(x).strip() for x in parsed] if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            pass
    return [item.strip() for item in s.split(",") if item.strip()]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_name: str = "MaaSAI Monitoring API"
    api_version: str = "1"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"
    blockchain_adapter: str = "mock"
    database_url: str = Field(
        default="postgresql+asyncpg://massai:massai@postgres:5432/massai_monitoring",
        alias="DATABASE_URL",
    )
    keycloak_url: str = Field(default="http://keycloak:8080", alias="KEYCLOAK_URL")
    keycloak_realm: str = Field(default="massai", alias="KEYCLOAK_REALM")
    keycloak_valid_issuers_raw: str = Field(
        default="",
        alias="KEYCLOAK_VALID_ISSUERS",
    )
    keycloak_backend_client_id: str = Field(
        default="massai-backend",
        alias="KEYCLOAK_BACKEND_CLIENT_ID",
    )
    keycloak_frontend_client_id: str = Field(
        default="massai-frontend",
        alias="KEYCLOAK_FRONTEND_CLIENT_ID",
    )
    keycloak_allowed_audiences: list[str] = Field(
        default_factory=lambda: [
            "account",
            "massai-backend",
            "massai-frontend",
            "provider-factor-sa",
            "provider-tasowheel-sa",
            "provider-e4m-sa",
        ],
        alias="KEYCLOAK_ALLOWED_AUDIENCES",
    )
    keycloak_jwks_cache_ttl_seconds: int = Field(
        default=600,
        alias="KEYCLOAK_JWKS_CACHE_TTL_SECONDS",
    )
    cors_origins_raw: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="BACKEND_CORS_ORIGINS",
        exclude=True,
    )

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        return _parse_list_str(self.cors_origins_raw)

    @computed_field
    @property
    def keycloak_valid_issuers(self) -> list[str]:
        parsed = _parse_list_str(self.keycloak_valid_issuers_raw)
        if parsed:
            return parsed
        realm_url = f"{self.keycloak_url.rstrip('/')}/realms/{self.keycloak_realm}"
        return [realm_url]

    no_data_worker_enabled: bool = Field(default=True, alias="NO_DATA_WORKER_ENABLED")
    no_data_check_interval_seconds: int = Field(
        default=300,
        alias="NO_DATA_CHECK_INTERVAL_SECONDS",
    )
    smtp_host: str | None = Field(default=None, alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_username: str | None = Field(default=None, alias="SMTP_USERNAME")
    smtp_password: str | None = Field(default=None, alias="SMTP_PASSWORD")
    smtp_from_email: str | None = Field(default=None, alias="SMTP_FROM_EMAIL")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")
    sql_echo: bool = False


    @field_validator("keycloak_allowed_audiences", mode="before")
    @classmethod
    def parse_allowed_audiences(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        if not value:
            return []
        return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
