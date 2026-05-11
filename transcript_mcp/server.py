"""
MCP Server — Transcript Auditor Pro (NSU Degree Audit)
======================================================
Exposes 5 tools and 2 prompts via the Model Context Protocol.

Tools
------
  audit_transcript      – Full degree audit against program requirements
  summarize_transcript  – CGPA, credits, grade distribution, semester breakdown
  compare_transcripts   – Side-by-side comparison of two academic transcripts
  flag_issues           – Targeted issue detection (F grades, withdrawals, probation …)
  export_report         – Render any tool result as Markdown or JSON

Prompts
--------
  deep_audit   – Comprehensive degree audit with actionable recommendations
  quick_review – Fast triage for critical academic issues only

Backend integration
-------------------
Any tool that accepts save_to_backend=True + auth_token will POST the result
to the FastAPI backend at /api/mcp/save-audit so it appears in audit history.

Usage
------
  # stdio (Claude Desktop / claude CLI)
  python -m transcript_mcp.server
"""

from __future__ import annotations

import logging
from typing import Any

from mcp.server.fastmcp import FastMCP

from .academic_analyzer import AcademicAnalyzer
from .backend_client import BackendClient

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("transcript_auditor_mcp")

mcp = FastMCP("Transcript Auditor Pro")
_analyzer = AcademicAnalyzer()


# ═══════════════════════════════════════════════════════════════════════════════
# TOOLS
# ═══════════════════════════════════════════════════════════════════════════════


@mcp.tool()
async def audit_transcript(
    csv_text: str,
    program_name: str = "Computer Science & Engineering",
    waived_courses: str = "",
    auth_token: str = "",
    save_to_backend: bool = False,
) -> dict[str, Any]:
    """
    Run a full NSU degree audit on an academic transcript CSV.

    Checks every mandatory course in the specified program, calculates CGPA,
    tallies earned credits, and flags graduation eligibility.

    Args:
        csv_text:       Raw CSV content with columns: course_code, course_name,
                        grade, credits, semester
        program_name:   Degree program to audit against. Accepts:
                        "Computer Science & Engineering" (default) or
                        "Electrical & Computer Engineering"
                        Also accepts short forms: "CSE", "ECE", "EEE".
        waived_courses: Comma-separated course codes the student has waivers for
                        (e.g. "ENG102, BUS112"). These are treated as completed.
        auth_token:     Bearer JWT from the FastAPI backend (required if save_to_backend=True)
        save_to_backend: When True, POST result to /api/mcp/save-audit

    Returns:
        dict with: program, cgpa, academic_standing, total_earned_credits,
        credit_deficit, missing_courses, on_probation, graduation_eligible,
        credit_breakdown, completed_courses
    """
    logger.info("audit_transcript called (program=%s, save=%s)", program_name, save_to_backend)
    result = _analyzer.audit(csv_text, program_name, waived_courses)

    if save_to_backend and auth_token and "error" not in result:
        try:
            async with BackendClient(auth_token) as client:
                saved = await client.save_mcp_audit(
                    audit_type="audit_transcript",
                    result=result,
                    raw_text=csv_text[:10_000],
                )
            result["backend_record_id"] = saved.get("id")
        except Exception as exc:
            logger.warning("Backend save failed: %s", exc)
            result["backend_save_error"] = str(exc)

    return result


@mcp.tool()
async def summarize_transcript(
    csv_text: str,
    auth_token: str = "",
    save_to_backend: bool = False,
) -> dict[str, Any]:
    """
    Generate an academic performance summary from a transcript CSV.

    Returns CGPA, total earned credits, semester-by-semester breakdown,
    grade distribution, retake counts, and key stats.

    Args:
        csv_text:        Raw CSV content (course_code, course_name, grade, credits, semester)
        auth_token:      Bearer JWT (required if save_to_backend=True)
        save_to_backend: When True, POST result to /api/mcp/save-audit

    Returns:
        dict with: cgpa, academic_standing, total_earned_credits, grade_distribution,
        semester_breakdown, retake_count, f_grade_count, w_grade_count, semesters
    """
    logger.info("summarize_transcript called (save=%s)", save_to_backend)
    result = _analyzer.summarize(csv_text)

    if save_to_backend and auth_token and "error" not in result:
        try:
            async with BackendClient(auth_token) as client:
                saved = await client.save_mcp_audit(
                    audit_type="summarize_transcript",
                    result=result,
                    raw_text=csv_text[:10_000],
                )
            result["backend_record_id"] = saved.get("id")
        except Exception as exc:
            logger.warning("Backend save failed: %s", exc)
            result["backend_save_error"] = str(exc)

    return result


@mcp.tool()
async def compare_transcripts(
    csv_a: str,
    csv_b: str,
    program_name: str = "Computer Science & Engineering",
    label_a: str = "Student A",
    label_b: str = "Student B",
) -> dict[str, Any]:
    """
    Compare two NSU academic transcripts side-by-side.

    Runs a full degree audit on each and produces a diff showing CGPA delta,
    credit delta, and courses unique to each transcript.

    Args:
        csv_a:        First transcript CSV text
        csv_b:        Second transcript CSV text
        program_name: Degree program to audit both against
        label_a:      Display name for the first student
        label_b:      Display name for the second student

    Returns:
        dict with per-student audit results plus a diff section
    """
    logger.info("compare_transcripts called (program=%s)", program_name)
    return _analyzer.compare(csv_a, csv_b, program_name, label_a, label_b)


