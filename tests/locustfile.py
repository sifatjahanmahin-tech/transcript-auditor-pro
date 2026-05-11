"""
Locust Load Testing — Transcript Auditor Pro.

Simulates 20 concurrent users across common workflows:
  - Health checks (highest frequency, no auth)
  - Program listing (no auth)
  - Audit history (auth required)
  - CSV transcript upload + audit (auth required)

Usage:
  # Headless run (20 users, 2/s spawn, 60s duration):
  locust -f tests/locustfile.py --headless -u 20 -r 2 -t 60s --host http://localhost:8000

  # Interactive web UI:
  locust -f tests/locustfile.py --host http://localhost:8000
  # Then open http://localhost:8089

Auth note:
  Protected endpoints require a real JWT. Set env var AUDIT_PRO_TEST_TOKEN before running.
  Get one by logging in via the CLI: python -m cli.client login
  Then: export AUDIT_PRO_TEST_TOKEN=$(cat ~/.audit_pro_token | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
"""

import io
import os

from locust import HttpUser, between, task

# JWT for authenticated endpoints — set via environment variable
TEST_TOKEN = os.getenv("AUDIT_PRO_TEST_TOKEN", "")

# Minimal valid CSV transcript for upload tests
SAMPLE_CSV = b"""course_code,course_name,grade,credits,semester
CSE115,Programming Language I,A,3.0,Fall 2021
CSE215,Programming Language II,B+,3.0,Spring 2022
MAT110,Differential Calculus,A-,3.0,Fall 2021
PHY111,Fundamentals of Physics I,B,3.0,Spring 2022
ENG115,English and Communication Skills,A,3.0,Fall 2021
"""


class AuditProUser(HttpUser):
    """Simulates a typical Transcript Auditor Pro user session."""

    wait_time = between(1, 3)

    def on_start(self):
        self.auth_headers = {"Authorization": f"Bearer {TEST_TOKEN}"} if TEST_TOKEN else {}
        self.program_name = "Computer Science & Engineering"

        # Fetch and cache a valid program name
        with self.client.get("/api/programs", catch_response=True, name="/api/programs") as resp:
            if resp.status_code == 200:
                programs = resp.json().get("programs", [])
                if programs:
                    self.program_name = programs[0]["name"]
            else:
                resp.failure(f"Programs list failed: {resp.status_code}")

    @task(6)
    def health_check(self):
        """Most frequent: lightweight health probe (no auth)."""
        with self.client.get("/api/health", name="/api/health") as resp:
            if resp.status_code != 200:
                resp.failure(f"Health check failed: {resp.status_code}")

    @task(4)
    def list_programs(self):
        """Common: user browsing available degree programs (no auth)."""
        with self.client.get("/api/programs", name="/api/programs") as resp:
            if resp.status_code != 200:
                resp.failure(f"Programs failed: {resp.status_code}")

    @task(3)
    def view_history(self):
        """Auth: user checking their past audits."""
        if not self.auth_headers:
            return
        with self.client.get(
            "/api/history?page=1&page_size=10",
            headers=self.auth_headers,
            name="/api/history",
        ) as resp:
            if resp.status_code not in (200, 401):
                resp.failure(f"History failed: {resp.status_code}")

    @task(1)
    def upload_csv_audit(self):
        """Core action: upload CSV transcript and run audit."""
        if not self.auth_headers:
            return
        csv_file = io.BytesIO(SAMPLE_CSV)
        with self.client.post(
            "/api/audit/csv",
            headers=self.auth_headers,
            files={"file": ("transcript.csv", csv_file, "text/csv")},
            data={"program_name": self.program_name},
            name="/api/audit/csv",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201):
                resp.success()
            elif resp.status_code == 401:
                resp.failure("Unauthorized — set AUDIT_PRO_TEST_TOKEN")
            else:
                resp.failure(f"Audit failed: {resp.status_code} — {resp.text[:200]}")

    @task(1)
    def view_history_stats(self):
        """Auth: user viewing their aggregate stats."""
        if not self.auth_headers:
            return
        with self.client.get(
            "/api/history/stats/summary",
            headers=self.auth_headers,
            name="/api/history/stats",
        ) as resp:
            if resp.status_code not in (200, 401):
                resp.failure(f"Stats failed: {resp.status_code}")
