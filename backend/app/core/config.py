from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        enable_decoding=False,
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
