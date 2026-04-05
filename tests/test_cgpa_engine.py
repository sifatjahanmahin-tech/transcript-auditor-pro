"""
Tests for the CGPA Engine (Level 2).

Comprehensive suite covering: grade point conversion, weighted CGPA calc,
W/F handling, retake replacement, waiver exclusion, edge cases,
and boundary conditions.
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.data_models import TranscriptEntry, NSU_GRADE_POINTS
from parsers.transcript_parser import parse_transcript
from engine.cgpa_engine import calculate_cgpa


# ══════════════════════════════════════════════
# Grade Point Mapping Tests
# ══════════════════════════════════════════════

class TestGradePointMapping(unittest.TestCase):
    """Verify the NSU grade scale is correct."""

    def test_a_is_4_0(self):
        self.assertEqual(NSU_GRADE_POINTS["A"], 4.0)

    def test_a_minus_is_3_7(self):
        self.assertEqual(NSU_GRADE_POINTS["A-"], 3.7)

    def test_b_plus_is_3_3(self):
        self.assertEqual(NSU_GRADE_POINTS["B+"], 3.3)

    def test_b_is_3_0(self):
        self.assertEqual(NSU_GRADE_POINTS["B"], 3.0)

    def test_b_minus_is_2_7(self):
        self.assertEqual(NSU_GRADE_POINTS["B-"], 2.7)

    def test_c_plus_is_2_3(self):
        self.assertEqual(NSU_GRADE_POINTS["C+"], 2.3)

    def test_c_is_2_0(self):
        self.assertEqual(NSU_GRADE_POINTS["C"], 2.0)

    def test_c_minus_is_1_7(self):
        self.assertEqual(NSU_GRADE_POINTS["C-"], 1.7)

    def test_d_plus_is_1_3(self):
        self.assertEqual(NSU_GRADE_POINTS["D+"], 1.3)

    def test_d_is_1_0(self):
        self.assertEqual(NSU_GRADE_POINTS["D"], 1.0)

    def test_f_is_0_0(self):
        self.assertEqual(NSU_GRADE_POINTS["F"], 0.0)

    def test_w_not_in_scale(self):
        self.assertNotIn("W", NSU_GRADE_POINTS)

    def test_i_not_in_scale(self):
        self.assertNotIn("I", NSU_GRADE_POINTS)


# ══════════════════════════════════════════════
# CGPA Calculation Tests
# ══════════════════════════════════════════════

class TestCGPABasic(unittest.TestCase):
    """Basic CGPA calculations."""

    def _get_csv_path(self, filename: str) -> str:
        """Return the absolute path to a test CSV file."""
        return os.path.join(os.path.dirname(__file__), "data", "cgpa", filename)

    def test_single_a_course(self):
        csv = self._get_csv_path("test_single_a_course.csv")
        entries = parse_transcript(csv)
        cgpa, _, _ = calculate_cgpa(entries)
        self.assertEqual(cgpa, 4.0)

    def test_single_f_course(self):
        """Unremediated F counts as 0.0 in CGPA."""
        csv = self._get_csv_path("test_single_f_course.csv")
        entries = parse_transcript(csv)
        cgpa, _, _ = calculate_cgpa(entries)
        self.assertEqual(cgpa, 0.0)

    def test_two_courses_weighted(self):
        """A(3cr) + B(3cr) = (12+9)/6 = 3.5"""
        csv = self._get_csv_path("test_two_courses_weighted.csv")
        entries = parse_transcript(csv)
        cgpa, _, _ = calculate_cgpa(entries)
        self.assertEqual(cgpa, 3.5)

    def test_three_different_grades(self):
        """A(3) + B+(3) + C(3) = (12+9.9+6)/9 = 3.1"""
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("MAT120", "Calc", "B+", 3, "Fall 2022"),
            TranscriptEntry("ENG101", "English", "C", 3, "Fall 2022"),
        ]
        cgpa, _, _ = calculate_cgpa(entries)
        self.assertEqual(cgpa, 3.1)

    def test_unequal_credit_weights(self):
        """A(6cr) + C(3cr) = (24+6)/9 = 3.33"""
        entries = [
            TranscriptEntry("CSE499", "Senior", "A", 6, "Spring 2025"),
            TranscriptEntry("ENG101", "English", "C", 3, "Fall 2022"),
        ]
        cgpa, _, _ = calculate_cgpa(entries)
        self.assertEqual(cgpa, 3.33)


class TestCGPAExclusions(unittest.TestCase):
    """Tests for grades excluded from CGPA."""

    def _get_csv_path(self, filename: str) -> str:
        """Return the absolute path to a test CSV file."""
        return os.path.join(os.path.dirname(__file__), "data", "cgpa", filename)

    def test_w_excluded_from_cgpa(self):
        csv = self._get_csv_path("test_w_excluded_from_cgpa.csv")
        entries = parse_transcript(csv)
        cgpa, _, total_cr = calculate_cgpa(entries)
        self.assertEqual(cgpa, 4.0)
        self.assertEqual(total_cr, 3)

    def test_blank_excluded_from_cgpa(self):
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("ENG103", "Writing", "", 3, "Fall 2023"),
        ]
        cgpa, _, total_cr = calculate_cgpa(entries)
        self.assertEqual(cgpa, 4.0)
        self.assertEqual(total_cr, 3)

    def test_zero_credit_excluded(self):
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("PHY108", "Physics Lab", "A", 0, "Fall 2022"),
        ]
        cgpa, _, total_cr = calculate_cgpa(entries)
        self.assertEqual(cgpa, 4.0)
        self.assertEqual(total_cr, 3)

    def test_multiple_w_excluded(self):
        """Two W grades and one pass — W's fully excluded."""
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("CSE173", "Discrete", "W", 3, "Spring 2023"),
            TranscriptEntry("MAT120", "Calc", "W", 3, "Spring 2023"),
        ]
        cgpa, _, total_cr = calculate_cgpa(entries)
        self.assertEqual(cgpa, 4.0)
        self.assertEqual(total_cr, 3)

    def test_all_w_returns_zero(self):
        """All W grades — CGPA should be 0.0 (no courses to calculate)."""
        entries = [
            TranscriptEntry("CSE115", "Prog I", "W", 3, "Fall 2022"),
            TranscriptEntry("MAT120", "Calc", "W", 3, "Fall 2022"),
        ]
        cgpa, _, _ = calculate_cgpa(entries)
        self.assertEqual(cgpa, 0.0)


