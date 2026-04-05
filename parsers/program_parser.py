"""
Program Markdown Parser.

Reads a program_knowledge.md file and extracts mandatory course
requirements grouped by category. Flexible enough to handle any
program structure defined in the markdown.
"""

import re
import sys
from typing import List

sys.path.insert(0, ".")

from models.data_models import ProgramRequirements


def parse_program(filepath: str, program_name: str) -> ProgramRequirements:
    """
    Parse a program requirements markdown file.

    Expected format:
        # Program Name
        Total Required Credits: NNN
        ## Category Name
        - COURSE_CODE Course Title
        - COURSE_CODE Course Title

    Args:
        filepath: Path to the .md file.
        program_name: Name of the program to look for (matched flexibly).

    Returns:
        ProgramRequirements with mandatory courses grouped by category.

    Raises:
        ValueError: If the program is not found in the file.
    """
    with open(filepath, encoding="utf-8") as f:
        content = f.read()

    # ── Split into program sections (top-level # headings) ──
    sections = re.split(r"(?=^# )", content, flags=re.MULTILINE)
    sections = [s.strip() for s in sections if s.strip()]

    target_section = None
    for section in sections:
        first_line = section.split("\n", 1)[0]
        heading_text = first_line.lstrip("# ").strip()
        if _fuzzy_match(heading_text, program_name):
            target_section = section
            break

    if target_section is None:
        # If there's only one section, use it by default
        if len(sections) == 1:
            target_section = sections[0]
            first_line = target_section.split("\n", 1)[0]
            heading_text = first_line.lstrip("# ").strip()
        else:
            available = [s.split("\n", 1)[0].lstrip("# ").strip() for s in sections]
            raise ValueError(
                f"Program '{program_name}' not found.\n"
                f"Available programs: {', '.join(available)}"
            )

    # ── Extract total required credits ──
    credits_match = re.search(r"Total Required Credits:\s*(\d+)", target_section)
    total_credits = int(credits_match.group(1)) if credits_match else 0

    # ── Parse categories (## headings) and their courses ──
    mandatory_courses = {}
    category_blocks = re.split(r"(?=^## )", target_section, flags=re.MULTILINE)

    for block in category_blocks:
        block = block.strip()
        if not block.startswith("## "):
            continue

        lines = block.split("\n")
        category_name = lines[0].lstrip("# ").strip()
        courses = []

        for line in lines[1:]:
            line = line.strip()
            # Match bullet items: "- CSE115 Programming Language I"
            match = re.match(r"^[-*]\s+(\w+\d+)\b", line)
            if match:
                courses.append(match.group(1).upper())

        if courses:
            mandatory_courses[category_name] = courses

    return ProgramRequirements(
        program_name=heading_text,
        total_required_credits=total_credits,
        mandatory_courses=mandatory_courses,
    )


def _fuzzy_match(text: str, query: str) -> bool:
    """
    Case-insensitive substring match with normalization.
    Strips non-alphanumeric chars for a more flexible comparison.
    """
    def normalize(s: str) -> str:
        return re.sub(r"[^a-z0-9]", "", s.lower())

    return normalize(query) in normalize(text) or normalize(text) in normalize(query)
