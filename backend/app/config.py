import os
from pathlib import Path

from dotenv import dotenv_values
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    reset_token_expire_minutes: int = 30

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"

    frontend_url: str = "http://localhost:5173"
    environment: str = "development"
    smtp_host: str = ""
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str = ""
    smtp_password: str = ""
    email_from: str = ""
    log_reset_links: bool = False

    # Rate limits are environment-configurable so production deployments can
    # tune them without changing application code.
    auth_ip_per_minute: int = Field(default=20, ge=1, le=1000)
    auth_account_per_minute: int = Field(default=8, ge=1, le=1000)
    auth_base_backoff_seconds: int = Field(default=1, ge=0, le=3600)
    auth_max_backoff_seconds: int = Field(default=300, ge=1, le=86400)
    public_requests_per_minute: int = Field(default=60, ge=1, le=10000)
    authenticated_reads_per_minute: int = Field(default=120, ge=1, le=10000)
    authenticated_writes_per_minute: int = Field(default=60, ge=1, le=10000)
    rate_limit_window_seconds: int = Field(default=60, ge=1, le=3600)
    rate_limit_bucket_ttl_seconds: int = Field(default=7200, ge=60, le=86400)

    # Resolve this from the source file rather than the process working
    # directory. This keeps `python -m uvicorn app.main:app` pointed at
    # backend/.env even when Uvicorn is launched from another directory.
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8")


settings = Settings()


def database_config_source() -> str:
    """Describe where DATABASE_URL came from without exposing credentials."""
    file_value = dotenv_values(ENV_FILE).get("DATABASE_URL") if ENV_FILE.exists() else None
    environment_value = os.environ.get("DATABASE_URL")
    if environment_value and file_value and environment_value != file_value:
        return "process environment (overrides backend/.env)"
    if environment_value:
        return "process environment"
    if file_value:
        return str(ENV_FILE)
    return "Pydantic settings/defaults"
