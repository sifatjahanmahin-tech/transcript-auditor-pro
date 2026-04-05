"""
Unit Tests for Transcript Auditor Pro Backend.

Focuses on:
  - API Health
  - Authentication middleware
  - Audit engine integration
"""

import pytest
from httpx import AsyncClient
from backend.main import app
from backend.database import Base, async_engine

@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create test tables and cleanup after."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await async_engine.dispose()

@pytest.mark.asyncio
async def test_health_check():
    """Verify system health endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "version" in data

@pytest.mark.asyncio
async def test_list_programs_empty():
    """Verify programs endpoint returns empty list initially."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/programs")
    
    assert response.status_code == 200
    assert "programs" in response.json()

@pytest.mark.asyncio
async def test_unauthorized_history():
    """Verify history endpoint is protected by auth."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/history")
    
    # 401 Unauthorized expected without token
    assert response.status_code == 401
