from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "WaterWatch SA API"
    database_url: str = "postgresql+psycopg://waterwatch:waterwatch@localhost:5432/waterwatch"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173"
    upload_dir: Path = Path(__file__).resolve().parents[2] / "uploads"
    max_upload_mb: int = 5
    max_attachments_per_incident: int = 3
    admin_email: str | None = None
    admin_password: str | None = None
    admin_name: str = "WaterWatch Admin"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