@mcp.tool()
async def flag_issues(
    csv_text: str,
    checks: list[str] | None = None,
) -> dict[str, Any]:
    """
    Detect academic issues in a transcript CSV across multiple check categories.

    Available checks (pass as a list or omit for all):
      - "failures"    – Courses that have an F with no passing retake
      - "withdrawals" – Courses where the student withdrew (W grade)
      - "retakes"     – Courses taken more than once
      - "probation"   – CGPA below 2.0 (Academic Probation)
      - "incomplete"  – Courses with no grade recorded yet
      - "low_grades"  – Courses graded D+, D, or D- (passing but very low)

    Args:
        csv_text: Raw CSV content (course_code, course_name, grade, credits, semester)
        checks:   Subset of check names to run. Defaults to all six.

    Returns:
        dict with: total_issues, cgpa, checks_run, by_category, all_issues
    """
    logger.info("flag_issues called (checks=%s)", checks)
    return _analyzer.flag_issues(csv_text, checks)


@mcp.tool()
async def export_report(
    audit_result: dict[str, Any],
    format: str = "markdown",
    output_path: str = "",
) -> str:
    """
    Render any tool result as a formatted Markdown or JSON report.

    Accepts output from audit_transcript, summarize_transcript,
    compare_transcripts, or flag_issues.

    Args:
        audit_result: Result dict from one of the audit tools
        format:       "markdown" (default) or "json"
        output_path:  Optional file path to write the report (e.g. "report.md").
                      If empty, the report is only returned as a string.

    Returns:
        Formatted report string
    """
    logger.info("export_report called (format=%s, path=%r)", format, output_path)
    report = _analyzer.export_report(audit_result, format)

    if output_path:
        try:
            with open(output_path, "w", encoding="utf-8") as fh:
                fh.write(report)
            logger.info("Report written to %s", output_path)
        except OSError as exc:
            logger.warning("Could not write report to %s: %s", output_path, exc)

    return report


# ═══════════════════════════════════════════════════════════════════════════════
# PROMPTS
# ═══════════════════════════════════════════════════════════════════════════════


@mcp.prompt()
def deep_audit() -> str:
    """
    Deep audit mode — comprehensive degree check with actionable recommendations.
    Best when a student needs to plan their remaining semesters or is approaching
    graduation and wants a thorough readiness assessment.
    """
    return """\
You are an expert NSU academic advisor performing a DEEP DEGREE AUDIT.

The student has provided their academic transcript. Using the `audit_transcript`
and `flag_issues` MCP tools, perform a thorough analysis covering every area below.

---

## 1  CGPA & Academic Standing
- Current CGPA and academic standing (Dean's List / Honor Roll / Good Standing /
  Satisfactory / Academic Probation)
- Trend: is the student improving, stable, or declining semester by semester?
- If CGPA < 2.0: list the specific courses dragging it down and by how many points

## 2  Credit Progress
- Total credits earned vs. total required
- Estimated semesters remaining (assume 15 cr/semester)
- Any 0-credit lab courses that must be paired with their lecture

## 3  Missing Mandatory Courses
For every missing course:
- Which category it belongs to (GED / Core Math / Major Core)
- Whether the student has taken any prerequisite for it yet
- Suggested semester to complete it

## 4  Retakes & Grade Issues
- Every course taken more than once — grade history and outcome
- Courses still graded F (no passing retake) — critical, must resolve
- Courses graded D/D+ — passed but weak, consider retake if CGPA allows
- Withdrawn courses that have not been re-enrolled

## 5  Graduation Eligibility
- State clearly: **ELIGIBLE** or **NOT ELIGIBLE** and exactly why
- List the 3–5 highest-priority actions the student should take next semester

## 6  Recommendations
- Optimistic scenario: minimum semesters to graduate with current load
- Realistic scenario: accounting for course availability and prerequisites
- Risk factors that could delay graduation

---

After running the tools, produce a clean report with all six sections.
Close with a one-paragraph plain-language summary the student can act on.
"""


@mcp.prompt()
def quick_review() -> str:
    """
    Quick review mode — surface only critical academic issues. Use when a student
    needs an instant answer on whether they have urgent problems to fix, without
    a full breakdown.
    """
    return """\
You are an NSU academic advisor performing a QUICK REVIEW.

Run `flag_issues` with checks=["failures", "probation", "withdrawals"] and
`audit_transcript` to identify the most urgent problems only.

Report ONLY critical issues in this exact format:

---

**Academic Standing:** <standing>
**CGPA:** <X.XX> / 4.00
**Probation:** <Yes / No>

### Critical Issues
- [FAILED] `<COURSE_CODE>` — failed with no passing retake; must re-enroll
- [PROBATION] CGPA <X.XX> below 2.0 — at risk of dismissal
- [MISSING CORE] `<COURSE_CODE>` — mandatory course not completed

### Next Steps (top 3 only)
1. <Most urgent action>
2. <Second action>
3. <Third action>

---

Skip all non-critical issues (warnings, low grades, incomplete courses).
If there are NO critical issues, say so explicitly: "No critical issues found."
"""


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    mcp.run()
