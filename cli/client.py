"""
Audit Pro CLI — API Client.

Handles interaction with the FastAPI backend, including:
  - Google OAuth2 Device flow for authentication
  - Secure token storage/management
  - File upload (CSV/Image) for remote audits
  - History retrieval
"""

import os
import time
import json
import requests
from typing import Optional, Dict, Any, List

class AuditProClient:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip("/")
        self.token_file = os.path.join(os.path.expanduser("~"), ".audit_pro_token")
        self.access_token: Optional[str] = self._load_token()

    def _load_token(self) -> Optional[str]:
        if os.path.exists(self.token_file):
            try:
                with open(self.token_file, "r") as f:
                    data = json.load(f)
                    return data.get("access_token")
            except Exception:
                return None
        return None

    def _save_token(self, token_data: Dict[str, Any]):
        with open(self.token_file, "w") as f:
            json.dump(token_data, f)
        self.access_token = token_data.get("access_token")

    def logout(self):
        if os.path.exists(self.token_file):
            os.remove(self.token_file)
        self.access_token = None

    def authenticate(self):
        """Perform Device Authorization Grant flow."""
        print("\n  [AUTH] Initiating Google Single Sign-On (CLI Device Flow)...")
        
        # 1. Start flow
        resp = requests.post(f"{self.base_url}/api/auth/device/authorize")
        if not resp.ok:
            print(f"  [ERROR] Failed to start auth: {resp.text}")
            return False
            
        data = resp.json()
        device_code = data["device_code"]
        user_code = data["user_code"]
        verification_uri = data["verification_uri"]
        interval = data.get("interval", 5)

        print(f"\n  1. Go to: {verification_uri}")
        print(f"  2. Enter code: {user_code}")
        print("\n  Waiting for authorization...")

        # 2. Poll for token
        while True:
            time.sleep(interval)
            poll_resp = requests.post(f"{self.base_url}/api/auth/device/token", json={"device_code": device_code})
            
            if poll_resp.status_code == 200:
                self._save_token(poll_resp.json())
                print("\n  [SUCCESS] Successfully authenticated.")
                return True
            
            status_data = poll_resp.json()
            error = status_data.get("detail", "")
            
            if error != "authorization_pending":
                print(f"\n  [ERROR] Auth failed: {error}")
                return False

    def get_headers(self) -> Dict[str, str]:
        if not self.access_token:
            return {}
        return {"Authorization": f"Bearer {self.access_token}"}

    def run_remote_audit(self, file_path: str, program_id: str):
        """Upload file and run audit on backend."""
        if not self.access_token:
            print("  [ERROR] Not authenticated. Please login first.")
            return None

        is_image = file_path.lower().endswith((".png", ".jpg", ".jpeg", ".pdf"))
        endpoint = "/api/audit/ocr" if is_image else "/api/audit/upload"
        
        url = f"{self.base_url}{endpoint}"
        files = {"file": open(file_path, "rb")}
        data = {"program_id": program_id}

        print(f"  [AUDIT] Uploading {os.path.basename(file_path)} to {endpoint}...")
        resp = requests.post(url, headers=self.get_headers(), files=files, data=data)
        
        if not resp.ok:
            print(f"  [ERROR] Audit failed: {resp.text}")
            return None
            
        return resp.json()

    def get_history(self, limit: int = 10):
        """Fetch audit history."""
        url = f"{self.base_url}/api/history"
        resp = requests.get(url, headers=self.get_headers(), params={"limit": limit})
        
        if not resp.ok:
            print(f"  [ERROR] Failed to fetch history: {resp.text}")
            return []
            
        return resp.json().get("history", [])

    def list_programs(self):
        """List available programs."""
        resp = requests.get(f"{self.base_url}/api/programs")
        if not resp.ok:
            return []
        return resp.json().get("programs", [])
