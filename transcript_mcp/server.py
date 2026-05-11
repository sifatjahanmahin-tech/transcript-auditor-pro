"""
MCP Server — Transcript Auditor Pro
====================================
Exposes 5 tools and 2 reusable prompts via the Model Context Protocol.

Tools
------
  audit_transcript      – Full quality audit with issue detection
  summarize_transcript  – Structured summary (speakers, topics, key moments)
  compare_transcripts   – Diff two transcript versions
  flag_issues           – Targeted issue detection with category filters
  export_report         – Render audit results as JSON or Markdown

Prompts
--------
  deep_audit   – Comprehensive grammar + factual + formatting check
  quick_review – Critical-errors-only triage

Backend integration
-------------------
Any tool that accepts save_to_backend=True + auth_token will POST the result
to the FastAPI backend at /api/mcp/save-audit so it appears in audit history.

Usage
------
  # stdio (default — works with Claude Desktop / claude CLI)
  python -m mcp.server

  # or via the MCP CLI
  mcp run mcp/server.py
"""

from __future__ import annotations

import logging
from typing import Any

from mcp.server.fastmcp import FastMCP

from .backend_client import BackendClient
from .transcript_analyzer import TranscriptAnalyzer

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("transcript_auditor_mcp")

mcp = FastMCP("Transcript Auditor Pro")
_analyzer = TranscriptAnalyzer()


# ═══════════════════════════════════════════════════════════════════════════════
# TOOLS
# ═══════════════════════════════════════════════════════════════════════════════


@mcp.tool()
async def audit_transcript(
    transcript: str,
    auth_token: str = "",
    save_to_backend: bool = False,
) -> dict[str, Any]:
    """
    Analyze a transcript for accuracy, completeness, speaker identification
    errors, and suspicious segments.

    Returns a quality score (0-100), issue list, and suspicious segment report.
    Optionally saves the result to the FastAPI audit history.

    Args:
        transcript: Raw transcript text (supports timestamped and plain formats)
        auth_token: Bearer JWT from the FastAPI backend (required if save_to_backend=True)
        save_to_backend: When True, POST result to /api/mcp/save-audit
    """
    logger.info("audit_transcript called (save=%s)", save_to_backend)
    result = _analyzer.audit(transcript)

    if save_to_backend and auth_token:
        try:
            async with BackendClient(auth_token) as client:
                saved = await client.save_mcp_audit(
                    audit_type="audit_transcript",
                    result=result,
                    raw_text=transcript,
                )
            result["backend_record_id"] = saved.get("id")
        except Exception as exc:
            logger.warning("Backend save failed: %s", exc)
            result["backend_save_error"] = str(exc)

    return result


@mcp.tool()
async def summarize_transcript(
    transcript: str,
    auth_token: str = "",
    save_to_backend: bool = False,
) -> dict[str, Any]:
    """
    Generate a structured summary of a transcript.

    Returns duration, speaker list, word counts per speaker, key topics
    extracted heuristically, and up to 20 key moments (speaker-change events
    with timestamps).

    Args:
        transcript: Raw transcript text
        auth_token: Bearer JWT from the FastAPI backend (required if save_to_backend=True)
        save_to_backend: When True, POST result to /api/mcp/save-audit
    """
    logger.info("summarize_transcript called (save=%s)", save_to_backend)
    result = _analyzer.summarize(transcript)

    if save_to_backend and auth_token:
        try:
            async with BackendClient(auth_token) as client:
                saved = await client.save_mcp_audit(
                    audit_type="summarize_transcript",
                    result=result,
                    raw_text=transcript,
                )
            result["backend_record_id"] = saved.get("id")
        except Exception as exc:
            logger.warning("Backend save failed: %s", exc)
            result["backend_save_error"] = str(exc)

    return result


@mcp.tool()
async def compare_transcripts(
    transcript_a: str,
    transcript_b: str,
    label_a: str = "Version A",
    label_b: str = "Version B",
) -> dict[str, Any]:
    """
    Diff two versions of the same transcript and highlight changes.

    Returns a similarity ratio, categorized change list (added / removed /
    changed), and a unified diff string suitable for display.

    Args:
        transcript_a: Original transcript text
        transcript_b: Revised transcript text
        label_a: Human-readable label for the first version
        label_b: Human-readable label for the second version
    """
    logger.info("compare_transcripts called")
    return _analyzer.compare(transcript_a, transcript_b, label_a, label_b)


