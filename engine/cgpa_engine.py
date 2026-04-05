"""
Level 2 — CGPA Engine.

Calculates weighted CGPA using the NSU grading scale.
Implements interactive CLI waiver prompts. Ensures W and F grades
do not break the math.
"""

import sys
from typing import Dict, List, Set, Tuple

sys.path.insert(0, ".")

from models.data_models import (
    NON_CREDIT_GRADES,
    NSU_GRADE_POINTS,
    TranscriptEntry,
)
from engine.credit_engine import resolve_retakes


def calculate_cgpa(
    entries: List[TranscriptEntry],
    waived_codes: Set[str] = None,
) -> Tuple[float, float, float]:
    """
    Calculate weighted CGPA after resolving retakes.

    Formula:  CGPA = Σ(grade_point × credits) / Σ(credits)

    Rules:
        - Only courses with numeric passing grades contribute.
        - F is INCLUDED in CGPA calculation (grade_point = 0.0, hurts GPA).
          Wait — per the spec, F should NOT break the math but after retake
          resolution the F should be replaced by the better grade. If an F
          remains (no retake), it DOES count in the CGPA with 0.0 weight.
        - W, I, blank grades are fully excluded (no CGPA impact).
        - 0-credit courses are excluded from CGPA (no weight).
        - Waived courses are excluded from CGPA.

    Args:
        entries: Raw transcript entries (before retake resolution).
        waived_codes: Set of course codes that are waived.

    Returns:
        (cgpa, total_quality_points, total_credits_attempted)
    """
    if waived_codes is None:
        waived_codes = set()

    resolved = resolve_retakes(entries)
    total_quality_points = 0.0
    total_credits = 0.0

    for entry in resolved:
        # Skip waived courses
        if entry.course_code in waived_codes:
            continue

        # Skip W, I, blank (non-calculable grades)
        if entry.grade in {"W", "I", ""}:
            continue

        # Skip 0-credit courses (labs)
        if entry.is_zero_credit():
            continue

        gp = entry.grade_point()
        if gp is None:
            # Unknown grade — skip
            continue

        total_quality_points += gp * entry.credits
        total_credits += entry.credits

    cgpa = total_quality_points / total_credits if total_credits > 0 else 0.0
    return round(cgpa, 2), total_quality_points, total_credits


def prompt_waivers(
    waiver_candidates: List[str] = None,
) -> Set[str]:
    """
    Interactive CLI prompt that asks the user about course waivers.

    Args:
        waiver_candidates: Optional list of specific course codes to ask about.
                           If None, uses common waiver-eligible courses.

    Returns:
        Set of waived course codes.
    """
    if waiver_candidates is None:
        waiver_candidates = ["ENG102", "BUS112"]

    waived: Set[str] = set()

    print("\n╔══════════════════════════════════════════╗")
    print("║         COURSE WAIVER CHECK              ║")
    print("╚══════════════════════════════════════════╝\n")

    for code in waiver_candidates:
        while True:
            answer = input(f"  Is {code} waived? (yes/no): ").strip().lower()
            if answer in {"yes", "y"}:
                waived.add(code)
                print(f"    → {code} marked as WAIVED.\n")
                break
            elif answer in {"no", "n"}:
                print(f"    → {code} is NOT waived.\n")
                break
            else:
                print("    Please enter 'yes' or 'no'.")

    return waived
