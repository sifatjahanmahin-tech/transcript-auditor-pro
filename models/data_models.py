"""
Data models for the Audit Core CLI tool.

Defines dataclasses for transcript entries, program requirements,
and the NSU grading scale used throughout the system.
"""

from dataclasses import dataclass, field

# ──────────────────────────────────────────────
# NSU Grading Scale
# ──────────────────────────────────────────────

NSU_GRADE_POINTS: dict[str, float] = {
    "A": 4.0,
    "A-": 3.7,
    "B+": 3.3,
    "B": 3.0,
    "B-": 2.7,
    "C+": 2.3,
    "C": 2.0,
    "C-": 1.7,
    "D+": 1.3,
    "D": 1.0,
    "F": 0.0,
}

# Grades that do NOT count toward earned credits or CGPA
NON_CREDIT_GRADES = {"F", "W", "I", ""}

# Grades that are passing (earn credits and count in CGPA)
PASSING_GRADES = set(NSU_GRADE_POINTS.keys()) - {"F"}


# ──────────────────────────────────────────────
# Dataclasses
# ──────────────────────────────────────────────


@dataclass
class TranscriptEntry:
    """A single row from the student transcript CSV."""

    course_code: str
    course_name: str
    grade: str
    credits: float
    semester: str

    def is_passing(self) -> bool:
        """Return True if the grade earns credit (not F, W, I, or blank)."""
        grade = self.grade if self.grade is not None else ""
        return grade not in NON_CREDIT_GRADES

    def grade_point(self) -> float | None:
        """Return the numeric grade point, or None if not on the scale."""
        grade = self.grade if self.grade is not None else ""
        return NSU_GRADE_POINTS.get(grade)

    def is_zero_credit(self) -> bool:
        """Return True if this is a 0-credit course (e.g. lab)."""
        return self.credits == 0


@dataclass
class ProgramRequirements:
    """Parsed mandatory course requirements from a program markdown file."""

    program_name: str
    total_required_credits: int
    mandatory_courses: dict[str, list[str]] = field(default_factory=dict)
    # category_name -> [course_codes]

    def all_mandatory_codes(self) -> list[str]:
        """Flatten all mandatory course codes across every category."""
        codes = []
        for course_list in self.mandatory_courses.values():
            codes.extend(course_list)
        return codes


@dataclass
class AuditResult:
    """Complete audit output combining all three levels."""

    # Level 1
    total_valid_credits: float
    credit_breakdown: list[dict] = field(default_factory=list)

    # Level 2
    cgpa: float = 0.0
    waived_courses: list[str] = field(default_factory=list)

    # Level 3
    missing_courses: dict[str, list[str]] = field(default_factory=dict)
    on_probation: bool = False
    completed_courses: list[str] = field(default_factory=list)