@mcp.tool()
async def flag_issues(
    transcript: str,
    checks: list[str] | None = None,
) -> dict[str, Any]:
    """
    Detect issues in a transcript across up to five check categories.

    Available checks (pass as list or omit for all):
      - "crosstalk"   – overlapping / cross-talk markers
      - "inaudible"   – [inaudible] segments, especially consecutive ones
      - "timestamps"  – missing, out-of-order, or inconsistent-format timestamps
      - "speakers"    – inconsistent or near-duplicate speaker labels
      - "formatting"  – trailing whitespace and other cosmetic issues

    Args:
        transcript: Raw transcript text to check
        checks: Subset of check names to run. Defaults to all five.
    """
    logger.info("flag_issues called (checks=%s)", checks)
    return _analyzer.flag_issues(transcript, checks)


@mcp.tool()
async def export_report(
    audit_result: dict[str, Any],
    format: str = "markdown",
    output_path: str = "",
) -> str:
    """
    Render audit results as a Markdown or JSON report.

    Accepts the dict output from any of the other tools (audit_transcript,
    summarize_transcript, compare_transcripts, flag_issues).

    Args:
        audit_result: The result dict from one of the audit tools
        format: "markdown" (default) or "json"
        output_path: Optional file path to write the report to (e.g. "report.md").
                     If empty, the report is only returned as a string.
    """
    logger.info("export_report called (format=%s, output_path=%r)", format, output_path)
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
# PROMPTS / SKILLS
# ═══════════════════════════════════════════════════════════════════════════════


@mcp.prompt()
def deep_audit() -> str:
    """
    Deep audit mode — comprehensive grammar, factual consistency, and formatting
    check. Best for legal, medical, academic, or archival transcripts where
    accuracy is critical.
    """
    return """\
You are a professional transcript auditor. Perform a DEEP AUDIT on the transcript provided.

Work through every category below and report findings.

## 1  Grammar & Language
- Spelling and grammatical errors
- Run-on sentences or missing punctuation
- Inconsistent verb tense or person

## 2  Speaker Identification
- Consistent speaker labels throughout
- No speaker swaps (text attributed to the wrong person)
- Ambiguous pronouns that may cause confusion

## 3  Factual Consistency
- Internal contradictions (two statements that cannot both be true)
- Numerical data: dates, figures, names — are they consistent?
- Technical terminology: is it used correctly and consistently?

## 4  Timestamps
- Consistent format (all HH:MM:SS or all MM:SS — not mixed)
- Chronological order (no backward jumps)
- No speaker lines missing a timestamp if others have them

## 5  Completeness
- Missing sections or abrupt endings
- [inaudible] or [crosstalk] clusters obscuring key content
- Suspicious gaps in the timeline (large jumps with no explanation)

## 6  Formatting
- Line break and paragraph structure
- Special character handling
- Consistent punctuation style at line ends

---

For **every issue found**, report:
| Field | Content |
|-------|---------|
| Location | Line number or timestamp range |
| Category | Grammar / Speaker / Factual / Timestamps / Completeness / Formatting |
| Severity | **Critical** / **Major** / **Minor** |
| Description | What is wrong |
| Suggestion | Proposed correction (if deterministic) |

---

**End with an overall quality score (0–100) and a prioritised top-5 fix list.**
"""


@mcp.prompt()
def quick_review() -> str:
    """
    Quick review mode — flags only critical errors. Use for fast triage when
    time is limited or the transcript is a first-pass draft.
    """
    return """\
You are a transcript reviewer performing a QUICK REVIEW. Focus exclusively on \
**critical errors** that affect comprehension or integrity.

Flag only the following issue types:

1. **Speaker Misidentification** — text attributed to the wrong speaker
2. **Missing Timestamps** — lines without timestamps when others have them
3. **[inaudible] Clusters** — three or more consecutive inaudible segments
4. **Factual Contradictions** — directly contradictory statements in the same file
5. **Truncation** — transcript ends mid-sentence or mid-thought

---

**Output format — one bullet per issue:**
- `[TYPE]` `timestamp or line range` — one-sentence description

Skip all minor grammar, spelling, and formatting issues.

**Close with a three-line summary:**
- Total critical issues found: N
- Most urgent fix: <one line>
- Overall impact: High / Medium / Low
"""


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    mcp.run()
