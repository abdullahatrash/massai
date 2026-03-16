from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"],
        alias="BACKEND_CORS_ORIGINS",
    )
    sql_echo: bool = False

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        if not value:
            return []
        return [item.strip() for item in value.split(",") if item.strip()]

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
