"""
Locust Load Testing Script for Transcript Auditor Pro.

Simulates 20+ concurrent users performing common actions:
  - Fetching available programs
  - Uploading CSV transcripts
  - Retrieving audit history
"""

import os
import random
from locust import HttpUser, task, between

# Test data (relative to project root)
TEST_CSV = "tests/data/credit/test_basic_audit.csv"

class AuditProUser(HttpUser):
    wait_time = between(1, 4)
    
    def on_start(self):
        """Simulation: Login and initial state."""
        # Note: In a real test, we would provide a test JWT
        # For this simulation, we assume auth is handled or disabled in test env
        self.headers = {"Authorization": "Bearer test-session-token"}
        self.program_id = None
        
        # Initial call to get programs
        with self.client.get("/api/programs", catch_response=True) as resp:
            if resp.status_code == 200:
                progs = resp.json().get("programs", [])
                if progs:
                    self.program_id = progs[0]["id"]
            else:
                resp.failure("Failed to load programs list")

    @task(3)
    def view_history(self):
        """High frequency: User checking past audits."""
        self.client.get("/api/history?limit=10", headers=self.headers)

    @task(1)
    def perform_audit(self):
        """Core action: Uploading and auditing."""
        if not self.program_id:
            return
            
        if os.path.exists(TEST_CSV):
            with open(TEST_CSV, "rb") as f:
                self.client.post(
                    "/api/audit/upload",
                    headers=self.headers,
                    files={"file": ("test.csv", f, "text/csv")},
                    data={"program_id": self.program_id}
                )
        else:
            # Fallback for when full data isn't present
            self.client.get("/api/health")

    @task(5)
    def browse_home(self):
        """Most frequent: Browsing the public site/health."""
        self.client.get("/api/health")

    @task(1)
    def view_programs(self):
        """User checking requirements."""
        self.client.get("/api/programs")
