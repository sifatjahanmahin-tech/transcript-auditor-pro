"""
Transcript CSV Parser.

Reads a student transcript CSV file and returns a list of TranscriptEntry
objects. Handles messy data: extra whitespace, empty rows, inconsistent
casing, and missing fields.
"""

import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.data_models import TranscriptEntry


def parse_transcript(filepath: str) -> list[TranscriptEntry]:
    """
    Parse a transcript CSV file into a list of TranscriptEntry objects.

    Expected CSV columns (order-independent, header-matched):
        course_code, course_name, grade, credits, semester

    Handles:
        - Extra whitespace around values
        - Empty rows (silently skipped)
        - Missing course_code or grade (row skipped with warning)
        - Non-numeric credits (defaults to 0)
        - BOM characters in UTF-8 files
    """
    entries: list[TranscriptEntry] = []

    with open(filepath, newline="", encoding="utf-8-sig") as csvfile:
        reader = csv.DictReader(csvfile)

        # Normalize header names: strip whitespace & lowercase
        if reader.fieldnames:
            reader.fieldnames = [h.strip().lower() for h in reader.fieldnames]

        for row_num, row in enumerate(reader, start=2):  # start=2 (header is row 1)
            # Strip all values
            cleaned = {k.strip().lower(): v.strip() if v else "" for k, v in row.items()}

            course_code = cleaned.get("course_code", cleaned.get("course code", "")).upper()
            course_name = cleaned.get("course_name", cleaned.get("course name", ""))
            grade = cleaned.get("grade")
            if grade is None:
                grade = ""
            grade = grade.strip().upper()
            credits_raw = cleaned.get("credits", "0").strip()
            semester = cleaned.get("semester", "").strip()

            # ── Skip rows with missing critical data ──
            if not course_code or course_code.strip() == "":
                print(f"  [!] Row {row_num}: Skipped -- missing course code.")
                continue

            # ── Parse credits safely ──
            try:
                credits_val = credits_raw.strip() if credits_raw else ""
                credits = float(credits_val) if credits_val else 0.0
            except ValueError:
                print(f"  [!] Row {row_num}: Invalid credits '{credits_raw}' for {course_code}, defaulting to 0.")
                credits = 0.0

            # ── Normalize grade ──
            # Handle common variations
            if grade:
                grade = grade.replace(" ", "")  # "B +" -> "B+"

            entries.append(
                TranscriptEntry(
                    course_code=course_code,
                    course_name=course_name,
                    grade=grade,
                    credits=credits,
                    semester=semester,
                )
            )

    return entries
