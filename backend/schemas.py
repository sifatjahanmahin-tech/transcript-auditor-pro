"""
Pydantic schemas for API request/response validation.

Separates input (Create), output (Response), and internal (DB) schemas
following FastAPI best practices.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════
# Auth Schemas
# ═══════════════════════════════════════════════
class TokenResponse(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class GoogleAuthURL(BaseModel):
    """Google OAuth2 authorization URL."""

    auth_url: str


class DeviceCodeResponse(BaseModel):
    """Device code flow response for CLI."""

    device_code: str
    user_code: str
    verification_url: str
    expires_in: int
    interval: int


class DeviceTokenRequest(BaseModel):
    """Poll request for device code flow."""

    device_code: str


class MobileTokenRequest(BaseModel):
    """PKCE token exchange request from Expo mobile app."""

    code: str
    code_verifier: str
    redirect_uri: str


# ═══════════════════════════════════════════════
# User Schemas
# ═══════════════════════════════════════════════
class UserResponse(BaseModel):
    """Public user information."""

    id: UUID
    email: str
    name: str | None = None
    picture: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════
# Audit Schemas
# ═══════════════════════════════════════════════
class AuditRequest(BaseModel):
    """Request body for CSV-based audit."""

    program_name: str = Field(..., min_length=1, description="Name of the degree program")
    waived_courses: list[str] = Field(default_factory=list, description="Course codes to waive")


class CourseEntry(BaseModel):
    """A single parsed transcript entry."""

    course_code: str
    course_name: str
    grade: str
    credits: float
    semester: str


class CreditBreakdownItem(BaseModel):
    """One row of the credit breakdown."""

    course_code: str
    course_name: str
    grade: str | None
    credits: float
    semester: str
    status: str
    counted: bool


class AuditResultResponse(BaseModel):
    """Full audit result response."""

    id: UUID
    input_type: str
    original_filename: str | None = None
    program_name: str
    total_valid_credits: float
    cgpa: float
    on_probation: bool
    credit_breakdown: list[dict[str, Any]] | None = None
    missing_courses: dict[str, list[str]] | None = None
    completed_courses: list[str] | None = None
    waived_courses: list[str] | None = None
    ocr_confidence: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditHistoryResponse(BaseModel):
    """Paginated audit history."""

    items: list[AuditResultResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ═══════════════════════════════════════════════
# Program Schemas
# ═══════════════════════════════════════════════
class ProgramResponse(BaseModel):
    """Program template info."""

    id: UUID
    name: str
    total_required_credits: int
    mandatory_courses: dict[str, list[str]]

    model_config = {"from_attributes": True}


class ProgramListResponse(BaseModel):
    """List of available programs."""

    programs: list[ProgramResponse]


# ═══════════════════════════════════════════════
# OCR Schemas
# ═══════════════════════════════════════════════
class OCRResultResponse(BaseModel):
    """OCR extraction result."""

    raw_text: str
    confidence: float
    parsed_entries: list[CourseEntry]
    entry_count: int


# ═══════════════════════════════════════════════
# Health Schemas
# ═══════════════════════════════════════════════
class HealthResponse(BaseModel):
    """API health check response."""

    status: str = "healthy"
    version: str
    database: str
    ocr_available: bool


# Fix forward reference
TokenResponse.model_rebuild()
