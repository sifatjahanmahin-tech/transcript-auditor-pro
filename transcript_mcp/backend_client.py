"""Async HTTP client for FastAPI backend integration."""

from __future__ import annotations

from typing import Any

import httpx

from .config import MCP_CONFIG


class BackendClient:
    """Async context manager wrapping httpx for backend API calls."""

    def __init__(self, auth_token: str = "") -> None:
        self.base_url = str(MCP_CONFIG["backend_url"])
        self.auth_token = auth_token
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> BackendClient:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=30.0,
        )
        return self

    async def __aexit__(self, *_: object) -> None:
        if self._client:
            await self._client.aclose()

    async def save_mcp_audit(
        self,
        audit_type: str,
        result: dict[str, Any],
        raw_text: str = "",
    ) -> dict[str, Any]:
        """POST /api/mcp/save-audit — persist an MCP tool result."""
        assert self._client, "BackendClient must be used as async context manager"
        payload = {"audit_type": audit_type, "result": result, "raw_text": raw_text}
        response = await self._client.post("/api/mcp/save-audit", json=payload)
        response.raise_for_status()
        return response.json()

    async def get_audit_history(self, page: int = 1, page_size: int = 20) -> dict[str, Any]:
        """GET /api/history — fetch the authenticated user's audit history."""
        assert self._client, "BackendClient must be used as async context manager"
        response = await self._client.get(
            "/api/history",
            params={"page": page, "page_size": page_size},
        )
        response.raise_for_status()
        return response.json()
