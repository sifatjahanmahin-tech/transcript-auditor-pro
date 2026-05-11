"""
Academic transcript analysis for NSU degree audit.

Wraps the existing engine/ and parser/ modules so the MCP tools
can operate on raw CSV strings instead of file paths.
"""

from __future__ import annotations

import csv
import io
import json
import os
import sys
from typing import Any

# Project root on sys.path so engine/ and models/ are importable
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from engine.audit_engine import run_audit  # noqa: E402
from engine.cgpa_engine import calculate_cgpa  # noqa: E402
from engine.credit_engine import calculate_valid_credits, resolve_retakes  # noqa: E402
from models.data_models import (  # noqa: E402
    AuditResult,
    ProgramRequirements,
    TranscriptEntry,
)

# ── Hardcoded NSU programme requirements (mirror of program.md) ───────────────

_PROGRAMS: dict[str, ProgramRequirements] = {
    "Computer Science & Engineering": ProgramRequirements(
        program_name="Computer Science & Engineering",
        total_required_credits=130,
        mandatory_courses={
            "Mandatory GED": ["ENG102", "ENG103", "HIS103", "PHI101"],
            "Core Math": ["MAT116", "MAT120", "MAT250", "MAT350", "MAT361"],
            "Major Core": [
                "CSE115", "CSE173", "CSE215", "CSE225", "CSE231",
                "CSE311", "CSE323", "CSE327", "CSE331", "CSE332", "CSE425",
            ],
        },
    ),
    "Electrical & Computer Engineering": ProgramRequirements(
        program_name="Electrical & Computer Engineering",
        total_required_credits=132,
        mandatory_courses={
            "Mandatory GED": ["ENG102", "ENG103", "HIS103", "PHI101"],
            "Core Science": ["PHY107", "PHY108", "CHE101"],
            "Major Core": [
                "EEE141", "EEE111", "EEE211", "EEE241", "EEE311", "EEE341",
                "CSE115", "CSE173", "CSE215",
            ],
        },
    ),
}

# Fuzzy match — accept short-form names
_PROGRAM_ALIASES: dict[str, str] = {
    "cse": "Computer Science & Engineering",
    "cs": "Computer Science & Engineering",
    "computer science": "Computer Science & Engineering",
    "ece": "Electrical & Computer Engineering",
    "eee": "Electrical & Computer Engineering",
    "electrical": "Electrical & Computer Engineering",
}


def _resolve_program(name: str) -> ProgramRequirements:
    """Return a ProgramRequirements by exact or fuzzy name match."""
    if name in _PROGRAMS:
        return _PROGRAMS[name]
    lower = name.lower().strip()
    if lower in _PROGRAM_ALIASES:
        return _PROGRAMS[_PROGRAM_ALIASES[lower]]
    # partial match
    for key in _PROGRAMS:
        if lower in key.lower():
            return _PROGRAMS[key]
    raise ValueError(
        f"Unknown program '{name}'. Available: {list(_PROGRAMS.keys())}"
    )


# ── CSV parser (string-based) ─────────────────────────────────────────────────

def parse_csv_string(csv_text: str) -> list[TranscriptEntry]:
    """Parse an in-memory CSV string into TranscriptEntry objects."""
    entries: list[TranscriptEntry] = []
    reader = csv.DictReader(io.StringIO(csv_text.strip()))

    if reader.fieldnames:
        reader.fieldnames = [h.strip().lower() for h in reader.fieldnames]

    for row in reader:
        cleaned = {k.strip().lower(): (v.strip() if v else "") for k, v in row.items()}
        course_code = cleaned.get("course_code", cleaned.get("course code", "")).upper()
        if not course_code:
            continue
        grade = cleaned.get("grade", "").upper().replace(" ", "")
        try:
            credits = float(cleaned.get("credits", "0") or "0")
        except ValueError:
            credits = 0.0
        entries.append(
            TranscriptEntry(
                course_code=course_code,
                course_name=cleaned.get("course_name", cleaned.get("course name", "")),
                grade=grade,
                credits=credits,
                semester=cleaned.get("semester", ""),
            )
        )
    return entries


def _waived_set(waived_courses: str) -> set[str]:
    """Parse 'CSE115, CSE173' → {'CSE115', 'CSE173'}."""
    if not waived_courses or not waived_courses.strip():
        return set()
    return {c.strip().upper() for c in waived_courses.replace(";", ",").split(",") if c.strip()}


# ── Grade analysis helpers ────────────────────────────────────────────────────

