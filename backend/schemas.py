"""
Pydantic schemas for API request/response validation.

Separates input (Create), output (Response), and internal (DB) schemas
following FastAPI best practices.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


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


# ═══════════════════════════════════════════════
# User Schemas
# ═══════════════════════════════════════════════
class UserResponse(BaseModel):
    """Public user information."""
    id: UUID
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════
# Audit Schemas
# ═══════════════════════════════════════════════
class AuditRequest(BaseModel):
    """Request body for CSV-based audit."""
    program_name: str = Field(..., min_length=1, description="Name of the degree program")
    waived_courses: List[str] = Field(default_factory=list, description="Course codes to waive")


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
    grade: Optional[str]
    credits: float
    semester: str
    status: str
    counted: bool


class AuditResultResponse(BaseModel):
    """Full audit result response."""
    id: UUID
    input_type: str
    original_filename: Optional[str] = None
    program_name: str
    total_valid_credits: float
    cgpa: float
    on_probation: bool
    credit_breakdown: Optional[List[Dict[str, Any]]] = None
    missing_courses: Optional[Dict[str, List[str]]] = None
    completed_courses: Optional[List[str]] = None
    waived_courses: Optional[List[str]] = None
    ocr_confidence: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditHistoryResponse(BaseModel):
    """Paginated audit history."""
    items: List[AuditResultResponse]
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
    mandatory_courses: Dict[str, List[str]]

    model_config = {"from_attributes": True}


class ProgramListResponse(BaseModel):
    """List of available programs."""
    programs: List[ProgramResponse]


# ═══════════════════════════════════════════════
# OCR Schemas
# ═══════════════════════════════════════════════
class OCRResultResponse(BaseModel):
    """OCR extraction result."""
    raw_text: str
    confidence: float
    parsed_entries: List[CourseEntry]
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
