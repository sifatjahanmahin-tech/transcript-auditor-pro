"""
Audit Pro CLI — API Client.

Handles interaction with the FastAPI backend, including:
  - Google OAuth2 Device flow for authentication
  - Secure token storage/management
  - File upload (CSV/Image) for remote audits
  - History retrieval

Usage:
  python -m cli.client login
  python -m cli.client audit <file> <program_id>
  python -m cli.client history
  python -m cli.client programs
  python -m cli.client logout
  python -m cli.client health
"""

import json
import os
import time
from typing import Any

import requests


class AuditProClient:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip("/")
        self.token_file = os.path.join(os.path.expanduser("~"), ".audit_pro_token")
        self.access_token: str | None = self._load_token()

    def _load_token(self) -> str | None:
        if os.path.exists(self.token_file):
            try:
                with open(self.token_file) as f:
                    data = json.load(f)
                    return data.get("access_token")
            except Exception:
                return None
        return None

    def _save_token(self, token_data: dict[str, Any]):
        with open(self.token_file, "w") as f:
            json.dump(token_data, f)
        self.access_token = token_data.get("access_token")

    def logout(self):
        if os.path.exists(self.token_file):
            os.remove(self.token_file)
        self.access_token = None
        print("  [OK] Logged out.")

    def authenticate(self):
        """Perform Device Authorization Grant flow."""
        print("\n  [AUTH] Initiating Google Single Sign-On (CLI Device Flow)...")

        # 1. Request device code
        resp = requests.post(f"{self.base_url}/api/auth/device/code")
        if not resp.ok:
            print(f"  [ERROR] Failed to start auth: {resp.text}")
            return False

        data = resp.json()
        device_code = data["device_code"]
        user_code = data["user_code"]
        verification_url = data["verification_url"]
        interval = data.get("interval", 5)

        print(f"\n  1. Go to: {verification_url}")
        print(f"  2. Enter code: {user_code}")
        print("\n  Waiting for authorization...")

        # 2. Poll for token
        while True:
            time.sleep(interval)
            poll_resp = requests.post(
                f"{self.base_url}/api/auth/device/token",
                json={"device_code": device_code},
            )

            if poll_resp.status_code == 200:
                self._save_token(poll_resp.json())
                print("\n  [SUCCESS] Successfully authenticated.")
                return True
            elif poll_resp.status_code == 202:
                # Still pending — keep polling
                print("  Waiting...", end="\r")
                continue
            else:
                try:
                    error = poll_resp.json().get("detail", poll_resp.text)
                except Exception:
                    error = poll_resp.text
                print(f"\n  [ERROR] Auth failed: {error}")
                return False

    def get_headers(self) -> dict[str, str]:
        if not self.access_token:
            return {}
        return {"Authorization": f"Bearer {self.access_token}"}

    def whoami(self):
        """Print current authenticated user."""
        resp = requests.get(f"{self.base_url}/api/auth/me", headers=self.get_headers())
        if not resp.ok:
            print("  [ERROR] Not authenticated or session expired.")
            return
        user = resp.json()
        print(f"  Logged in as: {user.get('name', 'N/A')} <{user.get('email')}>")

    def run_remote_audit(self, file_path: str, program_id: str):
        """Upload file and run audit on backend."""
        if not self.access_token:
            print("  [ERROR] Not authenticated. Run: python -m cli.client login")
            return None

        is_image = file_path.lower().endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".pdf"))
        endpoint = "/api/audit/image" if is_image else "/api/audit/csv"

        url = f"{self.base_url}{endpoint}"
        with open(file_path, "rb") as f:
            files = {"file": (os.path.basename(file_path), f)}
            data = {"program_name": program_id}
            print(f"  [AUDIT] Uploading {os.path.basename(file_path)} to {endpoint}...")
            resp = requests.post(url, headers=self.get_headers(), files=files, data=data)

        if not resp.ok:
            print(f"  [ERROR] Audit failed: {resp.text}")
            return None

        return resp.json()

    def get_history(self, limit: int = 10):
        """Fetch audit history."""
        url = f"{self.base_url}/api/history"
        resp = requests.get(url, headers=self.get_headers(), params={"page": 1, "page_size": limit})

        if not resp.ok:
            print(f"  [ERROR] Failed to fetch history: {resp.text}")
            return []

        return resp.json().get("items", [])

    def list_programs(self):
        """List available programs."""
        resp = requests.get(f"{self.base_url}/api/programs")
        if not resp.ok:
            return []
        return resp.json().get("programs", [])

    def health(self):
        """Check API health."""
        try:
            resp = requests.get(f"{self.base_url}/api/health", timeout=5)
            data = resp.json()
            print(f"  Status   : {data.get('status')}")
            print(f"  Version  : {data.get('version')}")
            print(f"  Database : {data.get('database')}")
            print(f"  OCR      : {'available' if data.get('ocr_available') else 'unavailable'}")
        except requests.ConnectionError:
            print(f"  [ERROR] Cannot connect to {self.base_url} — is the backend running?")


def main():
    import argparse

    parser = argparse.ArgumentParser(prog="audit-pro", description="Transcript Auditor Pro CLI")
    parser.add_argument("--api", default="http://localhost:8000", help="Backend URL")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("login", help="Authenticate via Google (device flow)")
    sub.add_parser("logout", help="Clear saved credentials")
    sub.add_parser("whoami", help="Show current logged-in user")
    sub.add_parser("health", help="Check API health")
    sub.add_parser("programs", help="List available degree programs")

    audit_p = sub.add_parser("audit", help="Run a degree audit")
    audit_p.add_argument("file", help="Path to transcript CSV or image")
    audit_p.add_argument("program_id", help="Program ID (from 'programs' command)")

    hist_p = sub.add_parser("history", help="Show audit history")
    hist_p.add_argument("--limit", type=int, default=10, help="Number of records")

    args = parser.parse_args()
    client = AuditProClient(base_url=args.api)

    if args.command == "login":
        client.authenticate()

    elif args.command == "logout":
        client.logout()

    elif args.command == "whoami":
        client.whoami()

    elif args.command == "health":
        client.health()

    elif args.command == "programs":
        programs = client.list_programs()
        if not programs:
            print("  No programs found.")
        for p in programs:
            print(f"  [{p['id']}] {p['name']} — {p.get('total_required_credits')} credits")

    elif args.command == "audit":
        result = client.run_remote_audit(args.file, args.program_id)
        if result:
            import pprint

            pprint.pprint(result)

    elif args.command == "history":
        records = client.get_history(limit=args.limit)
        if not records:
            print("  No history found.")
        for r in records:
            print(
                f"  [{r.get('created_at', '')[:10]}] {r.get('program_name')} — {r.get('total_valid_credits')} credits, CGPA {r.get('cgpa')}"
            )

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
