"""
Transcript Auditor Pro — Backend Configuration.

Centralized settings using Pydantic Settings for environment-based config.
All secrets come from .env file or environment variables.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    # ── App ──
    APP_NAME: str = "Transcript Auditor Pro"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = [
        "https://transcript-auditor-pro.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://10.0.2.2:8000",
        "exp://localhost:8081",
    ]

    # ── Database ──
    DATABASE_URL: str = "sqlite+aiosqlite:///./audit_pro.db"
    DATABASE_URL_SYNC: str = "sqlite:///./audit_pro.db"
    DATABASE_SSL: bool = False

    # ── Auth ──
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"  # Override via env var in prod
    # Mobile OAuth callback — must match what's registered in Google Cloud Console
    # Use your machine's LAN IP so the emulator/device browser can reach it
    MOBILE_REDIRECT_URI: str = "http://192.168.110.118:8000/api/auth/google/callback"

    # ── OCR ──
    TESSERACT_CMD: str | None = None  # Path to tesseract binary if not on PATH
    OCR_MAX_FILE_SIZE_MB: int = 10
    OCR_ALLOWED_EXTENSIONS: list[str] = [".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".pdf"]

    # ── Frontend ──
    FRONTEND_URL: str = "https://transcript-auditor-pro.vercel.app"

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


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
