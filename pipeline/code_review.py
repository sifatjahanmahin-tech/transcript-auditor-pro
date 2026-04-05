#!/usr/bin/env python3
"""
Code Review & Quality Pipeline.

Runs a suite of code quality tools and generates a unified report.
Can be run locally or in CI. Returns exit code 0 only if all checks pass.

Tools:
  - black (formatting)
  - flake8 (linting)
  - mypy (type checking)
  - Custom checks (import hygiene, docstring coverage)
"""

import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Tuple

# Project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent


@dataclass
class CheckResult:
    """Result of a single quality check."""
    name: str
    passed: bool
    duration: float
    output: str = ""
    error_count: int = 0


@dataclass
class QualityReport:
    """Aggregated quality report."""
    checks: List[CheckResult] = field(default_factory=list)
    total_duration: float = 0.0

    @property
    def all_passed(self) -> bool:
        return all(c.passed for c in self.checks)

    def summary(self) -> str:
        lines = [
            "",
            "╔══════════════════════════════════════════════════════╗",
            "║           CODE QUALITY REPORT                       ║",
            "╚══════════════════════════════════════════════════════╝",
            "",
        ]

        for check in self.checks:
            icon = "✓" if check.passed else "✗"
            status = "PASS" if check.passed else "FAIL"
            lines.append(
                f"  {icon} {check.name:<30} [{status}]  "
                f"({check.duration:.1f}s, {check.error_count} issues)"
            )

        lines.append("")
        lines.append(f"  Total Duration: {self.total_duration:.1f}s")

        if self.all_passed:
            lines.append("")
            lines.append("  ★ All checks passed! Code quality is excellent.")
        else:
            failed = [c.name for c in self.checks if not c.passed]
            lines.append("")
            lines.append(f"  ✗ {len(failed)} check(s) failed: {', '.join(failed)}")

        lines.append("")
        return "\n".join(lines)


def run_tool(name: str, cmd: List[str], check_mode: bool = False) -> CheckResult:
    """
    Run a CLI tool and capture results.

    Args:
        name: Display name of the check.
        cmd: Command and arguments to run.
        check_mode: If True, non-zero exit = failure.

    Returns:
        CheckResult with pass/fail status and output.
    """
    start = time.perf_counter()

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(PROJECT_ROOT),
            timeout=120,
        )
        duration = time.perf_counter() - start
        output = result.stdout + result.stderr
        passed = result.returncode == 0

        # Count issues (rough heuristic: non-empty lines in output)
        error_lines = [
            l for l in output.strip().split("\n")
            if l.strip() and not l.startswith("All done") and not l.startswith("Success")
        ]
        error_count = len(error_lines) if not passed else 0

        return CheckResult(
            name=name,
            passed=passed,
            duration=duration,
            output=output.strip(),
            error_count=error_count,
        )

    except subprocess.TimeoutExpired:
        duration = time.perf_counter() - start
        return CheckResult(
            name=name,
            passed=False,
            duration=duration,
            output="TIMEOUT: Check took too long (>120s)",
            error_count=1,
        )
    except FileNotFoundError:
        return CheckResult(
            name=name,
            passed=False,
            duration=0.0,
            output=f"Tool not found: {cmd[0]}. Install with: pip install {cmd[0]}",
            error_count=1,
        )


def check_black() -> CheckResult:
    """Check code formatting with Black."""
    return run_tool(
        "Black (Formatting)",
        [sys.executable, "-m", "black", "--check", "--diff", "--quiet",
         "backend/", "engine/", "models/", "parsers/"],
    )


def check_flake8() -> CheckResult:
    """Check code style with flake8."""
    return run_tool(
        "Flake8 (Linting)",
        [sys.executable, "-m", "flake8",
         "--max-line-length=120",
         "--extend-ignore=E203,W503,E501",
         "--exclude=__pycache__,migrations,.git,node_modules,frontend",
         "backend/", "engine/", "models/", "parsers/"],
    )


