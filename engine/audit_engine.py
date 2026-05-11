"""
Level 3 — Audit Engine.

Compares completed courses against program requirements.
Identifies missing courses, handles waivers, and flags
probation when CGPA < 2.0.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.cgpa_engine import calculate_cgpa
from engine.credit_engine import calculate_valid_credits, resolve_retakes
from models.data_models import (
    AuditResult,
    ProgramRequirements,
    TranscriptEntry,
)


def run_audit(
    entries: list[TranscriptEntry],
    program: ProgramRequirements,
    waived_codes: set[str] | None = None,
) -> AuditResult:
    """
    Full degree audit: credit tally + CGPA + deficiency analysis.

    Args:
        entries: Raw transcript entries.
        program: Parsed program requirements.
        waived_codes: Course codes the student has received waivers for.

    Returns:
        AuditResult with all three levels of analysis.
    """
    if waived_codes is None:
        waived_codes = set()

    # ── Level 1: Credit Tally ──
    total_credits, credit_breakdown = calculate_valid_credits(entries)

    # ── Level 2: CGPA ──
    cgpa, _, _ = calculate_cgpa(entries, waived_codes)

    # ── Level 3: Deficiency Audit ──
    resolved = resolve_retakes(entries)

    # Build set of completed course codes (passing grades only)
    completed: set[str] = set()
    for entry in resolved:
        grade_point = entry.grade_point()
        if entry.is_passing() and grade_point is not None:
            completed.add(entry.course_code)

    # Add waived courses as "completed"
    completed.update(waived_codes)

    # Find missing mandatory courses by category
    missing_by_category: dict[str, list[str]] = {}
    for category, required_codes in program.mandatory_courses.items():
        missing = [code for code in required_codes if code not in completed]
        if missing:
            missing_by_category[category] = missing

    # Probation check
    on_probation = cgpa < 2.0

    return AuditResult(
        total_valid_credits=total_credits,
        credit_breakdown=credit_breakdown,
        cgpa=cgpa,
        waived_courses=list(waived_codes),
        missing_courses=missing_by_category,
        on_probation=on_probation,
        completed_courses=sorted(completed),
    )