class TestCGPARetakes(unittest.TestCase):
    """Retake resolution in CGPA."""

    def _get_csv_path(self, filename: str) -> str:
        """Return the absolute path to a test CSV file."""
        return os.path.join(os.path.dirname(__file__), "data", "cgpa", filename)

    def test_f_replaced_by_retake(self):
        """F→B+ retake: only B+ should count."""
        csv = self._get_csv_path("test_f_replaced_by_retake.csv")
        entries = parse_transcript(csv)
        cgpa, _, _ = calculate_cgpa(entries)
        self.assertEqual(cgpa, 3.3)

    def test_f_counts_if_not_retaken(self):
        """Unremediated F hurts GPA. A(3)+F(3) = (12+0)/6 = 2.0"""
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("HIS103", "History", "F", 3, "Fall 2022"),
        ]
        cgpa, _, _ = calculate_cgpa(entries)
        self.assertEqual(cgpa, 2.0)

    def test_w_then_pass_retake(self):
        entries = [
            TranscriptEntry("CSE173", "Discrete", "W", 3, "Spring 2023"),
            TranscriptEntry("CSE173", "Discrete", "B", 3, "Fall 2023"),
        ]
        cgpa, _, _ = calculate_cgpa(entries)
        self.assertEqual(cgpa, 3.0)


class TestCGPAWaivers(unittest.TestCase):
    """Waiver exclusion from CGPA."""

    def test_waiver_excluded(self):
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("BUS112", "Accounting", "C", 3, "Spring 2023"),
        ]
        cgpa, _, total_cr = calculate_cgpa(entries, waived_codes={"BUS112"})
        self.assertEqual(cgpa, 4.0)
        self.assertEqual(total_cr, 3)

    def test_multiple_waivers(self):
        entries = [
            TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022"),
            TranscriptEntry("BUS112", "Accounting", "C", 3, "Spring 2023"),
            TranscriptEntry("ENG102", "English II", "B-", 3, "Spring 2023"),
        ]
        cgpa, _, total_cr = calculate_cgpa(entries, waived_codes={"BUS112", "ENG102"})
        self.assertEqual(cgpa, 4.0)
        self.assertEqual(total_cr, 3)

    def test_waiver_of_nonexistent_course(self):
        """Waiving a course not in transcript should have no effect."""
        entries = [TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022")]
        cgpa, _, _ = calculate_cgpa(entries, waived_codes={"XYZ999"})
        self.assertEqual(cgpa, 4.0)


class TestCGPAEdgeCases(unittest.TestCase):
    """Edge cases and boundary conditions."""

    def test_empty_transcript(self):
        cgpa, _, _ = calculate_cgpa([])
        self.assertEqual(cgpa, 0.0)

    def test_only_zero_credit_courses(self):
        entries = [
            TranscriptEntry("PHY108", "Lab", "A", 0, "Fall 2022"),
            TranscriptEntry("CSE424", "Lab", "B+", 0, "Fall 2024"),
        ]
        cgpa, _, _ = calculate_cgpa(entries)
        self.assertEqual(cgpa, 0.0)

    def test_quality_points_returned(self):
        """Verify quality points = sum(gp * credits)."""
        entries = [TranscriptEntry("CSE115", "Prog I", "A", 3, "Fall 2022")]
        _, qp, _ = calculate_cgpa(entries)
        self.assertEqual(qp, 12.0)  # 4.0 * 3

    def test_all_same_grade(self):
        """All B (3.0): CGPA should be exactly 3.0."""
        entries = [
            TranscriptEntry("CSE115", "Prog I", "B", 3, "Fall 2022"),
            TranscriptEntry("MAT120", "Calc", "B", 3, "Fall 2022"),
            TranscriptEntry("ENG101", "English", "B", 3, "Fall 2022"),
        ]
        cgpa, _, _ = calculate_cgpa(entries)
        self.assertEqual(cgpa, 3.0)

    def test_probation_boundary_exactly_2_0(self):
        """CGPA exactly 2.0 — NOT on probation."""
        entries = [TranscriptEntry("CSE115", "Prog I", "C", 3, "Fall 2022")]
        cgpa, _, _ = calculate_cgpa(entries)
        self.assertEqual(cgpa, 2.0)


if __name__ == "__main__":
    unittest.main()
