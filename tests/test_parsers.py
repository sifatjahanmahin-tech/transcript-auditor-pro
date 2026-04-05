"""
Tests for the Parsers (Transcript CSV + Program Markdown).

Covers: CSV parsing with messy data, markdown parsing with
flexible program matching, edge cases.
"""

import sys
import os
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from parsers.transcript_parser import parse_transcript
from parsers.program_parser import parse_program


# ══════════════════════════════════════════════
# Transcript CSV Parser Tests
# ══════════════════════════════════════════════

class TestTranscriptParser(unittest.TestCase):

    def _get_csv_path(self, filename: str) -> str:
        """Return the absolute path to a test CSV file."""
        return os.path.join(os.path.dirname(__file__), "data", "parsers", filename)

    def tearDown(self):
        # Clean up temp files
        pass

    def test_basic_parse(self):
        csv = self._get_csv_path("test_basic_parse.csv")
        entries = parse_transcript(csv)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].course_code, "CSE115")
        self.assertEqual(entries[0].grade, "A")
        self.assertEqual(entries[0].credits, 3.0)

    def test_whitespace_handling(self):
        csv = self._get_csv_path("test_whitespace_handling.csv")
        entries = parse_transcript(csv)
        self.assertEqual(entries[0].course_code, "CSE115")
        self.assertEqual(entries[0].grade, "A")

    def test_empty_grade(self):
        csv = self._get_csv_path("test_empty_grade.csv")
        entries = parse_transcript(csv)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].grade, "")

    def test_missing_course_code_skipped(self):
        csv = self._get_csv_path("test_missing_course_code_skipped.csv")
        entries = parse_transcript(csv)
        self.assertEqual(len(entries), 0)

    def test_non_numeric_credits_defaults_to_zero(self):
        csv = self._get_csv_path("test_non_numeric_credits_defaults_to_zero.csv")
        entries = parse_transcript(csv)
        self.assertEqual(entries[0].credits, 0.0)

    def test_multiple_rows(self):
        csv = self._get_csv_path("test_multiple_rows.csv")
        entries = parse_transcript(csv)
        self.assertEqual(len(entries), 3)

    def test_grade_case_normalization(self):
        """Lowercase grades should be uppercased."""
        csv = self._get_csv_path("test_grade_case_normalization.csv")
        entries = parse_transcript(csv)
        self.assertEqual(entries[0].grade, "A")

    def test_course_code_uppercased(self):
        csv = self._get_csv_path("test_course_code_uppercased.csv")
        entries = parse_transcript(csv)
        self.assertEqual(entries[0].course_code, "CSE115")


# ══════════════════════════════════════════════
# Program Markdown Parser Tests
# ══════════════════════════════════════════════

class TestProgramParser(unittest.TestCase):

    def _write_md(self, content: str) -> str:
        """Write content to a temp .md file and return its path."""
        f = tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False, encoding="utf-8")
        f.write(content)
        f.close()
        return f.name

    def test_basic_parse(self):
        md = self._write_md(
            "# Computer Science\n\n"
            "Total Required Credits: 120\n\n"
            "## Core\n\n"
            "- CSE115 Prog I\n"
            "- CSE215 Prog II\n"
        )
        prog = parse_program(md, "Computer Science")
        self.assertEqual(prog.total_required_credits, 120)
        self.assertIn("Core", prog.mandatory_courses)
        self.assertEqual(prog.mandatory_courses["Core"], ["CSE115", "CSE215"])

    def test_multiple_categories(self):
        md = self._write_md(
            "# CS Program\n\n"
            "Total Required Credits: 130\n\n"
            "## Core\n\n- CSE115 Prog I\n\n"
            "## Math\n\n- MAT120 Calculus\n"
        )
        prog = parse_program(md, "CS Program")
        self.assertEqual(len(prog.mandatory_courses), 2)
        self.assertIn("Core", prog.mandatory_courses)
        self.assertIn("Math", prog.mandatory_courses)

    def test_fuzzy_name_match(self):
        """Should match even with partial name."""
        md = self._write_md(
            "# Computer Science & Engineering\n\n"
            "## Core\n\n- CSE115 Prog I\n"
        )
        prog = parse_program(md, "Computer Science")
        self.assertEqual(prog.program_name, "Computer Science & Engineering")

    def test_all_mandatory_codes_flattened(self):
        md = self._write_md(
            "# CS\n\n"
            "## Core\n\n- CSE115 Prog\n- CSE215 Prog II\n\n"
            "## Math\n\n- MAT120 Calc\n"
        )
        prog = parse_program(md, "CS")
        all_codes = prog.all_mandatory_codes()
        self.assertEqual(set(all_codes), {"CSE115", "CSE215", "MAT120"})

    def test_missing_total_credits_defaults_zero(self):
        md = self._write_md("# CS\n\n## Core\n\n- CSE115 Prog\n")
        prog = parse_program(md, "CS")
        self.assertEqual(prog.total_required_credits, 0)

    def test_program_not_found_raises(self):
        md = self._write_md(
            "# Physics\n\n## Core\n\n- PHY101 Intro\n\n"
            "# Chemistry\n\n## Core\n\n- CHE101 Intro\n"
        )
        with self.assertRaises(ValueError):
            parse_program(md, "Computer Science")

    def test_single_section_auto_select(self):
        """If only one program in file, auto-select it even if name doesn't match."""
        md = self._write_md("# EEE Program\n\n## Core\n\n- EEE101 Circuits\n")
        prog = parse_program(md, "anything")
        self.assertEqual(prog.program_name, "EEE Program")


if __name__ == "__main__":
    unittest.main()
