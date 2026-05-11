"""
Level 1 — Credit Engine.

Calculates total valid credits from a student transcript.
Handles retakes (keeps best grade), filters out F/W/I grades,
and excludes 0-credit lab courses from the total.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.data_models import (
    NON_CREDIT_GRADES,
    NSU_GRADE_POINTS,
    TranscriptEntry,
)


def resolve_retakes(entries: list[TranscriptEntry]) -> list[TranscriptEntry]:
    """
    For courses taken multiple times, keep only the BEST attempt
    (highest grade point). Ties are broken by keeping the latest semester.

    Returns:
        A deduplicated list of TranscriptEntry objects.
    """
    best: dict[str, TranscriptEntry] = {}

    for entry in entries:
        code = entry.course_code
        if code not in best:
            best[code] = entry
            continue

        existing = best[code]
        existing_gp = existing.grade_point() if existing.grade_point() is not None else -1
        new_gp = entry.grade_point() if entry.grade_point() is not None else -1

        # Keep the one with the higher grade point
        if new_gp > existing_gp:
            best[code] = entry
        elif new_gp == existing_gp:
            # Same grade: keep the later semester (latest attempt)
            best[code] = entry  # CSV order = chronological

    return list(best.values())


def calculate_valid_credits(
    entries: list[TranscriptEntry],
) -> tuple[float, list[dict]]:
    """
    Level 1: Calculate total earned credits.

    Rules:
        1. Resolve retakes first (best grade wins).
        2. Exclude grades: F, W, I, blank.
        3. Exclude 0-credit courses (labs) from the total.
        4. Sum remaining credits.

    Returns:
        (total_credits, breakdown)
        breakdown is a list of dicts with course details and status.
    """
    resolved = resolve_retakes(entries)
    breakdown: list[dict] = []
    total_credits = 0.0

    for entry in resolved:
        status = "[+] Counted"
        counted = True

        if entry.grade in NON_CREDIT_GRADES or entry.grade not in NSU_GRADE_POINTS:
            grade_str = entry.grade if entry.grade is not None else "blank"
            status = f"[-] Excluded (grade: {grade_str})"
            counted = False
        elif entry.is_zero_credit():
            status = "[o] 0-credit (lab)"
            counted = False  # don't add to total, but it's not a failure

        if counted:
            total_credits += entry.credits

        breakdown.append(
            {
                "course_code": entry.course_code,
                "course_name": entry.course_name,
                "grade": entry.grade,
                "credits": entry.credits,
                "semester": entry.semester,
                "status": status,
                "counted": counted,
            }
        )

    return total_credits, breakdown