def _semester_breakdown(entries: list[TranscriptEntry]) -> dict[str, Any]:
    """Group entries by semester and compute per-semester GPA."""
    by_sem: dict[str, list[TranscriptEntry]] = {}
    for e in entries:
        by_sem.setdefault(e.semester or "Unknown", []).append(e)

    result = {}
    for sem, sem_entries in by_sem.items():
        sem_qp = sum(
            (e.grade_point() or 0.0) * e.credits
            for e in sem_entries
            if e.grade_point() is not None and not e.is_zero_credit()
        )
        sem_cr = sum(
            e.credits for e in sem_entries
            if e.grade_point() is not None and not e.is_zero_credit()
        )
        result[sem] = {
            "courses": len(sem_entries),
            "credits": sem_cr,
            "gpa": round(sem_qp / sem_cr, 2) if sem_cr else 0.0,
        }
    return result


def _standing(cgpa: float) -> str:
    if cgpa >= 3.7:
        return "Dean's List"
    if cgpa >= 3.3:
        return "Honor Roll"
    if cgpa >= 2.5:
        return "Good Standing"
    if cgpa >= 2.0:
        return "Satisfactory"
    return "Academic Probation"


# ── Main Analyzer ─────────────────────────────────────────────────────────────

class AcademicAnalyzer:
    """Wraps the NSU audit engine for use from MCP tools."""

    # ── audit ─────────────────────────────────────────────────────────────────

    def audit(
        self,
        csv_text: str,
        program_name: str = "Computer Science & Engineering",
        waived_courses: str = "",
    ) -> dict[str, Any]:
        """Full degree audit against program requirements."""
        entries = parse_csv_string(csv_text)
        if not entries:
            return {"error": "No valid course entries found in the transcript CSV."}

        program = _resolve_program(program_name)
        waived = _waived_set(waived_courses)
        result: AuditResult = run_audit(entries, program, waived)

        total_missing = sum(len(v) for v in result.missing_courses.values())
        cgpa_str = f"{result.cgpa:.2f}"

        return {
            "program": program.program_name,
            "total_required_credits": program.total_required_credits,
            "total_earned_credits": result.total_valid_credits,
            "credit_deficit": max(0, program.total_required_credits - result.total_valid_credits),
            "cgpa": result.cgpa,
            "cgpa_display": cgpa_str,
            "academic_standing": _standing(result.cgpa),
            "on_probation": result.on_probation,
            "completed_courses": result.completed_courses,
            "waived_courses": result.waived_courses,
            "missing_courses": result.missing_courses,
            "total_missing_courses": total_missing,
            "credit_breakdown": result.credit_breakdown,
            "graduation_eligible": (
                result.total_valid_credits >= program.total_required_credits
                and total_missing == 0
                and not result.on_probation
            ),
        }

    # ── summarize ─────────────────────────────────────────────────────────────

    def summarize(self, csv_text: str) -> dict[str, Any]:
        """Academic performance summary — CGPA, credits, grade distribution."""
        entries = parse_csv_string(csv_text)
        if not entries:
            return {"error": "No valid course entries found."}

        cgpa, qp, attempted = calculate_cgpa(entries)
        total_credits, _ = calculate_valid_credits(entries)
        resolved = resolve_retakes(entries)

        grade_dist: dict[str, int] = {}
        for e in resolved:
            grade_dist[e.grade or "—"] = grade_dist.get(e.grade or "—", 0) + 1

        retaken = {
            code
            for code, group in _group_by_code(entries).items()
            if len(group) > 1
        }

        semesters_seen = sorted({e.semester for e in entries if e.semester})
        f_count = sum(1 for e in entries if e.grade == "F")
        w_count = sum(1 for e in entries if e.grade == "W")

        return {
            "total_entries": len(entries),
            "unique_courses": len({e.course_code for e in entries}),
            "semesters": semesters_seen,
            "semester_count": len(semesters_seen),
            "total_earned_credits": total_credits,
            "credits_attempted": attempted,
            "cgpa": cgpa,
            "academic_standing": _standing(cgpa),
            "on_probation": cgpa < 2.0,
            "grade_distribution": grade_dist,
            "courses_retaken": sorted(retaken),
            "retake_count": len(retaken),
            "f_grade_count": f_count,
            "w_grade_count": w_count,
            "semester_breakdown": _semester_breakdown(entries),
        }

    # ── compare ───────────────────────────────────────────────────────────────

    def compare(
        self,
        csv_a: str,
        csv_b: str,
        program_name: str = "Computer Science & Engineering",
        label_a: str = "Student A",
        label_b: str = "Student B",
    ) -> dict[str, Any]:
        """Compare two academic transcripts side-by-side."""
        ea = parse_csv_string(csv_a)
        eb = parse_csv_string(csv_b)
        if not ea:
            return {"error": f"No entries in transcript for {label_a}"}
        if not eb:
            return {"error": f"No entries in transcript for {label_b}"}

        program = _resolve_program(program_name)
        ra: AuditResult = run_audit(ea, program)
        rb: AuditResult = run_audit(eb, program)

        codes_a = {e.course_code for e in ea}
        codes_b = {e.course_code for e in eb}

        return {
            "program": program.program_name,
            label_a: {
                "cgpa": ra.cgpa,
                "standing": _standing(ra.cgpa),
                "earned_credits": ra.total_valid_credits,
                "missing_courses": ra.missing_courses,
                "on_probation": ra.on_probation,
                "graduation_eligible": (
                    ra.total_valid_credits >= program.total_required_credits
                    and not ra.on_probation
                    and sum(len(v) for v in ra.missing_courses.values()) == 0
                ),
            },
            label_b: {
                "cgpa": rb.cgpa,
                "standing": _standing(rb.cgpa),
                "earned_credits": rb.total_valid_credits,
                "missing_courses": rb.missing_courses,
                "on_probation": rb.on_probation,
                "graduation_eligible": (
                    rb.total_valid_credits >= program.total_required_credits
                    and not rb.on_probation
                    and sum(len(v) for v in rb.missing_courses.values()) == 0
                ),
            },
            "diff": {
                "cgpa_delta": round(rb.cgpa - ra.cgpa, 2),
                "credit_delta": rb.total_valid_credits - ra.total_valid_credits,
                "courses_only_in_a": sorted(codes_a - codes_b),
                "courses_only_in_b": sorted(codes_b - codes_a),
                "courses_in_both": sorted(codes_a & codes_b),
            },
        }

    # ── flag_issues ───────────────────────────────────────────────────────────

    def flag_issues(
        self,
        csv_text: str,
        checks: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Targeted issue detection.

        Available checks:
          failures    – courses with F grade (never retaken)
          withdrawals – W grade courses
          retakes     – courses taken more than once
          probation   – CGPA below 2.0
          incomplete  – courses with blank/missing grade
          low_grades  – courses below C (D+, D, or F)
        """
        all_checks = {"failures", "withdrawals", "retakes", "probation", "incomplete", "low_grades"}
        active = set(checks) if checks else all_checks

        entries = parse_csv_string(csv_text)
        if not entries:
            return {"error": "No valid course entries found."}

        grouped = _group_by_code(entries)
        resolved = resolve_retakes(entries)
        cgpa, _, _ = calculate_cgpa(entries)

        issues: list[dict[str, Any]] = []

        for code, group in grouped.items():
            grades = [e.grade for e in group]
            best_grade = group[-1].grade  # resolve_retakes uses last attempt

            # Actual resolved grade
            resolved_entry = next((e for e in resolved if e.course_code == code), None)
            resolved_grade = resolved_entry.grade if resolved_entry else best_grade

            if "retakes" in active and len(group) > 1:
                issues.append({
                    "category": "retakes",
                    "severity": "warning",
                    "course_code": code,
                    "course_name": group[0].course_name,
                    "detail": f"Taken {len(group)} time(s): grades {', '.join(grades)}",
                })

            if "failures" in active and resolved_grade == "F":
                issues.append({
                    "category": "failures",
                    "severity": "critical",
                    "course_code": code,
                    "course_name": group[0].course_name,
                    "detail": "Failed with no passing retake (grade: F)",
                })

            if "withdrawals" in active:
                w_count = grades.count("W")
                if w_count > 0:
                    issues.append({
                        "category": "withdrawals",
                        "severity": "warning",
                        "course_code": code,
                        "course_name": group[0].course_name,
                        "detail": f"Withdrawn {w_count} time(s)",
                    })

            if "incomplete" in active and resolved_grade == "":
                issues.append({
                    "category": "incomplete",
                    "severity": "info",
                    "course_code": code,
                    "course_name": group[0].course_name,
                    "detail": "Grade not yet recorded (in progress or missing)",
                })

            if "low_grades" in active and resolved_grade in ("D+", "D", "D-"):
                issues.append({
                    "category": "low_grades",
                    "severity": "warning",
                    "course_code": code,
                    "course_name": group[0].course_name,
                    "detail": f"Low grade: {resolved_grade}",
                })

        if "probation" in active and cgpa < 2.0:
            issues.append({
                "category": "probation",
                "severity": "critical",
                "course_code": "",
                "course_name": "",
                "detail": f"CGPA {cgpa:.2f} is below 2.0 — Academic Probation",
            })

        by_category: dict[str, list] = {}
        for issue in issues:
            by_category.setdefault(issue["category"], []).append(issue)

        return {
            "total_issues": len(issues),
            "cgpa": cgpa,
            "checks_run": sorted(active),
            "by_category": by_category,
            "all_issues": issues,
        }

    # ── export_report ─────────────────────────────────────────────────────────

    def export_report(self, audit_result: dict[str, Any], fmt: str) -> str:
        if fmt.lower() == "json":
            return json.dumps(audit_result, indent=2, ensure_ascii=False)
        return self._to_markdown(audit_result)

    def _to_markdown(self, r: dict[str, Any]) -> str:
        lines: list[str] = ["# NSU Degree Audit Report", ""]

        # ── Error short-circuit ──
        if "error" in r:
            return f"# Error\n\n{r['error']}\n"

        # ── Summary table (from audit) ──
        if "program" in r and "cgpa" in r:
            standing = r.get("academic_standing", "")
            elig = "Yes" if r.get("graduation_eligible") else "No"
            prob = "YES — Academic Probation" if r.get("on_probation") else "No"
            lines += [
                "## Audit Summary",
                "",
                "| Metric | Value |",
                "|--------|-------|",
                f"| Program | {r['program']} |",
                f"| CGPA | {r.get('cgpa_display', r.get('cgpa', 'N/A'))} / 4.00 |",
                f"| Academic Standing | {standing} |",
                f"| Credits Earned | {r.get('total_earned_credits', 'N/A')} / {r.get('total_required_credits', 'N/A')} |",
                f"| Credit Deficit | {r.get('credit_deficit', 0)} |",
                f"| Missing Courses | {r.get('total_missing_courses', 0)} |",
                f"| Probation | {prob} |",
                f"| Graduation Eligible | {elig} |",
                "",
            ]

        # ── Missing courses ──
        missing = r.get("missing_courses", {})
        if missing:
            lines += ["## Missing Courses", ""]
            for cat, codes in missing.items():
                lines.append(f"### {cat}")
                for code in codes:
                    lines.append(f"- `{code}`")
                lines.append("")

        # ── Grade distribution (from summarize) ──
        if "grade_distribution" in r:
            dist = r["grade_distribution"]
            lines += ["## Grade Distribution", ""]
            for grade, count in sorted(dist.items()):
                lines.append(f"- **{grade}**: {count}")
            lines.append("")

        # ── Semester breakdown ──
        sem_bk = r.get("semester_breakdown", {})
        if sem_bk:
            lines += ["## Semester Breakdown", ""]
            lines += ["| Semester | Courses | Credits | GPA |", "|---|---|---|---|"]
            for sem, info in sem_bk.items():
                lines.append(
                    f"| {sem} | {info['courses']} | {info['credits']} | {info['gpa']} |"
                )
            lines.append("")

        # ── Issues (from flag_issues) ──
        issues = r.get("all_issues", [])
        if issues:
            sev_rank = {"critical": 0, "warning": 1, "info": 2}
            issues = sorted(issues, key=lambda x: sev_rank.get(x.get("severity", "info"), 2))
            lines += ["## Issues Flagged", ""]
            for iss in issues:
                sev = iss.get("severity", "info").upper()
                cat = iss.get("category", "")
                code = iss.get("course_code", "")
                detail = iss.get("detail", "")
                label = f"`{code}` — " if code else ""
                lines.append(f"- **[{sev}]** `{cat}`: {label}{detail}")
            lines.append("")

        # ── Comparison diff ──
        diff = r.get("diff", {})
        if diff:
            lines += ["## Comparison Diff", ""]
            delta_cgpa = diff.get("cgpa_delta", 0)
            sign = "+" if delta_cgpa >= 0 else ""
            lines.append(f"- CGPA delta: **{sign}{delta_cgpa}**")
            lines.append(f"- Credit delta: **{diff.get('credit_delta', 0)}**")
            only_a = diff.get("courses_only_in_a", [])
            only_b = diff.get("courses_only_in_b", [])
            if only_a:
                lines.append(f"- Only in first: {', '.join(f'`{c}`' for c in only_a)}")
            if only_b:
                lines.append(f"- Only in second: {', '.join(f'`{c}`' for c in only_b)}")
            lines.append("")

        return "\n".join(lines)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _group_by_code(entries: list[TranscriptEntry]) -> dict[str, list[TranscriptEntry]]:
    grouped: dict[str, list[TranscriptEntry]] = {}
    for e in entries:
        grouped.setdefault(e.course_code, []).append(e)
    return grouped