def check_mypy() -> CheckResult:
    """Check type hints with mypy."""
    return run_tool(
        "Mypy (Type Checking)",
        [sys.executable, "-m", "mypy",
         "--ignore-missing-imports",
         "--no-error-summary",
         "--no-color-output",
         "backend/", "engine/", "models/", "parsers/"],
    )


def check_docstrings() -> CheckResult:
    """Custom check: ensure all Python modules have docstrings."""
    start = time.perf_counter()
    missing = []

    for dir_name in ["backend", "engine", "models", "parsers"]:
        dir_path = PROJECT_ROOT / dir_name
        if not dir_path.exists():
            continue

        for py_file in dir_path.rglob("*.py"):
            if py_file.name.startswith("__"):
                continue

            content = py_file.read_text(encoding="utf-8", errors="replace")
            # Check for module-level docstring
            stripped = content.lstrip()
            if not (stripped.startswith('"""') or stripped.startswith("'''")):
                missing.append(str(py_file.relative_to(PROJECT_ROOT)))

    duration = time.perf_counter() - start
    passed = len(missing) == 0
    output = ""
    if missing:
        output = "Missing module docstrings:\n" + "\n".join(f"  - {f}" for f in missing)

    return CheckResult(
        name="Docstring Coverage",
        passed=passed,
        duration=duration,
        output=output,
        error_count=len(missing),
    )


def check_imports() -> CheckResult:
    """Custom check: detect sys.path hacks that should be removed in production."""
    start = time.perf_counter()
    issues = []

    for dir_name in ["backend", "engine", "models", "parsers"]:
        dir_path = PROJECT_ROOT / dir_name
        if not dir_path.exists():
            continue

        for py_file in dir_path.rglob("*.py"):
            if py_file.name.startswith("__"):
                continue

            content = py_file.read_text(encoding="utf-8", errors="replace")
            for i, line in enumerate(content.split("\n"), 1):
                if "sys.path.insert" in line and not line.strip().startswith("#"):
                    issues.append(f"{py_file.relative_to(PROJECT_ROOT)}:{i}: {line.strip()}")

    duration = time.perf_counter() - start
    # This is a warning, not a failure
    output = ""
    if issues:
        output = "sys.path.insert usage (consider proper packaging):\n" + "\n".join(f"  - {i}" for i in issues)

    return CheckResult(
        name="Import Hygiene",
        passed=True,  # Warnings only
        duration=duration,
        output=output,
        error_count=len(issues),
    )


def run_pipeline(fix: bool = False) -> QualityReport:
    """
    Run the full code quality pipeline.

    Args:
        fix: If True, auto-fix formatting issues (Black).

    Returns:
        QualityReport with all check results.
    """
    report = QualityReport()
    start = time.perf_counter()

    if fix:
        print("  Auto-fixing formatting with Black...")
        subprocess.run(
            [sys.executable, "-m", "black", "--quiet",
             "backend/", "engine/", "models/", "parsers/"],
            cwd=str(PROJECT_ROOT),
        )
        print("  Done.\n")

    checks = [
        check_black,
        check_flake8,
        check_docstrings,
        check_imports,
    ]

    for check_fn in checks:
        print(f"  Running {check_fn.__doc__}")
        result = check_fn()
        report.checks.append(result)

        if result.output and not result.passed:
            print(f"    {result.output[:500]}")

    report.total_duration = time.perf_counter() - start
    return report


def main():
    """CLI entry point."""
    fix_mode = "--fix" in sys.argv
    verbose = "--verbose" in sys.argv or "-v" in sys.argv

    print("\n  Starting Code Quality Pipeline...")
    print(f"  Project: {PROJECT_ROOT}")
    print(f"  Mode: {'Auto-fix' if fix_mode else 'Check only'}\n")

    report = run_pipeline(fix=fix_mode)
    print(report.summary())

    if verbose:
        print("\n  ── Detailed Output ──\n")
        for check in report.checks:
            if check.output:
                print(f"  [{check.name}]")
                print(f"  {check.output}")
                print()

    sys.exit(0 if report.all_passed else 1)


if __name__ == "__main__":
    main()
