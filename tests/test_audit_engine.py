"""
Tests for the Audit Engine (Level 3).

Comprehensive suite covering: missing course detection, waiver handling,
probation flagging, retake scenarios, completed courses list,
and edge cases.
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.data_models import TranscriptEntry, ProgramRequirements
from parsers.transcript_parser import parse_transcript
from engine.audit_engine import run_audit


def _make_program():
    """Standard test program with 3 categories."""
    return ProgramRequirements(
        program_name="Test CS Program",
        total_required_credits=30,
        mandatory_courses={
            "Core": ["CSE115", "CSE215", "CSE225"],
            "Math": ["MAT120"],
            "General": ["ENG101", "BUS112"],
        },
    )


def _make_full_entries():
    """Full set of passing entries covering the test program."""
    csv_path = os.path.join(os.path.dirname(__file__), "data", "audit", "audit_full_transcript.csv")
    return parse_transcript(csv_path)


# ══════════════════════════════════════════════
# Missing Course Detection
# ══════════════════════════════════════════════

class TestAuditMissingCourses(unittest.TestCase):

    def _get_csv_path(self, filename: str) -> str:
        """Return the absolute path to a test CSV file."""
        return os.path.join(os.path.dirname(__file__), "data", "audit", filename)

    def test_all_completed_no_missing(self):
        result = run_audit(_make_full_entries(), _make_program())
        self.assertEqual(result.missing_courses, {})

    def test_missing_from_one_category(self):
        csv = self._get_csv_path("test_missing_from_one_category.csv")
        entries = parse_transcript(csv)
        result = run_audit(entries, _make_program())
        self.assertIn("Core", result.missing_courses)
        self.assertIn("CSE215", result.missing_courses["Core"])
        self.assertIn("CSE225", result.missing_courses["Core"])
        self.assertNotIn("Math", result.missing_courses)
        self.assertNotIn("General", result.missing_courses)

    def test_missing_from_multiple_categories(self):
        csv = self._get_csv_path("test_missing_from_multiple_categories.csv")
        entries = parse_transcript(csv)
        result = run_audit(entries, _make_program())
        self.assertIn("Core", result.missing_courses)
        self.assertIn("Math", result.missing_courses)
        self.assertIn("General", result.missing_courses)

    def test_f_grade_course_is_missing(self):
        """Course with only an F should be flagged as missing."""
        csv = self._get_csv_path("test_f_grade_course_is_missing.csv")
        entries = parse_transcript(csv)
        result = run_audit(entries, _make_program())
        self.assertIn("Core", result.missing_courses)
        self.assertIn("CSE115", result.missing_courses["Core"])

    def test_w_grade_course_is_missing(self):
        """Course with only a W should be flagged as missing."""
        csv = self._get_csv_path("test_w_grade_course_is_missing.csv")
        entries = parse_transcript(csv)
        result = run_audit(entries, _make_program())
        self.assertIn("Core", result.missing_courses)
        self.assertIn("CSE115", result.missing_courses["Core"])

    def test_empty_transcript_all_missing(self):
        """Empty transcript — every mandatory course is missing."""
        result = run_audit([], _make_program())
        total_missing = sum(len(v) for v in result.missing_courses.values())
        self.assertEqual(total_missing, 6)  # all 6 mandatory courses


# ══════════════════════════════════════════════
# Waiver Handling
# ══════════════════════════════════════════════

class TestAuditWaivers(unittest.TestCase):

    def _get_csv_path(self, filename: str) -> str:
        """Return the absolute path to a test CSV file."""
        return os.path.join(os.path.dirname(__file__), "data", "audit", filename)

    def test_waived_course_not_missing(self):
        csv = self._get_csv_path("test_waived_course_not_missing.csv")
        entries = parse_transcript(csv)
        result = run_audit(entries, _make_program(), waived_codes={"BUS112"})
        self.assertNotIn("General", result.missing_courses)

    def test_waived_course_in_completed_list(self):
        """Waived course should appear in completed_courses."""
        result = run_audit([], _make_program(), waived_codes={"BUS112"})
        self.assertIn("BUS112", result.completed_courses)

    def test_multiple_waivers(self):
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("CSE215", "Prog II", "A", 3, "Spring 2023"),
            TranscriptEntry("CSE225", "DS&A", "A", 3, "Fall 2023"),
            TranscriptEntry("MAT120", "Calc", "A", 3, "Fall 2022"),
        ]
        result = run_audit(entries, _make_program(), waived_codes={"ENG101", "BUS112"})
        self.assertEqual(result.missing_courses, {})

    def test_waiver_for_f_course_overrides(self):
        """If a course has F but is also waived, it should count as satisfied."""
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("CSE215", "Prog II", "A", 3, "Spring 2023"),
            TranscriptEntry("CSE225", "DS&A", "A", 3, "Fall 2023"),
            TranscriptEntry("MAT120", "Calc", "A", 3, "Fall 2022"),
            TranscriptEntry("ENG101", "English", "A", 3, "Fall 2022"),
            TranscriptEntry("BUS112", "Accounting", "F", 3, "Spring 2023"),
        ]
        result = run_audit(entries, _make_program(), waived_codes={"BUS112"})
        self.assertNotIn("General", result.missing_courses)


# ══════════════════════════════════════════════
# Probation Flagging
# ══════════════════════════════════════════════

class TestProbation(unittest.TestCase):

    def _get_csv_path(self, filename: str) -> str:
        """Return the absolute path to a test CSV file."""
        return os.path.join(os.path.dirname(__file__), "data", "audit", filename)

    def test_low_gpa_triggers_probation(self):
        csv = self._get_csv_path("test_low_gpa_triggers_probation.csv")
        entries = parse_transcript(csv)
        result = run_audit(entries, _make_program())
        self.assertTrue(result.on_probation)

    def test_good_gpa_no_probation(self):
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("CSE215", "Prog II", "A", 3, "Spring 2023"),
        ]
        result = run_audit(entries, _make_program())
        self.assertFalse(result.on_probation)

    def test_cgpa_exactly_2_not_probation(self):
        """CGPA == 2.0 is NOT probation (threshold is strictly < 2.0)."""
        entries = [TranscriptEntry("CSE115", "Prog I", "C", 3, "Fall 2022")]
        result = run_audit(entries, _make_program())
        self.assertFalse(result.on_probation)

    def test_cgpa_1_99_is_probation(self):
        """CGPA just below 2.0 should flag probation."""
        # C-(1.7) + C(2.0) = (5.1+6)/6 = 1.85
        entries = [
            TranscriptEntry("CSE115", "Prog I", "C-", 3, "Fall 2022"),
            TranscriptEntry("CSE215", "Prog II", "C", 3, "Spring 2023"),
        ]
        result = run_audit(entries, _make_program())
        self.assertTrue(result.on_probation)

    def test_all_f_is_probation(self):
        entries = [
            TranscriptEntry("CSE115", "Prog I", "F", 3, "Fall 2022"),
            TranscriptEntry("MAT120", "Calc", "F", 3, "Fall 2022"),
        ]
        result = run_audit(entries, _make_program())
        self.assertTrue(result.on_probation)


# ══════════════════════════════════════════════
# Retake Scenarios in Audit
# ══════════════════════════════════════════════

class TestRetakeInAudit(unittest.TestCase):

    def _get_csv_path(self, filename: str) -> str:
        """Return the absolute path to a test CSV file."""
        return os.path.join(os.path.dirname(__file__), "data", "audit", filename)

    def test_retake_clears_course_from_missing(self):
        program = ProgramRequirements("Test", 3, {"Gen": ["HIS103"]})
        csv = self._get_csv_path("test_retake_clears_course_from_missing.csv")
        entries = parse_transcript(csv)
        result = run_audit(entries, program)
        self.assertEqual(result.missing_courses, {})
        self.assertIn("HIS103", result.completed_courses)

    def test_retake_still_f_stays_missing(self):
        """F→F retake: course is still missing."""
        program = ProgramRequirements("Test", 3, {"Gen": ["HIS103"]})
        csv = self._get_csv_path("test_retake_still_f_stays_missing.csv")
        entries = parse_transcript(csv)
        result = run_audit(entries, program)
        self.assertIn("Gen", result.missing_courses)
        self.assertIn("HIS103", result.missing_courses["Gen"])

    def test_retake_credits_only_counted_once(self):
        csv = self._get_csv_path("test_retake_clears_course_from_missing.csv")
        entries = parse_transcript(csv)
        result = run_audit(entries, _make_program())
        # HIS103 is not in the test program mandatory list, but credits = 3
        self.assertEqual(result.total_valid_credits, 3)


# ══════════════════════════════════════════════
# Completed Courses List
# ══════════════════════════════════════════════

class TestCompletedCourses(unittest.TestCase):

    def _get_csv_path(self, filename: str) -> str:
        """Return the absolute path to a test CSV file."""
        return os.path.join(os.path.dirname(__file__), "data", "audit", filename)

    def test_completed_list_sorted(self):
        result = run_audit(_make_full_entries(), _make_program())
        self.assertEqual(result.completed_courses, sorted(result.completed_courses))

    def test_completed_includes_passing_only(self):
        csv = self._get_csv_path("test_completed_includes_passing_only.csv")
        entries = parse_transcript(csv)
        result = run_audit(entries, _make_program())
        self.assertIn("CSE115", result.completed_courses)
        self.assertNotIn("HIS103", result.completed_courses)
        self.assertNotIn("CSE173", result.completed_courses)

    def test_extra_courses_in_completed(self):
        """Non-mandatory courses should still appear in completed list."""
        csv = self._get_csv_path("test_extra_courses_in_completed.csv")
        entries = parse_transcript(csv)
        result = run_audit(entries, _make_program())
        self.assertIn("CSE440", result.completed_courses)


if __name__ == "__main__":
    unittest.main()
