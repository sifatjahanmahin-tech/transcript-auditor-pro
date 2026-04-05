"""
Transcript Auditor Pro — Backend Configuration.

Centralized settings using Pydantic Settings for environment-based config.
All secrets come from .env file or environment variables.
"""

from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    # ── App ──
    APP_NAME: str = "Transcript Auditor Pro"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # ── Database ──
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/audit_pro"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/audit_pro"
    DATABASE_SSL: bool = False

    # ── Auth ──
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"

    # ── OCR ──
    TESSERACT_CMD: Optional[str] = None  # Path to tesseract binary if not on PATH
    OCR_MAX_FILE_SIZE_MB: int = 10
    OCR_ALLOWED_EXTENSIONS: List[str] = [".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".pdf"]

    # ── Frontend ──
    FRONTEND_URL: str = "http://localhost:3000"

    # ── Upload ──
    MAX_UPLOAD_SIZE_MB: int = 10
    UPLOAD_DIR: str = "uploads"

    # ── Workers ──
    WORKER_COUNT: int = 4

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
