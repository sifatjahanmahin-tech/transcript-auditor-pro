"""
Tests for the Credit Engine (Level 1).

Comprehensive suite covering: retake resolution, F/W/I filtering,
0-credit exclusion, blank grades, multiple retakes, edge cases,
and total credit summation.
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.data_models import TranscriptEntry
from parsers.transcript_parser import parse_transcript
from engine.credit_engine import resolve_retakes, calculate_valid_credits


# ══════════════════════════════════════════════
# Retake Resolution Tests
# ══════════════════════════════════════════════

class TestResolveRetakesBasic(unittest.TestCase):
    """Basic retake resolution scenarios."""

    def _get_csv_path(self, filename: str) -> str:
        """Return the absolute path to a test CSV file."""
        return os.path.join(os.path.dirname(__file__), "data", "credit", filename)

    def test_keeps_best_grade_f_to_bplus(self):
        csv = self._get_csv_path("test_keeps_best_grade_f_to_bplus.csv")
        entries = parse_transcript(csv)
        resolved = resolve_retakes(entries)
        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0].grade, "B+")

    def test_keeps_better_of_two_passing(self):
        csv = self._get_csv_path("test_keeps_better_of_two_passing.csv")
        entries = parse_transcript(csv)
        resolved = resolve_retakes(entries)
        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0].grade, "A-")

    def test_no_duplicates_single_entry(self):
        entries = [TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022")]
        resolved = resolve_retakes(entries)
        self.assertEqual(len(resolved), 1)

    def test_w_then_pass(self):
        csv = self._get_csv_path("test_w_then_pass.csv")
        entries = parse_transcript(csv)
        resolved = resolve_retakes(entries)
        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0].grade, "B")

    def test_keeps_higher_grade_over_lower(self):
        csv = self._get_csv_path("test_keeps_higher_grade_over_lower.csv")
        entries = parse_transcript(csv)
        resolved = resolve_retakes(entries)
        self.assertEqual(resolved[0].grade, "A-")

    def test_same_grade_keeps_latest(self):
        csv = self._get_csv_path("test_same_grade_keeps_latest.csv")
        entries = parse_transcript(csv)
        resolved = resolve_retakes(entries)
        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0].semester, "Spring 2023")


class TestResolveRetakesAdvanced(unittest.TestCase):
    """Advanced retake scenarios."""

    def _get_csv_path(self, filename: str) -> str:
        """Return the absolute path to a test CSV file."""
        return os.path.join(os.path.dirname(__file__), "data", "credit", filename)

    def test_triple_retake_keeps_best(self):
        csv = self._get_csv_path("test_triple_retake_keeps_best.csv")
        entries = parse_transcript(csv)
        resolved = resolve_retakes(entries)
        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0].grade, "B")

    def test_triple_retake_best_in_middle(self):
        csv = self._get_csv_path("test_triple_retake_best_in_middle.csv")
        entries = parse_transcript(csv)
        resolved = resolve_retakes(entries)
        self.assertEqual(resolved[0].grade, "A")

    def test_w_then_f_then_pass(self):
        csv = self._get_csv_path("test_w_then_f_then_pass.csv")
        entries = parse_transcript(csv)
        resolved = resolve_retakes(entries)
        self.assertEqual(resolved[0].grade, "B+")

    def test_multiple_courses_with_retakes(self):
        csv = self._get_csv_path("test_multiple_courses_with_retakes.csv")
        entries = parse_transcript(csv)
        resolved = resolve_retakes(entries)
        self.assertEqual(len(resolved), 2)
        codes = {e.course_code for e in resolved}
        self.assertEqual(codes, {"HIS103", "CSE173"})

    def test_no_entries(self):
        """Empty list should return empty."""
        resolved = resolve_retakes([])
        self.assertEqual(resolved, [])

    def test_all_unique_courses(self):
        """No retakes — all courses returned."""
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("MAT120", "Calc", "B", 3, "Fall 2022"),
            TranscriptEntry("ENG101", "English", "A-", 3, "Fall 2022"),
        ]
        resolved = resolve_retakes(entries)
        self.assertEqual(len(resolved), 3)


# ══════════════════════════════════════════════
# Credit Calculation Tests
# ══════════════════════════════════════════════

class TestCalculateValidCreditsBasic(unittest.TestCase):
    """Basic credit calculation tests."""

    def _get_csv_path(self, filename: str) -> str:
        """Return the absolute path to a test CSV file."""
        return os.path.join(os.path.dirname(__file__), "data", "credit", filename)

    def test_basic_credit_sum(self):
        csv = self._get_csv_path("test_basic_credit_sum.csv")
        entries = parse_transcript(csv)
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 6)

    def test_f_excluded(self):
        csv = self._get_csv_path("test_f_excluded.csv")
        entries = parse_transcript(csv)
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 0)

    def test_w_excluded(self):
        csv = self._get_csv_path("test_w_excluded.csv")
        entries = parse_transcript(csv)
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 0)

    def test_zero_credit_lab_excluded(self):
        csv = self._get_csv_path("test_zero_credit_lab_excluded.csv")
        entries = parse_transcript(csv)
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 3)

    def test_retake_only_counts_once(self):
        csv = self._get_csv_path("test_keeps_best_grade_f_to_bplus.csv")
        entries = parse_transcript(csv)
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 3)

    def test_blank_grade_excluded(self):
        csv = self._get_csv_path("test_blank_grade_excluded.csv")
        entries = parse_transcript(csv)
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 0)


class TestCalculateValidCreditsAdvanced(unittest.TestCase):
    """Advanced credit edge cases."""

    def test_all_f_grades(self):
        """All F's should yield 0 credits."""
        entries = [
            TranscriptEntry("CSE115", "Prog I", "F", 3, "Fall 2022"),
            TranscriptEntry("MAT120", "Calc", "F", 3, "Fall 2022"),
            TranscriptEntry("ENG101", "English", "F", 3, "Fall 2022"),
        ]
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 0)

    def test_all_w_grades(self):
        """All W's should yield 0 credits."""
        entries = [
            TranscriptEntry("CSE115", "Prog I", "W", 3, "Fall 2022"),
            TranscriptEntry("MAT120", "Calc", "W", 3, "Fall 2022"),
        ]
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 0)

    def test_mix_of_passing_and_failing(self):
        """3 passing + 2 failing = only passing credits counted."""
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("MAT120", "Calc", "B", 3, "Fall 2022"),
            TranscriptEntry("ENG101", "English", "C", 3, "Fall 2022"),
            TranscriptEntry("HIS103", "History", "F", 3, "Fall 2022"),
            TranscriptEntry("CSE173", "Discrete", "W", 3, "Spring 2023"),
        ]
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 9)

    def test_large_credits_course(self):
        """6-credit course (senior project)."""
        entries = [TranscriptEntry("CSE499", "Senior Project", "A", 6, "Spring 2025")]
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 6)

    def test_d_grade_counts_as_passing(self):
        """D is a passing grade (grade point 1.0)."""
        entries = [TranscriptEntry("CSE115", "Prog I", "D", 3, "Fall 2022")]
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 3)

    def test_d_plus_counts_as_passing(self):
        """D+ is passing too."""
        entries = [TranscriptEntry("CSE115", "Prog I", "D+", 3, "Fall 2022")]
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 3)

    def test_multiple_zero_credit_labs(self):
        """Multiple 0-credit labs should all be excluded from total."""
        entries = [
            TranscriptEntry("PHY108", "Physics Lab", "A", 0, "Fall 2022"),
            TranscriptEntry("CSE424", "Networks Lab", "B+", 0, "Fall 2024"),
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
        ]
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 3)

    def test_empty_transcript(self):
        """Empty transcript should return 0."""
        total, breakdown = calculate_valid_credits([])
        self.assertEqual(total, 0)
        self.assertEqual(breakdown, [])

    def test_breakdown_has_correct_length(self):
        """Breakdown should have one entry per resolved course."""
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("MAT120", "Calc", "B", 3, "Fall 2022"),
            TranscriptEntry("HIS103", "History", "F", 3, "Fall 2022"),
            TranscriptEntry("HIS103", "History", "B+", 3, "Spring 2023"),  # retake
        ]
        total, breakdown = calculate_valid_credits(entries)
        # 3 resolved courses (HIS103 deduped)
        self.assertEqual(len(breakdown), 3)

    def test_breakdown_marks_counted_correctly(self):
        """Check the 'counted' flag in breakdown."""
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("HIS103", "History", "F", 3, "Fall 2022"),
        ]
        _, breakdown = calculate_valid_credits(entries)
        counted_map = {r["course_code"]: r["counted"] for r in breakdown}
        self.assertTrue(counted_map["CSE115"])
        self.assertFalse(counted_map["HIS103"])

    def test_i_grade_excluded(self):
        """Incomplete (I) grade should be excluded."""
        entries = [TranscriptEntry("CSE311", "DB", "I", 3, "Spring 2024")]
        total, _ = calculate_valid_credits(entries)
        self.assertEqual(total, 0)


if __name__ == "__main__":
    unittest.main()
