"""
Core transcript analysis logic.

Handles conversational/speech transcripts in common formats:
  [HH:MM:SS] SPEAKER: text
  HH:MM:SS SPEAKER: text
  SPEAKER (HH:MM:SS): text
  SPEAKER: text  (no timestamp)
"""

from __future__ import annotations

import difflib
import json
import re
from typing import Any

# ── Regex patterns ────────────────────────────────────────────────────────────
_TS_BRACKET = re.compile(r"\[(\d{1,2}:\d{2}(?::\d{2})?)\]")
_TS_PAREN = re.compile(r"\((\d{1,2}:\d{2}(?::\d{2})?)\)")
_TS_PLAIN = re.compile(r"^(\d{1,2}:\d{2}(?::\d{2})?)\s+")
_SPEAKER_LABEL = re.compile(r"^([A-Za-z][A-Za-z0-9 _\-'\.]{0,49}):\s*(.*)", re.DOTALL)
_INAUDIBLE = re.compile(r"\[inaudible\]", re.IGNORECASE)
_CROSSTALK = re.compile(r"\[(?:crosstalk|overlap|overtalk)\]", re.IGNORECASE)
_TOPIC_HINT = re.compile(
    r"\b(agenda|topic|item|discuss(?:ion)?|talk about|let'?s move|next up|regarding|"
    r"question|announce(?:ment)?|update on|follow.up)\b",
    re.IGNORECASE,
)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _parse_timestamp(raw: str) -> str | None:
    for pattern in (_TS_BRACKET, _TS_PAREN, _TS_PLAIN):
        m = pattern.search(raw)
        if m:
            return m.group(1)
    return None


def _ts_to_seconds(ts: str | None) -> int | None:
    if not ts:
        return None
    parts = list(map(int, ts.split(":")))
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return None


def _ts_format(ts: str | None) -> str | None:
    if not ts:
        return None
    return "long" if ts.count(":") == 2 else "short"


def _strip_timestamp(line: str) -> str:
    line = _TS_BRACKET.sub("", line)
    line = _TS_PAREN.sub("", line)
    line = _TS_PLAIN.sub("", line)
    return line.strip()


def _parse_lines(text: str) -> list[dict[str, Any]]:
    """Convert raw transcript text into structured line dicts."""
    result: list[dict[str, Any]] = []
    for i, raw in enumerate(text.splitlines(), 1):
        stripped = raw.strip()
        if not stripped:
            continue

        timestamp = _parse_timestamp(stripped)
        body = _strip_timestamp(stripped)
        sp_match = _SPEAKER_LABEL.match(body)

        result.append(
            {
                "line_no": i,
                "raw": raw,
                "timestamp": timestamp,
                "speaker": sp_match.group(1).strip() if sp_match else None,
                "text": sp_match.group(2).strip() if sp_match else body,
                "is_inaudible": bool(_INAUDIBLE.search(stripped)),
                "is_crosstalk": bool(_CROSSTALK.search(stripped)),
            }
        )
    return result


