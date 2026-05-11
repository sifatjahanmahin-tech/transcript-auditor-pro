"""
History routes — per-account audit history with pagination, search, and deletion.
"""

import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_user
from backend.database import AuditRecord, User, get_db
from backend.schemas import AuditHistoryResponse, AuditResultResponse

router = APIRouter(prefix="/api/history", tags=["History"])


@router.get("", response_model=AuditHistoryResponse)
async def get_audit_history(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    input_type: str | None = Query(None, description="Filter by input type: csv, image"),
    program_name: str | None = Query(None, description="Filter by program name"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get paginated audit history for the current user.

    Supports filtering by input type and program name.
    Results are ordered by most recent first.
    """
    # Base query — only current user's records
    base_query = select(AuditRecord).where(AuditRecord.user_id == current_user.id)
    count_query = select(func.count(AuditRecord.id)).where(AuditRecord.user_id == current_user.id)

    # Apply filters
    if input_type:
        base_query = base_query.where(AuditRecord.input_type == input_type)
        count_query = count_query.where(AuditRecord.input_type == input_type)

    if program_name:
        base_query = base_query.where(AuditRecord.program_name.ilike(f"%{program_name}%"))
        count_query = count_query.where(AuditRecord.program_name.ilike(f"%{program_name}%"))

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    total_pages = max(1, math.ceil(total / page_size))

    # Paginate
    offset = (page - 1) * page_size
    query = base_query.order_by(desc(AuditRecord.created_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    records = result.scalars().all()

    items = [AuditResultResponse.model_validate(r) for r in records]

    return AuditHistoryResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{record_id}", response_model=AuditResultResponse)
async def get_audit_record(
    record_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific audit record by ID (must belong to current user)."""
    result = await db.execute(
        select(AuditRecord).where(
            AuditRecord.id == record_id,
            AuditRecord.user_id == current_user.id,
        )
    )
    record = result.scalar_one_or_none()

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit record not found.",
        )

    return AuditResultResponse.model_validate(record)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_audit_record(
    record_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a specific audit record (must belong to current user)."""
    result = await db.execute(
        select(AuditRecord).where(
            AuditRecord.id == record_id,
            AuditRecord.user_id == current_user.id,
        )
    )
    record = result.scalar_one_or_none()

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit record not found.",
        )

    await db.delete(record)
    await db.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def clear_all_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete ALL audit history for the current user. Use with caution."""
    result = await db.execute(select(AuditRecord).where(AuditRecord.user_id == current_user.id))
    records = result.scalars().all()

    for record in records:
        await db.delete(record)

    await db.commit()


@router.get("/stats/summary")
async def get_audit_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get summary statistics for the current user's audit history."""
    # Total audits
    total_result = await db.execute(select(func.count(AuditRecord.id)).where(AuditRecord.user_id == current_user.id))
    total_audits = total_result.scalar() or 0

    # By type
    csv_result = await db.execute(
        select(func.count(AuditRecord.id)).where(
            AuditRecord.user_id == current_user.id,
            AuditRecord.input_type == "csv",
        )
    )
    csv_count = csv_result.scalar() or 0

    image_result = await db.execute(
        select(func.count(AuditRecord.id)).where(
            AuditRecord.user_id == current_user.id,
            AuditRecord.input_type == "image",
        )
    )
    image_count = image_result.scalar() or 0

    # Average CGPA across all audits
    avg_result = await db.execute(select(func.avg(AuditRecord.cgpa)).where(AuditRecord.user_id == current_user.id))
    avg_cgpa = avg_result.scalar() or 0.0

    # Probation count
    prob_result = await db.execute(
        select(func.count(AuditRecord.id)).where(
            AuditRecord.user_id == current_user.id,
            AuditRecord.on_probation.is_(True),
        )
    )
    probation_count = prob_result.scalar() or 0

    return {
        "total_audits": total_audits,
        "csv_audits": csv_count,
        "image_audits": image_count,
        "average_cgpa": round(float(avg_cgpa), 2),
        "probation_warnings": probation_count,
    }
