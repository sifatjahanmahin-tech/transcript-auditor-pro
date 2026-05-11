"""MCP server configuration — all values overridable via environment variables."""

import os

MCP_CONFIG: dict[str, str | int] = {
    "backend_url": os.getenv("BACKEND_URL", "https://transcript-auditor-api.onrender.com"),
    "mcp_host": os.getenv("MCP_HOST", "localhost"),
    "mcp_port": int(os.getenv("MCP_PORT", "8001")),
}
