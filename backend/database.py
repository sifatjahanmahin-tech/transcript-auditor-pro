"""
Database models and session management.

Uses SQLAlchemy 2.0 async with asyncpg for PostgreSQL.
All models use UUID primary keys for security and scalability.
"""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
    create_engine,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, relationship

from backend.config import get_settings

settings = get_settings()

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# ── Async Engine ──
if _is_sqlite:
    _connect_args = {"check_same_thread": False}
    async_engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        connect_args=_connect_args,
    )
else:
    _ssl_args: dict[str, Any] = {"ssl": "require"} if settings.DATABASE_SSL else {"ssl": False}
    async_engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_size=5,
        max_overflow=5,
        pool_pre_ping=True,
        connect_args=_ssl_args,
    )

async_session_factory = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ── Sync engine for Alembic migrations ──
if _is_sqlite:
    sync_engine = create_engine(
        settings.DATABASE_URL_SYNC, echo=settings.DEBUG, connect_args={"check_same_thread": False}
    )
else:
    _sync_ssl_args = {"sslmode": "require"} if settings.DATABASE_SSL else {}
    sync_engine = create_engine(settings.DATABASE_URL_SYNC, echo=settings.DEBUG, connect_args=_sync_ssl_args)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields async DB session, auto-closes."""
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


# ── Base ──
class Base(DeclarativeBase):
    """Declarative base for all ORM models."""

    pass


# ═══════════════════════════════════════════════
# User Model
# ═══════════════════════════════════════════════
class User(Base):
    __tablename__ = "users"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(320), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    picture = Column(Text, nullable=True)
    google_sub = Column(String(255), unique=True, nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    audit_records = relationship("AuditRecord", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User {self.email}>"


# ═══════════════════════════════════════════════
# Audit Record Model — stores history of every scan/audit
# ═══════════════════════════════════════════════
class AuditRecord(Base):
    __tablename__ = "audit_records"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Input metadata
    input_type = Column(String(20), nullable=False)  # "csv", "image", "ocr"
    original_filename = Column(String(512), nullable=True)
    program_name = Column(String(255), nullable=False)

    # Audit results (stored as JSON for flexibility)
    total_valid_credits = Column(Float, default=0.0)
    cgpa = Column(Float, default=0.0)
    on_probation = Column(Boolean, default=False)
    credit_breakdown = Column(JSON, nullable=True)
    missing_courses = Column(JSON, nullable=True)
    completed_courses = Column(JSON, nullable=True)
    waived_courses = Column(JSON, nullable=True)

    # Raw parsed data for re-processing
    parsed_entries = Column(JSON, nullable=True)
    ocr_raw_text = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    # Relationships
    user = relationship("User", back_populates="audit_records")

    def __repr__(self) -> str:
        return f"<AuditRecord {self.id} user={self.user_id} type={self.input_type}>"


# ═══════════════════════════════════════════════
# Program Template — cached program definitions
# ═══════════════════════════════════════════════
class ProgramTemplate(Base):
    __tablename__ = "program_templates"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), unique=True, nullable=False, index=True)
    total_required_credits = Column(Integer, default=0)
    mandatory_courses = Column(JSON, nullable=False)  # {category: [course_codes]}
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        return f"<ProgramTemplate {self.name}>"