def _unique_speakers(lines: list[dict]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for ln in lines:
        s = ln["speaker"]
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def _extract_topics(lines: list[dict]) -> list[str]:
    topics: list[str] = []
    seen: set[str] = set()
    for ln in lines:
        if _TOPIC_HINT.search(ln["text"]):
            snippet = ln["text"][:80].strip()
            if snippet not in seen:
                seen.add(snippet)
                topics.append(snippet)
        if len(topics) >= 10:
            break
    return topics


# ── Main Analyzer ─────────────────────────────────────────────────────────────


class TranscriptAnalyzer:
    """Implements all MCP tool logic as plain Python methods."""

    # ── audit_transcript ──────────────────────────────────────────────────────

    def audit(self, transcript: str) -> dict[str, Any]:
        lines = _parse_lines(transcript)
        speakers = _unique_speakers(lines)
        issues = self._collect_issues(lines)

        total_words = sum(len(ln["text"].split()) for ln in lines)
        inaudible_n = sum(1 for ln in lines if ln["is_inaudible"])
        crosstalk_n = sum(1 for ln in lines if ln["is_crosstalk"])

        deduct = {"critical": 10, "major": 5, "minor": 1}
        score = max(0, 100 - sum(deduct.get(i["severity"], 1) for i in issues))

        return {
            "summary": {
                "total_lines": len(lines),
                "total_words": total_words,
                "speaker_count": len(speakers),
                "speakers": speakers,
                "inaudible_segments": inaudible_n,
                "crosstalk_segments": crosstalk_n,
                "issue_count": len(issues),
                "quality_score": score,
            },
            "issues": issues,
            "suspicious_segments": self._suspicious(lines),
        }

    def _suspicious(self, lines: list[dict]) -> list[dict]:
        out = []
        for ln in lines:
            flags = []
            if ln["is_inaudible"]:
                flags.append("inaudible")
            if ln["is_crosstalk"]:
                flags.append("crosstalk")
            if ln["speaker"] and not ln["is_inaudible"] and len(ln["text"]) < 5:
                flags.append("unusually_short_utterance")
            if flags:
                out.append(
                    {
                        "line_no": ln["line_no"],
                        "timestamp": ln["timestamp"],
                        "speaker": ln["speaker"],
                        "text": ln["raw"],
                        "flags": flags,
                    }
                )
        return out

    # ── summarize_transcript ──────────────────────────────────────────────────

    def summarize(self, transcript: str) -> dict[str, Any]:
        lines = _parse_lines(transcript)
        speakers = _unique_speakers(lines)
        topics = _extract_topics(lines)

        ts_seconds = [_ts_to_seconds(ln["timestamp"]) for ln in lines if ln["timestamp"]]
        duration = (max(ts_seconds) - min(ts_seconds)) if len(ts_seconds) >= 2 else 0

        word_counts: dict[str, int] = {}
        for ln in lines:
            if ln["speaker"]:
                word_counts[ln["speaker"]] = word_counts.get(ln["speaker"], 0) + len(ln["text"].split())

        key_moments: list[dict] = []
        prev_speaker: str | None = None
        for ln in lines:
            if ln["speaker"] and ln["speaker"] != prev_speaker and ln["timestamp"]:
                key_moments.append(
                    {
                        "timestamp": ln["timestamp"],
                        "speaker": ln["speaker"],
                        "snippet": ln["text"][:100],
                    }
                )
                prev_speaker = ln["speaker"]
                if len(key_moments) >= 20:
                    break

        return {
            "duration_seconds": duration,
            "speakers": speakers,
            "speaker_word_counts": word_counts,
            "key_topics": topics,
            "key_moments": key_moments,
            "total_lines": len(lines),
        }

    # ── compare_transcripts ───────────────────────────────────────────────────

    def compare(
        self,
        transcript_a: str,
        transcript_b: str,
        label_a: str,
        label_b: str,
    ) -> dict[str, Any]:
        a_lines = transcript_a.splitlines()
        b_lines = transcript_b.splitlines()

        unified = "\n".join(difflib.unified_diff(a_lines, b_lines, fromfile=label_a, tofile=label_b, lineterm=""))

        added: list[dict] = []
        removed: list[dict] = []
        changed: list[dict] = []
        matcher = difflib.SequenceMatcher(None, a_lines, b_lines)

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "replace":
                changed.append(
                    {
                        "type": "changed",
                        "old_lines": list(range(i1 + 1, i2 + 1)),
                        "new_lines": list(range(j1 + 1, j2 + 1)),
                        "old": a_lines[i1:i2],
                        "new": b_lines[j1:j2],
                    }
                )
            elif tag == "delete":
                removed.append({"type": "removed", "lines": list(range(i1 + 1, i2 + 1)), "content": a_lines[i1:i2]})
            elif tag == "insert":
                added.append({"type": "added", "lines": list(range(j1 + 1, j2 + 1)), "content": b_lines[j1:j2]})

        return {
            "labels": {"a": label_a, "b": label_b},
            "similarity_ratio": round(matcher.ratio(), 4),
            "change_summary": {"added": len(added), "removed": len(removed), "changed": len(changed)},
            "added": added,
            "removed": removed,
            "changed": changed,
            "unified_diff": unified,
        }

    # ── flag_issues ───────────────────────────────────────────────────────────

    def flag_issues(self, transcript: str, checks: list[str] | None) -> dict[str, Any]:
        all_checks = {"crosstalk", "inaudible", "timestamps", "speakers", "formatting"}
        active = set(checks) if checks else all_checks
        lines = _parse_lines(transcript)
        issues = self._collect_issues(lines, active)

        by_category: dict[str, list] = {}
        for issue in issues:
            by_category.setdefault(issue["category"], []).append(issue)

        return {
            "total_issues": len(issues),
            "checks_run": sorted(active),
            "by_category": by_category,
            "all_issues": issues,
        }

    def _collect_issues(
        self,
        lines: list[dict],
        active: set[str] | None = None,
    ) -> list[dict[str, Any]]:
        if active is None:
            active = {"crosstalk", "inaudible", "timestamps", "speakers", "formatting"}

        issues: list[dict] = []
        speakers_seen: list[str] = []
        prev_ts_secs: int | None = None
        prev_ts_str: str | None = None
        detected_fmt: str | None = None
        inaudible_streak = 0

        for ln in lines:
            # ── Crosstalk ──
            if "crosstalk" in active and ln["is_crosstalk"]:
                issues.append(
                    {
                        "line_no": ln["line_no"],
                        "timestamp": ln["timestamp"],
                        "category": "crosstalk",
                        "severity": "major",
                        "description": "Crosstalk / overlapping speech detected",
                        "raw": ln["raw"],
                    }
                )

            # ── Inaudible ──
            if "inaudible" in active:
                if ln["is_inaudible"]:
                    inaudible_streak += 1
                    severity = "major" if inaudible_streak >= 3 else "minor"
                    issues.append(
                        {
                            "line_no": ln["line_no"],
                            "timestamp": ln["timestamp"],
                            "category": "inaudible",
                            "severity": severity,
                            "description": (
                                f"Inaudible segment (consecutive streak: {inaudible_streak})"
                                if inaudible_streak >= 3
                                else "Inaudible segment"
                            ),
                            "raw": ln["raw"],
                        }
                    )
                else:
                    inaudible_streak = 0

            # ── Timestamps ──
            if "timestamps" in active:
                if ln["timestamp"]:
                    cur_fmt = _ts_format(ln["timestamp"])
                    if detected_fmt is None:
                        detected_fmt = cur_fmt
                    elif detected_fmt != cur_fmt:
                        issues.append(
                            {
                                "line_no": ln["line_no"],
                                "timestamp": ln["timestamp"],
                                "category": "timestamps",
                                "severity": "minor",
                                "description": (f"Timestamp format changed from {detected_fmt} to {cur_fmt}"),
                                "raw": ln["raw"],
                            }
                        )

                    cur_secs = _ts_to_seconds(ln["timestamp"])
                    if prev_ts_secs is not None and cur_secs is not None and cur_secs < prev_ts_secs:
                        issues.append(
                            {
                                "line_no": ln["line_no"],
                                "timestamp": ln["timestamp"],
                                "category": "timestamps",
                                "severity": "critical",
                                "description": (f"Timestamp goes backwards: {prev_ts_str} → {ln['timestamp']}"),
                                "raw": ln["raw"],
                            }
                        )
                    prev_ts_secs = cur_secs
                    prev_ts_str = ln["timestamp"]
                elif ln["speaker"] and detected_fmt is not None:
                    issues.append(
                        {
                            "line_no": ln["line_no"],
                            "timestamp": None,
                            "category": "timestamps",
                            "severity": "minor",
                            "description": "Speaker line is missing a timestamp",
                            "raw": ln["raw"],
                        }
                    )

            # ── Speaker consistency ──
            if "speakers" in active and ln["speaker"]:
                for known in speakers_seen:
                    if known != ln["speaker"]:
                        ratio = difflib.SequenceMatcher(None, known.lower(), ln["speaker"].lower()).ratio()
                        if 0.70 < ratio < 1.0:
                            issues.append(
                                {
                                    "line_no": ln["line_no"],
                                    "timestamp": ln["timestamp"],
                                    "category": "speakers",
                                    "severity": "major",
                                    "description": (
                                        f"Possible speaker label inconsistency: "
                                        f"'{ln['speaker']}' vs '{known}' "
                                        f"(similarity {ratio:.0%})"
                                    ),
                                    "raw": ln["raw"],
                                }
                            )
                if ln["speaker"] not in speakers_seen:
                    speakers_seen.append(ln["speaker"])

            # ── Formatting ──
            if "formatting" in active and ln["raw"] != ln["raw"].rstrip():
                issues.append(
                    {
                        "line_no": ln["line_no"],
                        "timestamp": ln["timestamp"],
                        "category": "formatting",
                        "severity": "minor",
                        "description": "Trailing whitespace on line",
                        "raw": ln["raw"],
                    }
                )

        return issues

    # ── export_report ─────────────────────────────────────────────────────────

    def export_report(self, audit_result: dict[str, Any], fmt: str) -> str:
        if fmt.lower() == "json":
            return json.dumps(audit_result, indent=2, ensure_ascii=False)
        return self._to_markdown(audit_result)

    def _to_markdown(self, result: dict[str, Any]) -> str:
        lines: list[str] = ["# Transcript Audit Report", ""]

        # ── Summary block (from audit_transcript) ──
        summary = result.get("summary")
        if summary:
            lines += [
                "## Summary",
                "",
                "| Metric | Value |",
                "|--------|-------|",
                f"| Total Lines | {summary.get('total_lines', 'N/A')} |",
                f"| Total Words | {summary.get('total_words', 'N/A')} |",
                f"| Speakers | {', '.join(summary.get('speakers', []))} |",
                f"| Inaudible Segments | {summary.get('inaudible_segments', 0)} |",
                f"| Crosstalk Segments | {summary.get('crosstalk_segments', 0)} |",
                f"| Issues Found | {summary.get('issue_count', 0)} |",
                f"| Quality Score | {summary.get('quality_score', 'N/A')}/100 |",
                "",
            ]

        # ── Duration / topics block (from summarize_transcript) ──
        if "duration_seconds" in result:
            d = result["duration_seconds"]
            m, s = divmod(d, 60)
            speakers = result.get("speakers", [])
            lines += [
                "## Overview",
                f"- **Duration:** {m}m {s}s",
                f"- **Speakers:** {', '.join(speakers) or 'N/A'}",
                "",
            ]
            topics = result.get("key_topics", [])
            if topics:
                lines += ["## Key Topics", ""]
                lines += [f"- {t}" for t in topics]
                lines.append("")

            key_moments = result.get("key_moments", [])
            if key_moments:
                lines += ["## Key Moments", ""]
                for km in key_moments:
                    lines.append(f"- `[{km['timestamp']}]` **{km['speaker']}**: {km['snippet']}")
                lines.append("")

        # ── Issues (from audit or flag_issues) ──
        issues: list[dict] = result.get("issues") or result.get("all_issues", [])
        if issues:
            _sev_rank = {"critical": 0, "major": 1, "minor": 2}
            sorted_issues = sorted(issues, key=lambda x: _sev_rank.get(x.get("severity", "minor"), 2))
            lines += ["## Issues Found", ""]
            for issue in sorted_issues:
                sev = issue.get("severity", "minor").upper()
                cat = issue.get("category", "unknown")
                lno = issue.get("line_no", "?")
                ts = f" `[{issue['timestamp']}]`" if issue.get("timestamp") else ""
                lines.append(f"- **[{sev}]** Line {lno}{ts} `{cat}`: {issue['description']}")
            lines.append("")

        # ── Diff block (from compare_transcripts) ──
        if "unified_diff" in result:
            labels = result.get("labels", {})
            sim = result.get("similarity_ratio", 0)
            chg = result.get("change_summary", {})
            lines += [
                "## Diff",
                f"- **{labels.get('a', 'A')}** vs **{labels.get('b', 'B')}**",
                f"- Similarity: {sim:.1%}",
                f"- Added: {chg.get('added', 0)} | Removed: {chg.get('removed', 0)} | Changed: {chg.get('changed', 0)}",
                "",
                "```diff",
                result.get("unified_diff", "(no changes)"),
                "```",
                "",
            ]

        return "\n".join(lines)
