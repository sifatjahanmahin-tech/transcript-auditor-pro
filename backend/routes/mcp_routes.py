"""
Backend API routes for MCP server integration.

Exposes POST /api/mcp/save-audit so the MCP server can persist transcript
audit results into the existing AuditRecord history table.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_user
from backend.database import AuditRecord, get_db

router = APIRouter(prefix="/api/mcp", tags=["MCP Integration"])


class McpSaveRequest(BaseModel):
    audit_type: str  # e.g. "audit_transcript", "summarize_transcript"
    result: dict[str, Any]  # raw tool output dict
    raw_text: str = ""  # original transcript (truncated to 10 000 chars)


@router.post("/save-audit", status_code=201)
async def save_mcp_audit(
    body: McpSaveRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Persist an MCP tool result to the user's audit history.

    The result dict is stored verbatim in parsed_entries (JSON).
    Issues list (if present) is stored in missing_courses so it surfaces
    in existing history UI queries.
    """
    issues: list = body.result.get("issues") or body.result.get("all_issues") or []

    record = AuditRecord(
        user_id=current_user.id,
        input_type="mcp_text",
        original_filename=f"{body.audit_type}.txt",
        program_name=body.audit_type,
        total_valid_credits=0.0,
        cgpa=0.0,
        on_probation=False,
        credit_breakdown=[],
        missing_courses=issues,
        completed_courses=[],
        waived_courses=[],
        parsed_entries=body.result,
        ocr_raw_text=body.raw_text[:10_000] if body.raw_text else None,
        created_at=datetime.now(UTC),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return {"id": str(record.id), "created_at": record.created_at.isoformat()}
